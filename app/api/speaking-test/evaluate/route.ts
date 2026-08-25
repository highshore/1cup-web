import { NextResponse } from "next/server";
import { admin, createServerClientRSC } from "../../../lib/supabase/server";
import { fetchWithRetry } from "../../../lib/utils/retry";

export const runtime = "nodejs";

type Answer = {
  taskNumber?: number;
  taskKind?: "listen_repeat" | "picture_description" | "interview";
  questionId?: string | null;
  transcript?: string;
  durationSeconds?: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const responseSchema = {
  name: "speaking_test_report",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["overall", "criteria", "taskFeedback", "strengths", "focusAreas", "studyPlan", "reportNote"],
    properties: {
      overall: {
        type: "object",
        additionalProperties: false,
        required: ["cefr", "band", "score", "summary"],
        properties: {
          cefr: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
          band: { type: "string" },
          score: { type: "number" },
          summary: { type: "string" },
        },
      },
      criteria: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "level", "score", "description", "evidence", "nextStep"],
          properties: {
            id: { type: "string", enum: ["fluency", "accuracy", "range"] },
            label: { type: "string" },
            level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
            score: { type: "number" },
            description: { type: "string" },
            evidence: { type: "string" },
            nextStep: { type: "string" },
          },
        },
      },
      taskFeedback: {
        type: "array",
        minItems: 1,
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["taskNumber", "score", "feedback"],
          properties: {
            taskNumber: { type: "number" },
            score: { type: "number" },
            feedback: { type: "string" },
          },
        },
      },
      strengths: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
      focusAreas: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
      studyPlan: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["day", "goal", "exercise"],
          properties: {
            day: { type: "string" },
            goal: { type: "string" },
            exercise: { type: "string" },
          },
        },
      },
      reportNote: { type: "string" },
    },
  },
};

const sanitizeAnswers = (answers: unknown): Answer[] =>
  Array.isArray(answers)
    ? answers
        .slice(0, 7)
        .map((answer) => ({
          taskNumber: Number(answer?.taskNumber) || 0,
          taskKind: answer?.taskKind === "listen_repeat" || answer?.taskKind === "picture_description" || answer?.taskKind === "interview"
            ? answer.taskKind
            : "interview",
          questionId: typeof answer?.questionId === "string" && UUID_PATTERN.test(answer.questionId) ? answer.questionId : null,
          transcript: typeof answer?.transcript === "string" ? answer.transcript.trim().slice(0, 5000) : "",
          durationSeconds: Math.max(0, Math.min(180, Number(answer?.durationSeconds) || 0)),
        }))
        .filter((answer) => answer.transcript && answer.taskNumber)
    : [];

export async function POST(request: Request) {
  const supabase = await createServerClientRSC();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Please sign in to generate an assessment." }, { status: 401 });
  }

  let body: { answers?: unknown; questionSetId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid assessment request." }, { status: 400 });
  }

  const answers = sanitizeAnswers(body.answers);
  const questionSetId = typeof body.questionSetId === "string" && UUID_PATTERN.test(body.questionSetId)
    ? body.questionSetId
    : null;
  const combinedWords = answers.reduce(
    (total, answer) => total + (answer.transcript?.split(/\s+/).filter(Boolean).length || 0),
    0,
  );
  if (answers.length === 0 || combinedWords < 20) {
    return NextResponse.json(
      { error: "Please provide at least a short answer before requesting a report." },
      { status: 400 },
    );
  }

  const apiKey = process.env.NEXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Assessment is temporarily unavailable." }, { status: 503 });
  }

  try {
    const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SPEAKING_TEST_MODEL || "gpt-4o-mini",
        temperature: 0.25,
        max_tokens: 1900,
        response_format: { type: "json_schema", json_schema: responseSchema },
        messages: [
          {
            role: "system",
            content:
              "You are a careful English-speaking assessor for adult Korean learners. Produce a supportive, evidence-based CEFR practice report. This is not an official TOEFL or CEFR certification. Assess only Fluency, Accuracy, and Range using the supplied transcripts and timing. Do not assess pronunciation from text; fluency may discuss pacing, cohesion, hesitation words, and clarity of thought only. Be calibrated: C1 requires fluent spontaneous expression, sophisticated cohesive structures, rare errors, and broad precise language. Return English only, concise but specific feedback, and no invented quotes or claims about audio.",
          },
          {
            role: "user",
            content: JSON.stringify({
              rubric: {
                fluency: "How smoothly and spontaneously meaning is communicated; organization, pace, fillers, and ability to sustain an answer.",
                accuracy: "How correctly grammar and vocabulary are used; assess clear recurring errors rather than minor transcript punctuation.",
                range: "The variety and precision of vocabulary, grammatical forms, cohesive devices, style, and register.",
              },
              report_requirements: [
                "Use A1, A2, B1, B2, C1, or C2 for all levels.",
                "Use a 0-100 practice score, where C1 is generally 75-89 and C2 is 90-100.",
                "Make the evidence field refer to observable patterns in the transcripts without quoting more than a short phrase.",
                "The report note must say this is transcript-based practice feedback, not a certified test result.",
              ],
              answers,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[speaking-test] assessment provider returned", response.status);
      return NextResponse.json({ error: "We could not generate your report. Please try again." }, { status: 502 });
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Missing assessment content");
    const report = JSON.parse(content) as {
      overall: { cefr: string; band: string; score: number };
    };
    const database = admin();
    const { data: member, error: memberError } = await database
      .from("users")
      .select("uid")
      .eq("auth_id", auth.user.id)
      .maybeSingle();
    if (memberError || !member?.uid) throw new Error("Member profile not found");

    const { data: attempt, error: attemptError } = await database
      .from("speaking_test_attempts")
      .insert({
        user_id: member.uid,
        test_version: "toefl-inspired-v2",
        question_set_id: questionSetId,
        task_count: answers.length,
        overall_cefr: report.overall.cefr,
        overall_band: report.overall.band,
        overall_score: report.overall.score,
        report,
      })
      .select("id")
      .single();
    if (attemptError || !attempt) throw new Error("Could not save speaking test attempt");

    const responseRows = answers.map((answer) => ({
      attempt_id: attempt.id,
      task_number: answer.taskNumber,
      task_kind: answer.taskKind,
      question_id: answer.questionId,
      transcript: answer.transcript,
      duration_seconds: answer.durationSeconds,
      word_count: answer.transcript.split(/\s+/).filter(Boolean).length,
    }));
    const { error: responsesError } = await database
      .from("speaking_test_responses")
      .insert(responseRows);
    if (responsesError) throw new Error("Could not save speaking test responses");

    return NextResponse.json({ ...report, attemptId: attempt.id });
  } catch (error) {
    console.error("[speaking-test] assessment failed", error);
    return NextResponse.json({ error: "We could not generate your report. Please try again." }, { status: 500 });
  }
}
