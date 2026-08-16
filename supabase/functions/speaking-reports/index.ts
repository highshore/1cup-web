// Supabase Edge Function: speaking-reports
// Port of the Firebase Cloud Function `generateSpeakingReports`
// (functions/src/index.ts). OpenAI speaking analysis; writes speaking_reports
// (ONE table, PK (transcript_id, user_id)) and flips transcripts.reports_*.
//
// KEY SCHEMA CHANGE vs Firestore: per-session numeric metrics that used to live
// in the `metadata` map are promoted to first-class columns. We populate BOTH
// the promoted columns AND the jsonb `analysis` / `metadata`. No dual-write to a
// user subcollection; meetup_reports / meetup_report_users are SQL views (not
// written here).

import { preflight, json } from "../_shared/cors.ts";
import { admin, env } from "../_shared/db.ts";
import OpenAI from "npm:openai";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface SpeakingAnalysisRequest {
  transcriptId?: string;
  speakerMappings?: Record<string, string>; // speaker ID -> participant UID
  transcriptContent?: any[];
  analysisType?: "simple" | "comprehensive";
  prompt?: string; // For simple analysis
  model?: string; // For simple analysis
}

interface SpeakingAnalysis {
  overallScore: number;
  fluency: { score: number; feedback: string };
  vocabulary: { score: number; feedback: string };
  grammar: { score: number; feedback: string };
  pronunciation: { score: number; feedback: string };
  engagement: { score: number; feedback: string };
  strengths: string[];
  areasForImprovement: string[];
  specificSuggestions: string[];
}

interface UserSpeakingReport {
  userId: string;
  transcriptId: string;
  speakerId: string;
  userScript: string;
  analysis: SpeakingAnalysis;
  metadata: {
    wordCount: number;
    speakingDuration: number;
    averageWordsPerMinute: number;
    createdAt: string;
    articleId?: string | null;
    sessionNumber?: number | null;
    speakingTurns?: number;
    avgTurnDuration?: number;
    longestTurn?: number;
    uniqueWords?: number;
    lexicalDiversity?: number;
    avgResponseLatency?: number;
    interruptions?: number;
    talkTimeShare?: number;
  };
}

type Segment = { speaker: string; start: number; end: number };

// -----------------------------------------------------------------------------
// Local metric computation helpers (faithful to functions/src/index.ts)
// -----------------------------------------------------------------------------

// Extract script for multiple speakers
function extractUserScriptForSpeakers(
  transcriptContent: any[],
  speakerIds: string[],
): string {
  const set = new Set(speakerIds);
  const userWords: string[] = [];
  transcriptContent.forEach((item) => {
    if (item.alternatives && item.alternatives[0]) {
      const word = item.alternatives[0];
      if (set.has(word.speaker) && word.content) {
        userWords.push(word.content);
      }
    }
  });
  return userWords.join(" ");
}

// Duration across multiple speakers (merge overlapping)
function calculateSpeakingDurationForSpeakers(
  transcriptContent: any[],
  speakerIds: string[],
): number {
  const set = new Set(speakerIds);
  let totalDuration = 0;
  const segments: { start: number; end: number }[] = [];
  transcriptContent.forEach((item) => {
    if (item.alternatives && item.alternatives[0]) {
      const word = item.alternatives[0];
      if (
        set.has(word.speaker) &&
        item.start_time !== undefined &&
        item.end_time !== undefined
      ) {
        segments.push({ start: item.start_time, end: item.end_time });
      }
    }
  });
  if (segments.length === 0) return 0;
  segments.sort((a, b) => a.start - b.start);
  let currentStart = segments[0].start;
  let currentEnd = segments[0].end;
  for (let i = 1; i < segments.length; i++) {
    const s = segments[i];
    if (s.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, s.end);
    } else {
      totalDuration += currentEnd - currentStart;
      currentStart = s.start;
      currentEnd = s.end;
    }
  }
  totalDuration += currentEnd - currentStart;
  return totalDuration;
}

// Round to 2 decimals
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Extract flat segments from transcript
function extractSegments(transcriptContent: any[]): Segment[] {
  const segments: Segment[] = [];
  transcriptContent.forEach((item) => {
    if (
      item?.alternatives &&
      item.alternatives[0] &&
      item.start_time !== undefined &&
      item.end_time !== undefined
    ) {
      segments.push({
        speaker: item.alternatives[0].speaker,
        start: item.start_time,
        end: item.end_time,
      });
    }
  });
  return segments;
}

// Merge all segments of given speakerIds, and non-user segments
function computeMergedUserSegments(
  allSegments: Segment[],
  speakerIds: string[],
) {
  const set = new Set(speakerIds);
  const userSegments = allSegments
    .filter((s) => set.has(s.speaker))
    .sort((a, b) => a.start - b.start);
  const otherSegments = allSegments
    .filter((s) => !set.has(s.speaker))
    .sort((a, b) => a.start - b.start);

  return { userSegments, otherSegments };
}

// Turn metrics
function computeTurnMetrics(segments: Segment[]) {
  if (segments.length === 0) {
    return { turns: 0, avgTurnSec: 0, longestTurnSec: 0 };
  }
  const durations = segments.map((s) => s.end - s.start);
  const turns = segments.length;
  const avgTurnSec = durations.reduce((a, b) => a + b, 0) / turns;
  const longestTurnSec = Math.max(...durations);
  return { turns, avgTurnSec, longestTurnSec };
}

// Interaction metrics: response latency, interruptions, talk time share
function computeInteractionMetrics(
  allSegments: Segment[],
  userSegments: Segment[],
) {
  if (allSegments.length === 0) {
    return {
      avgResponseLatencySec: 0,
      interruptions: 0,
      totalTalkTimeSec: 0,
      userTalkTimeSec: 0,
    };
  }

  const sorted = [...allSegments].sort((a, b) => a.start - b.start);

  const responseLatencies: number[] = [];
  let interruptions = 0;
  let totalTalkTimeSec = 0;
  let userTalkTimeSec = 0;

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const isUser = userSegments.some(
      (u) =>
        Math.abs(u.start - seg.start) < 1e-6 && Math.abs(u.end - seg.end) < 1e-6,
    );
    const duration = Math.max(0, seg.end - seg.start);
    totalTalkTimeSec += duration;
    if (isUser) userTalkTimeSec += duration;

    // Response latency: gap between a non-user seg end and the next user seg start
    if (!isUser) {
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        const nextIsUser = userSegments.some(
          (u) =>
            Math.abs(u.start - next.start) < 1e-6 &&
            Math.abs(u.end - next.end) < 1e-6,
        );
        if (nextIsUser) {
          const gap = next.start - seg.end;
          if (gap >= 0 && gap < 10) {
            // cap at 10s to avoid long silences biasing too much
            responseLatencies.push(gap);
          }
          break;
        }
      }
    }

    // Interruption heuristic: user segment starts before previous non-user ended
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevIsUser = userSegments.some(
        (u) =>
          Math.abs(u.start - prev.start) < 1e-6 &&
          Math.abs(u.end - prev.end) < 1e-6,
      );
      if (!prevIsUser && isUser && seg.start < prev.end) {
        interruptions += 1;
      }
    }
  }

  const avgResponseLatencySec =
    responseLatencies.length > 0
      ? responseLatencies.reduce((a, b) => a + b, 0) / responseLatencies.length
      : 0;

  return {
    avgResponseLatencySec,
    interruptions,
    totalTalkTimeSec,
    userTalkTimeSec,
  };
}

// Lexical metrics from script text
function computeLexicalMetrics(script: string) {
  const words = script
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9'-]/g, ""))
    .filter((w) => w.length > 0);
  const total = words.length;
  const unique = new Set(words).size;
  const lexicalDiversityPct = total > 0 ? (unique / total) * 100 : 0;
  return { uniqueWords: unique, lexicalDiversityPct };
}

// -----------------------------------------------------------------------------
// OpenAI AI analysis (faithful prompt from generateAIAnalysis)
// -----------------------------------------------------------------------------
async function generateAIAnalysis(
  userScript: string,
  wordCount: number,
  speakingDuration: number,
  openai: OpenAI,
): Promise<SpeakingAnalysis> {
  const prompt = `
You are an expert English speaking coach analyzing a transcript from an English conversation practice session. Please provide a comprehensive analysis of this speaker's performance.

TRANSCRIPT:
"${userScript}"

CONTEXT:
- Word count: ${wordCount}
- Speaking duration: ${speakingDuration.toFixed(1)} seconds
- This is from a structured English conversation practice session

Please analyze the following aspects and provide scores (1-10 scale) with detailed feedback:

1. FLUENCY: How smoothly and naturally does the speaker communicate?
2. VOCABULARY: Range and appropriateness of vocabulary used
3. GRAMMAR: Accuracy of grammatical structures
4. PRONUNCIATION: Clarity and accuracy (inferred from transcript patterns)
5. ENGAGEMENT: How well the speaker participates and contributes to conversation

For each category, provide:
- A score from 1-10
- Specific feedback explaining the score
- Actionable suggestions for improvement

Also provide:
- Overall score (average of all categories)
- Top 3 strengths
- Top 3 areas for improvement
- 3 specific, actionable suggestions for next practice sessions

Format your response as a JSON object with this exact structure:
{
  "overallScore": number,
  "fluency": {"score": number, "feedback": "string"},
  "vocabulary": {"score": number, "feedback": "string"},
  "grammar": {"score": number, "feedback": "string"},
  "pronunciation": {"score": number, "feedback": "string"},
  "engagement": {"score": number, "feedback": "string"},
  "strengths": ["string", "string", "string"],
  "areasForImprovement": ["string", "string", "string"],
  "specificSuggestions": ["string", "string", "string"]
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert English speaking coach. Analyze the provided transcript and return only valid JSON with no additional text or formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    const analysis = JSON.parse(response) as SpeakingAnalysis;

    if (
      !analysis.overallScore ||
      !analysis.fluency ||
      !analysis.vocabulary ||
      !analysis.grammar ||
      !analysis.pronunciation ||
      !analysis.engagement
    ) {
      throw new Error("Invalid analysis structure from AI");
    }

    return analysis;
  } catch (error) {
    console.error("Error generating AI analysis:", error);

    // Fallback analysis if AI fails
    return {
      overallScore: 5,
      fluency: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      vocabulary: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      grammar: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      pronunciation: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      engagement: {
        score: 5,
        feedback: "Analysis unavailable due to technical issues.",
      },
      strengths: [
        "Participated in the conversation",
        "Contributed to the discussion",
        "Engaged with the topic",
      ],
      areasForImprovement: [
        "Continue practicing",
        "Focus on consistency",
        "Build confidence",
      ],
      specificSuggestions: [
        "Keep practicing regularly",
        "Record yourself speaking",
        "Join more conversation sessions",
      ],
    };
  }
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  let body: SpeakingAnalysisRequest;
  try {
    body = (await req.json()) as SpeakingAnalysisRequest;
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const {
    transcriptId,
    speakerMappings,
    transcriptContent,
    analysisType = "comprehensive",
    prompt,
    model = "gpt-4o-mini",
  } = body;

  const apiKey = Deno.env.get("NEXT_OPENAI_API_KEY");
  if (!apiKey) {
    return json(req, { error: "OpenAI API key not configured" }, 500);
  }
  const openai = new OpenAI({ apiKey });

  // ---------------------------------------------------------------------------
  // Simple analysis (replaces the old API route)
  // ---------------------------------------------------------------------------
  if (analysisType === "simple") {
    if (!prompt) {
      return json(req, { error: "Prompt is required for simple analysis" }, 400);
    }
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert English language assessment AI specializing in analyzing Korean learners' speaking skills. Provide precise, professional evaluations using the specified scoring system and respond only in valid JSON format.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      });

      const analysisContent = completion.choices[0]?.message?.content;
      if (!analysisContent) {
        return json(req, { error: "No analysis content received from OpenAI" }, 502);
      }

      let analysis: any;
      try {
        analysis = JSON.parse(analysisContent);
      } catch {
        return json(req, { error: "Invalid response format from OpenAI" }, 502);
      }

      if (!analysis.complexity || !analysis.accuracy || !analysis.fluency) {
        return json(req, { error: "Invalid analysis structure received" }, 502);
      }

      return json(req, {
        success: true,
        analysis,
        model,
        usage: completion.usage,
      });
    } catch (error) {
      return json(
        req,
        {
          error: `Simple analysis failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        500,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Comprehensive analysis (original logic, ported to Postgres)
  // ---------------------------------------------------------------------------
  if (!transcriptId || !speakerMappings || !transcriptContent) {
    return json(
      req,
      {
        error:
          "Missing required parameters for comprehensive analysis: transcriptId, speakerMappings, or transcriptContent",
      },
      400,
    );
  }

  const db = admin();

  try {
    // Load transcript for metadata
    const { data: transcriptData, error: tErr } = await db
      .from("transcripts")
      .select("id, article_id, session_number")
      .eq("id", transcriptId)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!transcriptData) {
      return json(req, { error: "Transcript not found" }, 404);
    }

    const reports: UserSpeakingReport[] = [];

    // Group speakerIds by userId to merge multiple speaker labels for one person.
    const userIdToSpeakerIds: Record<string, string[]> = {};
    Object.entries(speakerMappings).forEach(([speakerId, userId]) => {
      if (!userId) return;
      if (!userIdToSpeakerIds[userId]) userIdToSpeakerIds[userId] = [];
      userIdToSpeakerIds[userId].push(speakerId);
    });

    for (const [userId, speakerIds] of Object.entries(userIdToSpeakerIds)) {
      // Extract user's script across all mapped speakerIds
      const userScript = extractUserScriptForSpeakers(transcriptContent, speakerIds);
      if (!userScript || userScript.trim().length === 0) {
        continue;
      }

      const wordCount = userScript.split(/\s+/).filter((w) => w.length > 0).length;
      const speakingDuration = calculateSpeakingDurationForSpeakers(
        transcriptContent,
        speakerIds,
      );
      const averageWordsPerMinute =
        speakingDuration > 0 ? wordCount / (speakingDuration / 60) : 0;

      // Richer local metrics
      const allSegments = extractSegments(transcriptContent);
      const merged = computeMergedUserSegments(allSegments, speakerIds);
      const turnStats = computeTurnMetrics(merged.userSegments);
      const interactionStats = computeInteractionMetrics(
        allSegments,
        merged.userSegments,
      );
      const lexical = computeLexicalMetrics(userScript);

      // AI analysis
      const analysis = await generateAIAnalysis(
        userScript,
        wordCount,
        speakingDuration,
        openai,
      );

      const createdAt = new Date().toISOString();

      // Promoted metric values
      const speakingTurns = turnStats.turns;
      const avgTurnDuration = round2(turnStats.avgTurnSec);
      const longestTurn = round2(turnStats.longestTurnSec);
      const uniqueWords = lexical.uniqueWords;
      const lexicalDiversity = round2(lexical.lexicalDiversityPct);
      const avgResponseLatency = round2(interactionStats.avgResponseLatencySec);
      const interruptions = interactionStats.interruptions;
      const talkTimeShare = round2(
        interactionStats.userTalkTimeSec > 0
          ? (interactionStats.userTalkTimeSec / interactionStats.totalTalkTimeSec) * 100
          : 0,
      );

      // metadata jsonb — mirrors the original Firestore `metadata` map
      const metadata: UserSpeakingReport["metadata"] = {
        wordCount,
        speakingDuration,
        averageWordsPerMinute,
        createdAt,
        articleId: transcriptData.article_id ?? null,
        sessionNumber: transcriptData.session_number ?? null,
        speakingTurns,
        avgTurnDuration,
        longestTurn,
        uniqueWords,
        lexicalDiversity,
        avgResponseLatency,
        interruptions,
        talkTimeShare,
      };

      const report: UserSpeakingReport = {
        userId,
        transcriptId,
        speakerId: speakerIds.join("+"),
        userScript,
        analysis,
        metadata,
      };
      reports.push(report);

      // Upsert into the ONE speaking_reports table (PK transcript_id, user_id),
      // populating BOTH the promoted columns AND the jsonb blobs.
      const { error: upErr } = await db.from("speaking_reports").upsert(
        {
          transcript_id: transcriptId,
          user_id: userId,
          speaker_id: speakerIds.join("+"),
          user_script: userScript,
          // promoted metrics
          word_count: wordCount,
          speaking_duration_sec: round2(speakingDuration),
          avg_wpm: round2(averageWordsPerMinute),
          speaking_turns: speakingTurns,
          avg_turn_sec: avgTurnDuration,
          longest_turn_sec: longestTurn,
          avg_response_latency_sec: avgResponseLatency,
          interruptions,
          unique_words: uniqueWords,
          lexical_diversity_pct: lexicalDiversity,
          talk_time_share_pct: talkTimeShare,
          overall_score: analysis.overallScore,
          article_id: transcriptData.article_id ?? null,
          session_number: transcriptData.session_number ?? null,
          // qualitative + audit
          analysis,
          metadata,
          created_at: createdAt,
        },
        { onConflict: "transcript_id,user_id" },
      );
      if (upErr) throw upErr;
    }

    // Update transcript with report generation info
    const { error: updErr } = await db
      .from("transcripts")
      .update({
        reports_generated: true,
        reports_generated_at: new Date().toISOString(),
        report_count: reports.length,
      })
      .eq("id", transcriptId);
    if (updErr) throw updErr;

    return json(req, {
      success: true,
      reportCount: reports.length,
      reports: reports.map((r) => ({
        userId: r.userId,
        overallScore: r.analysis.overallScore,
        wordCount: r.metadata.wordCount,
      })),
    });
  } catch (error) {
    console.error("Error generating speaking reports:", error);
    return json(
      req,
      {
        error: `Failed to generate reports: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      500,
    );
  }
});
