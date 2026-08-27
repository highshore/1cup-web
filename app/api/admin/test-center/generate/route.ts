import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { admin, createServerClientRSC } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_URL = "https://api.openai.com/v1";
const DID_URL = "https://api.d-id.com";
const STORAGE_BUCKET = "assets";
const FACTORY_VERSION = "speaking-2026.1";

type InterviewStage = "experience" | "preference" | "opinion" | "broader_issue";
type FactoryDraft = {
  listenRepeat: {
    title: string;
    scenario: string;
    visualPrompt: string;
    sentences: string[];
  };
  interview: {
    topic: string;
    context: string;
    questions: Array<{ stage: InterviewStage; text: string }>;
  };
};

type StoredAsset = {
  id: string;
  asset_type: "image" | "audio" | "video";
  storage_path: string;
};

type FactoryWarning = { code: string; message: string };

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

async function requireAdmin() {
  const sessionClient = await createServerClientRSC();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return null;

  const database = admin();
  const { data: member } = await database
    .from("users")
    .select("uid, account_status")
    .eq("auth_id", user.id)
    .maybeSingle();

  return member?.account_status === "admin" && member.uid ? member.uid : null;
}

function getOpenAIKey() {
  return process.env.NEXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
}

function didAuthorization() {
  const value = process.env.DID_API_KEY?.trim() || "";
  if (!value) return "";
  return value.toLowerCase().startsWith("basic ") ? value : `Basic ${value}`;
}

async function openAIJson(path: string, body: Record<string, unknown>) {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch(`${OPENAI_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("[speaking-factory] OpenAI request failed", path, response.status, payload);
    throw new Error(`AI media provider returned ${response.status}.`);
  }
  return payload;
}

function parseDraft(value: unknown): FactoryDraft | null {
  if (!isRecord(value) || !isRecord(value.listenRepeat) || !isRecord(value.interview)) return null;

  const listenRepeat = value.listenRepeat;
  const interview = value.interview;
  const sentences = Array.isArray(listenRepeat.sentences)
    ? listenRepeat.sentences.map((item) => cleanString(item, 240)).filter(Boolean)
    : [];
  const rawQuestions = Array.isArray(interview.questions) ? interview.questions : [];
  const validStages = new Set<InterviewStage>(["experience", "preference", "opinion", "broader_issue"]);
  const questions = rawQuestions
    .map((item) => {
      if (!isRecord(item)) return null;
      const stage = cleanString(item.stage, 40) as InterviewStage;
      const text = cleanString(item.text, 500);
      return validStages.has(stage) && text ? { stage, text } : null;
    })
    .filter((item): item is { stage: InterviewStage; text: string } => item !== null);

  const draft: FactoryDraft = {
    listenRepeat: {
      title: cleanString(listenRepeat.title, 140),
      scenario: cleanString(listenRepeat.scenario, 1000),
      visualPrompt: cleanString(listenRepeat.visualPrompt, 1800),
      sentences,
    },
    interview: {
      topic: cleanString(interview.topic, 160),
      context: cleanString(interview.context, 1000),
      questions,
    },
  };

  return draft.listenRepeat.title && draft.listenRepeat.scenario && draft.listenRepeat.visualPrompt
    && draft.interview.topic && draft.interview.context
    ? draft
    : null;
}

function validateDraft(draft: FactoryDraft) {
  const issues: string[] = [];
  const ranges: Array<[number, number]> = [[4, 6], [5, 8], [7, 10], [8, 12], [9, 13], [11, 16], [13, 20]];

  if (draft.listenRepeat.sentences.length !== 7) {
    issues.push("Listen & Repeat must contain exactly 7 sentences.");
  } else {
    draft.listenRepeat.sentences.forEach((sentence, index) => {
      const count = wordCount(sentence);
      const [min, max] = ranges[index];
      if (count < min || count > max) issues.push(`L&R sentence ${index + 1} has ${count} words; target is ${min}-${max}.`);
      if (!/[.!?]$/.test(sentence)) issues.push(`L&R sentence ${index + 1} should end with sentence punctuation.`);
    });
  }

  if (draft.interview.questions.length !== 4) issues.push("Interview must contain exactly 4 questions.");
  const expectedStages: InterviewStage[] = ["experience", "preference", "opinion", "broader_issue"];
  draft.interview.questions.forEach((question, index) => {
    if (question.stage !== expectedStages[index]) issues.push(`Interview question ${index + 1} must use stage ${expectedStages[index]}.`);
    const count = wordCount(question.text);
    if (count < 7 || count > 45) issues.push(`Interview question ${index + 1} has an unsuitable length (${count} words).`);
    if (!question.text.endsWith("?")) issues.push(`Interview question ${index + 1} must be phrased as a question.`);
  });

  const normalized = [
    ...draft.listenRepeat.sentences,
    ...draft.interview.questions.map((question) => question.text),
  ].map((item) => item.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim());
  if (new Set(normalized).size !== normalized.length) issues.push("Duplicate prompts were generated.");

  return issues;
}

async function generateDraft(listenRepeatSeed: string, interviewSeed: string) {
  const model = process.env.TOEFL_FACTORY_TEXT_MODEL || "gpt-4o-mini";
  let feedback = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prompt = `Create one original practice set for the January 2026+ TOEFL iBT Speaking format.

Return JSON only with this exact shape:
{
  "listenRepeat": {
    "title": "short scenario title",
    "scenario": "1-2 sentence coherent context",
    "visualPrompt": "a detailed prompt for ONE landscape composite contextual image showing several simultaneous sub-situations in the same coherent place",
    "sentences": ["...", "...", "...", "...", "...", "...", "..."]
  },
  "interview": {
    "topic": "short topic",
    "context": "a researcher/interviewer context",
    "questions": [
      {"stage":"experience","text":"..."},
      {"stage":"preference","text":"..."},
      {"stage":"opinion","text":"..."},
      {"stage":"broader_issue","text":"..."}
    ]
  }
}

Hard constraints:
- This is practice content, not copied or paraphrased from ETS.
- Listen & Repeat has exactly seven natural spoken-English sentences in ONE coherent campus/community/everyday scenario.
- Sentence word-count targets by position are 4-6, 5-8, 7-10, 8-12, 9-13, 11-16, 13-20.
- Complexity and auditory-memory load should generally rise across the seven sentences.
- The composite image must show 4-6 recognizable zones/actions from the scenario, but MUST contain no readable text, numbers, schedules, rules, labels, captions, logos, or details that reveal the exact sentence wording.
- Interview has exactly four related questions progressing: personal experience -> preference/choice -> general opinion -> broader institutional/social issue.
- Interview questions must be answerable without specialist knowledge and allow multiple reasonable viewpoints.
- Avoid politics, religion, medical advice, trauma, illegal activity, protected-class assumptions, copyrighted characters, brands, and current events.
- Use contemporary, natural North American academic English. Do not mention TOEFL inside the generated prompts.

Listen & Repeat seed from editor: ${listenRepeatSeed || "(choose a fresh university/community scenario)"}
Interview topic seed from editor: ${interviewSeed || "(choose a fresh student-life/general topic)"}
${feedback ? `Previous attempt failed validation. Correct all of these issues:\n${feedback}` : ""}`;

    const payload = await openAIJson("/chat/completions", {
      model,
      temperature: 0.75,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an assessment-content author. Follow structural constraints exactly and output only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      feedback = "The previous response did not contain JSON text.";
      continue;
    }

    try {
      const draft = parseDraft(JSON.parse(content));
      if (!draft) {
        feedback = "The previous JSON did not match the required shape.";
        continue;
      }
      const issues = validateDraft(draft);
      if (issues.length === 0) return draft;
      feedback = issues.join("\n");
    } catch {
      feedback = "The previous response was not valid JSON.";
    }
  }

  throw new Error(`Could not produce a structurally valid Speaking set. ${feedback}`.trim());
}

async function generateImage(prompt: string, size: "1536x1024" | "1024x1024") {
  const payload = await openAIJson("/images/generations", {
    model: process.env.TOEFL_FACTORY_IMAGE_MODEL || "gpt-image-2",
    prompt,
    size,
    quality: process.env.TOEFL_FACTORY_IMAGE_QUALITY || "low",
  });
  const encoded = payload?.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !encoded) throw new Error("Image generation returned no image.");
  return Buffer.from(encoded, "base64");
}

async function generateSpeech(input: string, voice: string, instructions: string) {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch(`${OPENAI_URL}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.TOEFL_FACTORY_TTS_MODEL || "gpt-4o-mini-tts",
      voice,
      input,
      instructions,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[speaking-factory] TTS failed", response.status, detail);
    throw new Error(`Speech generation returned ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function inBatches<T, R>(values: T[], size: number, run: (value: T, index: number) => Promise<R>) {
  const output: R[] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    const batch = values.slice(offset, offset + size);
    const results = await Promise.all(batch.map((value, index) => run(value, offset + index)));
    output.push(...results);
  }
  return output;
}

async function persistAsset(
  database: ReturnType<typeof admin>,
  adminUserId: string,
  objectPath: string,
  bytes: Buffer,
  assetType: "image" | "audio" | "video",
  contentType: string,
  altText: string,
): Promise<StoredAsset> {
  const { error: uploadError } = await database.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (uploadError) throw new Error(`Could not upload generated ${assetType} asset.`);

  const { data: publicData } = database.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicData.publicUrl;
  const { data, error } = await database
    .from("speaking_question_assets")
    .insert({
      asset_type: assetType,
      storage_path: publicUrl,
      alt_text: altText,
      created_by: adminUserId,
    })
    .select("id, asset_type, storage_path")
    .single();

  if (error || !data) {
    await database.storage.from(STORAGE_BUCKET).remove([objectPath]);
    throw new Error(`Could not register generated ${assetType} asset.`);
  }

  return data as StoredAsset;
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function renderDidTalk(sourceUrl: string, text: string) {
  const authorization = didAuthorization();
  if (!authorization) throw new Error("DID_API_KEY is not configured.");

  const response = await fetch(`${DID_URL}/talks`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_url: sourceUrl,
      script: {
        type: "text",
        input: text,
        provider: {
          type: "microsoft",
          voice_id: process.env.DID_INTERVIEWER_VOICE_ID || "en-US-JennyNeural",
        },
      },
      name: "1Cup TOEFL speaking interviewer",
    }),
  });

  const created = await response.json().catch(() => null);
  if (!response.ok || typeof created?.id !== "string") {
    console.error("[speaking-factory] D-ID create failed", response.status, created);
    throw new Error(`Interviewer renderer returned ${response.status}.`);
  }

  for (let poll = 0; poll < 24; poll += 1) {
    await sleep(2500);
    const statusResponse = await fetch(`${DID_URL}/talks/${created.id}`, {
      headers: { Authorization: authorization },
    });
    const status = await statusResponse.json().catch(() => null);
    if (!statusResponse.ok) continue;
    if (typeof status?.result_url === "string" && status.result_url) {
      const videoResponse = await fetch(status.result_url);
      if (!videoResponse.ok) throw new Error("Could not download rendered interviewer video.");
      return Buffer.from(await videoResponse.arrayBuffer());
    }
    if (status?.status === "error" || status?.status === "rejected") {
      throw new Error("Interviewer renderer rejected the clip.");
    }
  }

  throw new Error("Interviewer renderer did not finish in time.");
}

async function generateInterviewVideos(
  sourceUrl: string,
  questions: Array<{ text: string }>,
): Promise<Array<Buffer | null>> {
  if (!didAuthorization()) return questions.map(() => null);
  return Promise.all(questions.map(async (question) => {
    try {
      return await renderDidTalk(sourceUrl, question.text);
    } catch (cause) {
      console.error("[speaking-factory] interviewer clip failed", cause instanceof Error ? cause.message : cause);
      return null;
    }
  }));
}

async function createFactorySet(
  adminUserId: string,
  input: {
    title: string;
    slug: string;
    listenRepeatSeed: string;
    interviewSeed: string;
    generateVideo: boolean;
  },
) {
  const database = admin();
  const { data: existing } = await database
    .from("speaking_question_sets")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();
  if (existing) throw new Error("That test slug already exists.");

  const draft = await generateDraft(input.listenRepeatSeed, input.interviewSeed);
  const runId = randomUUID();
  const prefix = `speaking-tests/${input.slug}/${runId}`;
  const warnings: FactoryWarning[] = [];

  const listenVisualPrompt = `Create one clear landscape contextual illustration for English listening practice.
Setting and action plan: ${draft.listenRepeat.visualPrompt}
Composition requirements: one coherent place shown as a wide scene with 4-6 distinct but naturally connected zones/actions; realistic proportions; diverse adult university/community participants; visually calm; no split-screen borders.
Absolutely no readable text, letters, numbers, signs, captions, logos, clocks with readable numbers, schedules, rules, brand marks, speech bubbles, or watermarks. Do not encode the exact sentences as visual answers.`;

  const interviewerPrompt = `Professional synthetic practice-test interviewer portrait. A friendly adult university researcher seated in a simple neutral academic office, looking directly at the camera, centered medium close-up, shoulders visible, calm attentive expression, natural studio lighting, realistic but clearly generic person, uncluttered background, no logos, no text, no watermark. This person must not resemble a celebrity or public figure.`;

  const [listenImageBytes, interviewerImageBytes] = await Promise.all([
    generateImage(listenVisualPrompt, "1536x1024"),
    generateImage(interviewerPrompt, "1024x1024"),
  ]);

  const [listenImageAsset, interviewerImageAsset] = await Promise.all([
    persistAsset(database, adminUserId, `${prefix}/listen-repeat/context.png`, listenImageBytes, "image", "image/png", draft.listenRepeat.scenario),
    persistAsset(database, adminUserId, `${prefix}/interview/interviewer.png`, interviewerImageBytes, "image", "image/png", "AI-generated practice interviewer portrait"),
  ]);

  const listenAudioBytes = await inBatches(draft.listenRepeat.sentences, 4, (sentence) =>
    generateSpeech(
      sentence,
      process.env.TOEFL_FACTORY_LISTEN_VOICE || "marin",
      "Speak as a clear university staff member in natural North American English. Neutral, calm, and conversational. Use a moderate TOEFL-style listening pace. Do not add or omit any words.",
    ),
  );

  const interviewAudioBytes = await inBatches(draft.interview.questions, 4, (question) =>
    generateSpeech(
      question.text,
      process.env.TOEFL_FACTORY_INTERVIEW_VOICE || "cedar",
      "Speak as a friendly academic researcher conducting a structured interview. Natural North American English, warm but neutral, moderate pace. Read the question exactly and do not add commentary.",
    ),
  );

  const listenAudioAssets = await Promise.all(listenAudioBytes.map((bytes, index) =>
    persistAsset(database, adminUserId, `${prefix}/listen-repeat/${index + 1}.mp3`, bytes, "audio", "audio/mpeg", `Listen & Repeat sentence ${index + 1}`),
  ));
  const interviewAudioAssets = await Promise.all(interviewAudioBytes.map((bytes, index) =>
    persistAsset(database, adminUserId, `${prefix}/interview/${index + 1}.mp3`, bytes, "audio", "audio/mpeg", `Interview question ${index + 1}`),
  ));

  let videoAssets: Array<StoredAsset | null> = draft.interview.questions.map(() => null);
  if (input.generateVideo) {
    if (!didAuthorization()) {
      warnings.push({
        code: "video_provider_missing",
        message: "DID_API_KEY is not configured. The draft has interviewer audio and portrait media, but talking-head clips are still pending.",
      });
    } else {
      const videoBytes = await generateInterviewVideos(interviewerImageAsset.storage_path, draft.interview.questions);
      videoAssets = await Promise.all(videoBytes.map(async (bytes, index) => {
        if (!bytes) return null;
        return persistAsset(
          database,
          adminUserId,
          `${prefix}/interview/${index + 1}.mp4`,
          bytes,
          "video",
          "video/mp4",
          `AI interviewer question ${index + 1}`,
        );
      }));
      if (videoAssets.some((asset) => asset === null)) {
        warnings.push({
          code: "video_render_partial",
          message: "One or more interviewer clips did not finish. Use Retry interview videos before publishing.",
        });
      }
    }
  } else {
    warnings.push({
      code: "video_skipped",
      message: "Talking-head video generation was skipped. The draft cannot be published until all four interview clips exist.",
    });
  }

  const setId = randomUUID();
  const listenSectionId = randomUUID();
  const interviewSectionId = randomUUID();
  const listenQuestionIds = draft.listenRepeat.sentences.map(() => randomUUID());
  const interviewQuestionIds = draft.interview.questions.map(() => randomUUID());
  const hasAllVideos = videoAssets.every((asset) => asset !== null);

  const { error: setError } = await database.from("speaking_question_sets").insert({
    id: setId,
    slug: input.slug,
    title: input.title,
    description: `AI-authored 2026+ Speaking practice set: ${draft.listenRepeat.title} + ${draft.interview.topic}.`,
    format_version: "speaking-2026",
    is_published: false,
    created_by: adminUserId,
    generation_status: hasAllVideos ? "ready" : "media_pending",
    generation_metadata: {
      factory_version: FACTORY_VERSION,
      generated_at: new Date().toISOString(),
      storage_prefix: prefix,
      listen_repeat_seed: input.listenRepeatSeed,
      interview_seed: input.interviewSeed,
      did_requested: input.generateVideo,
      did_configured: Boolean(didAuthorization()),
      warnings,
    },
  });
  if (setError) throw new Error("Could not create the generated test set.");

  try {
    const { error: sectionError } = await database.from("speaking_test_sections").insert([
      {
        id: listenSectionId,
        question_set_id: setId,
        question_type: "listen_repeat",
        position: 1,
        title: "Listen and Repeat",
        directions: "Listen to each sentence once. Then repeat exactly what you heard.",
        preparation_seconds: 0,
        response_seconds: 12,
        required_question_count: 7,
        visual_asset_id: listenImageAsset.id,
      },
      {
        id: interviewSectionId,
        question_set_id: setId,
        question_type: "interview",
        position: 2,
        title: "Take an Interview",
        directions: "Listen to the interviewer. Answer each question in English. You have 45 seconds for each response.",
        preparation_seconds: 0,
        response_seconds: 45,
        required_question_count: 4,
        visual_asset_id: interviewerImageAsset.id,
      },
    ]);
    if (sectionError) throw new Error("Could not create the two Speaking sections.");

    const listenRows = draft.listenRepeat.sentences.map((sentence, index) => ({
      id: listenQuestionIds[index],
      question_type: "listen_repeat",
      topic: draft.listenRepeat.title,
      prompt: "",
      scenario: draft.listenRepeat.scenario,
      image_asset_id: listenImageAsset.id,
      audio_asset_id: listenAudioAssets[index].id,
      video_asset_id: null,
      created_by: adminUserId,
    }));
    const interviewRows = draft.interview.questions.map((question, index) => ({
      id: interviewQuestionIds[index],
      question_type: "interview",
      topic: draft.interview.topic,
      prompt: question.text,
      scenario: draft.interview.context,
      image_asset_id: interviewerImageAsset.id,
      audio_asset_id: interviewAudioAssets[index].id,
      video_asset_id: videoAssets[index]?.id ?? null,
      created_by: adminUserId,
    }));

    const { error: questionError } = await database.from("speaking_question_bank").insert([...listenRows, ...interviewRows]);
    if (questionError) throw new Error("Could not save generated questions.");

    const privateRows = [
      ...draft.listenRepeat.sentences.map((sentence, index) => ({
        question_id: listenQuestionIds[index],
        expected_transcript: sentence,
        scoring_notes: { repeat_accuracy_priority: true, position: index + 1 },
        internal_notes: `Factory ${FACTORY_VERSION}; ${draft.listenRepeat.scenario}`,
      })),
      ...draft.interview.questions.map((question, index) => ({
        question_id: interviewQuestionIds[index],
        expected_transcript: null,
        scoring_notes: { interview_stage: question.stage, position: index + 1 },
        internal_notes: `Factory ${FACTORY_VERSION}; ${draft.interview.context}`,
      })),
    ];
    const { error: privateError } = await database.from("speaking_question_private").insert(privateRows);
    if (privateError) throw new Error("Could not save private question metadata.");

    const links = [
      ...listenQuestionIds.map((questionId, index) => ({ section_id: listenSectionId, question_id: questionId, position: index + 1 })),
      ...interviewQuestionIds.map((questionId, index) => ({ section_id: interviewSectionId, question_id: questionId, position: index + 1 })),
    ];
    const { error: linkError } = await database.from("speaking_section_questions").insert(links);
    if (linkError) throw new Error("Could not assemble generated questions into sections.");
  } catch (cause) {
    await database.from("speaking_question_bank").delete().in("id", [...listenQuestionIds, ...interviewQuestionIds]);
    await database.from("speaking_question_sets").delete().eq("id", setId);
    throw cause;
  }

  return { setId, draft, warnings, hasAllVideos };
}

async function getSetLayout(setId: string) {
  const database = admin();
  const { data: set } = await database
    .from("speaking_question_sets")
    .select("id, format_version, is_published, generation_metadata")
    .eq("id", setId)
    .maybeSingle();
  if (!set) throw new Error("Test set not found.");

  const { data: sections } = await database
    .from("speaking_test_sections")
    .select("id, question_type, position, required_question_count, visual_asset_id")
    .eq("question_set_id", setId)
    .order("position");
  if (!sections) throw new Error("Could not load test sections.");

  const sectionIds = sections.map((section) => section.id);
  const { data: links } = sectionIds.length
    ? await database.from("speaking_section_questions").select("section_id, question_id, position").in("section_id", sectionIds)
    : { data: [] as Array<{ section_id: string; question_id: string; position: number }> };

  const questionIds = (links ?? []).map((link) => link.question_id);
  const { data: questions } = questionIds.length
    ? await database.from("speaking_question_bank").select("id, question_type, prompt, audio_asset_id, video_asset_id").in("id", questionIds)
    : { data: [] as Array<{ id: string; question_type: string; prompt: string; audio_asset_id: string | null; video_asset_id: string | null }> };

  return { database, set, sections, links: links ?? [], questions: questions ?? [] };
}

async function publishFactorySet(setId: string, published: boolean) {
  const { database, set, sections, links, questions } = await getSetLayout(setId);

  if (!published) {
    const { error } = await database
      .from("speaking_question_sets")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", setId);
    if (error) throw new Error("Could not unpublish the set.");
    return;
  }

  if (set.format_version !== "speaking-2026") throw new Error("Only speaking-2026 sets can be published from Test Center.");
  if (sections.length !== 2) throw new Error("A 2026 Speaking test must contain exactly two sections.");

  const listenSection = sections.find((section) => section.position === 1 && section.question_type === "listen_repeat");
  const interviewSection = sections.find((section) => section.position === 2 && section.question_type === "interview");
  if (!listenSection || !interviewSection) throw new Error("Section 1 must be Listen & Repeat and section 2 must be Take an Interview.");
  if (listenSection.required_question_count !== 7 || interviewSection.required_question_count !== 4) {
    throw new Error("The 2026 format requires exactly 7 Listen & Repeat and 4 Interview questions.");
  }
  if (!listenSection.visual_asset_id || !interviewSection.visual_asset_id) {
    throw new Error("Both sections need their contextual visual before publishing.");
  }

  const listenLinks = links.filter((link) => link.section_id === listenSection.id);
  const interviewLinks = links.filter((link) => link.section_id === interviewSection.id);
  if (listenLinks.length !== 7 || interviewLinks.length !== 4) throw new Error("The set must contain exactly 11 linked questions (7 + 4).");

  const byId = new Map(questions.map((question) => [question.id, question]));
  if (listenLinks.some((link) => byId.get(link.question_id)?.question_type !== "listen_repeat" || !byId.get(link.question_id)?.audio_asset_id)) {
    throw new Error("Every Listen & Repeat item needs its generated audio.");
  }
  if (interviewLinks.some((link) => byId.get(link.question_id)?.question_type !== "interview" || !byId.get(link.question_id)?.audio_asset_id)) {
    throw new Error("Every Interview item needs its generated audio.");
  }
  if (interviewLinks.some((link) => !byId.get(link.question_id)?.video_asset_id)) {
    throw new Error("Every Interview item needs a talking-interviewer video before publishing.");
  }

  const { error } = await database
    .from("speaking_question_sets")
    .update({
      is_published: true,
      generation_status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", setId);
  if (error) throw new Error("Could not publish the set.");
}

async function retryInterviewVideos(adminUserId: string, setId: string) {
  if (!didAuthorization()) throw new Error("DID_API_KEY is not configured.");

  const { database, set, sections, links, questions } = await getSetLayout(setId);
  const interviewSection = sections.find((section) => section.position === 2 && section.question_type === "interview");
  if (!interviewSection?.visual_asset_id) throw new Error("The interview section has no interviewer portrait.");

  const { data: portrait } = await database
    .from("speaking_question_assets")
    .select("storage_path")
    .eq("id", interviewSection.visual_asset_id)
    .maybeSingle();
  if (!portrait?.storage_path) throw new Error("Could not locate the interviewer portrait.");

  const interviewLinks = links
    .filter((link) => link.section_id === interviewSection.id)
    .sort((a, b) => a.position - b.position);
  const byId = new Map(questions.map((question) => [question.id, question]));
  const pending = interviewLinks
    .map((link) => ({ link, question: byId.get(link.question_id) }))
    .filter((item) => item.question && !item.question.video_asset_id);

  if (pending.length === 0) return { rendered: 0, remaining: 0 };

  const prefix = isRecord(set.generation_metadata) && typeof set.generation_metadata.storage_prefix === "string"
    ? set.generation_metadata.storage_prefix
    : `speaking-tests/retry/${setId}/${randomUUID()}`;

  const videoBuffers = await Promise.all(pending.map(async (item) => {
    try {
      return await renderDidTalk(portrait.storage_path, item.question!.prompt);
    } catch (cause) {
      console.error("[speaking-factory] video retry failed", cause instanceof Error ? cause.message : cause);
      return null;
    }
  }));

  let rendered = 0;
  for (let index = 0; index < pending.length; index += 1) {
    const bytes = videoBuffers[index];
    if (!bytes) continue;
    const position = pending[index].link.position;
    const asset = await persistAsset(
      database,
      adminUserId,
      `${prefix}/interview/retry-${position}-${randomUUID()}.mp4`,
      bytes,
      "video",
      "video/mp4",
      `AI interviewer question ${position}`,
    );
    const { error } = await database
      .from("speaking_question_bank")
      .update({ video_asset_id: asset.id, updated_at: new Date().toISOString() })
      .eq("id", pending[index].question!.id);
    if (!error) rendered += 1;
  }

  const refreshed = await getSetLayout(setId);
  const refreshedInterview = refreshed.sections.find((section) => section.position === 2 && section.question_type === "interview");
  const refreshedIds = refreshed.links.filter((link) => link.section_id === refreshedInterview?.id).map((link) => link.question_id);
  const refreshedById = new Map(refreshed.questions.map((question) => [question.id, question]));
  const remaining = refreshedIds.filter((id) => !refreshedById.get(id)?.video_asset_id).length;

  await database
    .from("speaking_question_sets")
    .update({
      generation_status: remaining === 0 ? "ready" : "media_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", setId);

  return { rendered, remaining };
}

export async function GET() {
  const adminUserId = await requireAdmin();
  if (!adminUserId) return noStore({ error: "Administrator access is required." }, 403);

  return noStore({
    factoryVersion: FACTORY_VERSION,
    providers: {
      openai: Boolean(getOpenAIKey()),
      interviewerVideo: Boolean(didAuthorization()),
      interviewerVideoProvider: "D-ID",
    },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return noStore({ error: "Invalid request origin." }, 403);

  const adminUserId = await requireAdmin();
  if (!adminUserId) return noStore({ error: "Administrator access is required." }, 403);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!isRecord(parsed)) return noStore({ error: "Invalid factory request." }, 400);
    body = parsed;
  } catch {
    return noStore({ error: "Invalid factory request." }, 400);
  }

  const action = cleanString(body.action, 80);

  try {
    if (action === "generate") {
      const title = cleanString(body.title, 140);
      const slug = cleanString(body.slug, 80);
      const listenRepeatSeed = cleanString(body.listenRepeatSeed, 500);
      const interviewSeed = cleanString(body.interviewSeed, 500);
      const generateVideo = body.generateVideo !== false;

      if (!title || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return noStore({ error: "Provide a title and a lowercase hyphenated slug." }, 400);
      }
      if (!getOpenAIKey()) return noStore({ error: "OPENAI_API_KEY is not configured for the factory." }, 503);

      const result = await createFactorySet(adminUserId, {
        title,
        slug,
        listenRepeatSeed,
        interviewSeed,
        generateVideo,
      });
      return noStore(result, 201);
    }

    if (action === "publish") {
      const setId = cleanString(body.setId, 80);
      if (!setId) return noStore({ error: "A test set is required." }, 400);
      await publishFactorySet(setId, body.published === true);
      return noStore({ ok: true });
    }

    if (action === "retry-videos") {
      const setId = cleanString(body.setId, 80);
      if (!setId) return noStore({ error: "A test set is required." }, 400);
      const result = await retryInterviewVideos(adminUserId, setId);
      return noStore(result);
    }

    return noStore({ error: "Unsupported factory action." }, 400);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The Speaking factory failed.";
    console.error("[speaking-factory]", message);
    return noStore({ error: message }, 500);
  }
}
