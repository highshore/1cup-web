import "server-only";

import { GoogleAuth } from "google-auth-library";

import { admin, createServerClientRSC } from "../../../supabase/server";
import {
  SPEAKING_TEST_CATEGORIES,
  type AdminExamAttempt,
  type DeployedExam,
  type DeployedExamDetail,
  type ExamModule,
  type RubricDimension,
  type SpeakingTestAttempt,
  type SpeakingTestCategory,
  type SpeakingTestReport,
  type TaskScore,
} from "../types";

const AUDIO_BUCKET = "speaking-test-audio";
const TRANSCRIPTION_MODEL = process.env.VERTEX_SPEAKING_TRANSCRIPTION_MODEL || "gemini-3.5-flash";
const SCORING_MODEL = process.env.VERTEX_SPEAKING_SCORING_MODEL || "gemini-3.8-flash";
const VERTEX_PROJECT = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "";
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || "global";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UnknownRecord = Record<string, unknown>;
type Member = { uid: string; authId: string; displayName: string; email: string | null };
type SubmittedAudio = { itemId: string; audioPath: string; audioMimeType: string; durationSeconds: number };
type PrivateExamItem = {
  id: string;
  module: ExamModule;
  position: number;
  label: string;
  prompt: string;
  response_seconds: number;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, maximum = 10_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function asNumber(value: unknown, minimum: number, maximum: number, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function validCategory(value: unknown): value is SpeakingTestCategory {
  return typeof value === "string" && (SPEAKING_TEST_CATEGORIES as readonly string[]).includes(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function categories(value: unknown): SpeakingTestCategory[] {
  return Array.isArray(value) ? value.filter(validCategory) : [];
}

function publicItem(item: UnknownRecord): DeployedExamDetail["items"][number] {
  const module: ExamModule = item.module === "listen_repeat" ? "listen_repeat" : "interview";
  return {
    id: String(item.id),
    module,
    position: Number(item.position),
    label: asString(item.label, 160),
    // The Listen & Repeat source sentence is intentionally withheld from the
    // browser. It is supplied to the scorer privately after the recording.
    prompt: module === "interview" ? asString(item.prompt, 2_000) : null,
    responseSeconds: Number(item.response_seconds),
    audioUrl: typeof item.audio_url === "string" ? item.audio_url : null,
    imageUrl: typeof item.image_url === "string" ? item.image_url : null,
    videoUrl: typeof item.video_url === "string" ? item.video_url : null,
  };
}

function toExamListItem(set: UnknownRecord, items: UnknownRecord[]): DeployedExam {
  return {
    id: String(set.id),
    title: asString(set.title, 140),
    categories: categories(set.deployment_categories),
    taskCount: items.length,
    listenRepeatCount: items.filter((item) => item.module === "listen_repeat").length,
    interviewCount: items.filter((item) => item.module === "interview").length,
    publishedAt: typeof set.published_at === "string" ? set.published_at : null,
  };
}

async function currentMember(): Promise<Member | null> {
  const session = await createServerClientRSC();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;

  const { data, error } = await admin()
    .from("users")
    .select("uid, auth_id, display_name, email")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (error || !data?.uid || !data.auth_id) return null;
  return {
    uid: data.uid,
    authId: data.auth_id,
    displayName: data.display_name || "Member",
    email: data.email || user.email || null,
  };
}

export async function requireSpeakingTestMember() {
  const member = await currentMember();
  if (!member) throw new Error("Please sign in to start a speaking test.");
  return member;
}

export async function getDeployedExams(category: SpeakingTestCategory): Promise<DeployedExam[]> {
  const database = admin();
  const { data: sets, error } = await database
    .from("exam_sets")
    .select("id, title, deployment_categories, published_at")
    .eq("status", "published")
    .eq("is_deployed", true)
    .contains("deployment_categories", [category])
    .order("deployed_at", { ascending: false });
  if (error) throw new Error("Deployed tests could not be loaded.");
  if (!sets?.length) return [];

  const { data: allItems, error: itemError } = await database
    .from("exam_set_items")
    .select("exam_set_id, module")
    .in("exam_set_id", sets.map((set) => set.id));
  if (itemError) throw new Error("Deployed tests could not be loaded.");

  return sets.map((set) => toExamListItem(
    set as UnknownRecord,
    (allItems ?? []).filter((item) => item.exam_set_id === set.id) as UnknownRecord[],
  ));
}

export async function getDeployedExam(examSetId: string): Promise<DeployedExamDetail | null> {
  if (!validUuid(examSetId)) return null;
  const database = admin();
  const { data: set, error } = await database
    .from("exam_sets")
    .select("id, title, deployment_categories, published_at, illustration_url, interviewer_id")
    .eq("id", examSetId)
    .eq("status", "published")
    .eq("is_deployed", true)
    .maybeSingle();
  if (error) throw new Error("The selected test could not be loaded.");
  if (!set) return null;

  const [itemsResult, interviewerResult] = await Promise.all([
    database
      .from("exam_set_items")
      .select("id, module, position, label, prompt, response_seconds, audio_url, image_url, video_url")
      .eq("exam_set_id", examSetId)
      .order("module")
      .order("position"),
    database
      .from("exam_interviewers")
      .select("name, image_url")
      .eq("id", set.interviewer_id)
      .maybeSingle(),
  ]);
  if (itemsResult.error || interviewerResult.error) throw new Error("The selected test could not be loaded.");

  const items = (itemsResult.data ?? []) as UnknownRecord[];
  if (items.length === 0) return null;
  return {
    ...toExamListItem(set as UnknownRecord, items),
    interviewerName: interviewerResult.data?.name || "Interviewer",
    interviewerImageUrl: interviewerResult.data?.image_url || null,
    illustrationUrl: set.illustration_url || null,
    items: items.map(publicItem),
  };
}

export async function createSpeakingAttempt(examSetId: string) {
  const member = await requireSpeakingTestMember();
  const exam = await getDeployedExam(examSetId);
  if (!exam) throw new Error("This test is no longer available.");

  const { data, error } = await admin()
    .from("exam_attempts")
    .insert({ exam_set_id: exam.id, user_id: member.uid, status: "in_progress" })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error("We could not start this test.");
  return { attemptId: data.id as string, uploadPrefix: member.authId + "/" + data.id };
}

function normalizeSubmission(value: unknown, member: Member, attemptId: string): SubmittedAudio | null {
  if (!isRecord(value) || !validUuid(value.itemId)) return null;
  const audioPath = asString(value.audioPath, 600);
  const audioMimeType = asString(value.audioMimeType, 120).toLowerCase();
  const safePath = new RegExp("^" + member.authId + "/" + attemptId + "/" + value.itemId + "\\.(webm|mp4|mpeg|ogg|wav)$", "i");
  if (!safePath.test(audioPath)) return null;
  if (!new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"]).has(audioMimeType)) return null;
  return {
    itemId: value.itemId,
    audioPath,
    audioMimeType,
    durationSeconds: asNumber(value.durationSeconds, 0, 180),
  };
}

function buildGoogleAuth() {
  const clientEmail = process.env.VERTEX_AI_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.VERTEX_AI_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  return new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    ...(clientEmail && privateKey
      ? { credentials: { client_email: clientEmail, private_key: privateKey.replace(/\\n/g, "\n") } }
      : {}),
  });
}

async function callVertexJson(model: string, parts: UnknownRecord[], maximumTokens: number) {
  if (!VERTEX_PROJECT) throw new Error("Speaking assessment is temporarily unavailable.");
  const token = await buildGoogleAuth().getAccessToken();
  if (!token) throw new Error("Speaking assessment is temporarily unavailable.");
  const endpoint = "https://aiplatform.googleapis.com/v1/projects/" + encodeURIComponent(VERTEX_PROJECT)
    + "/locations/" + encodeURIComponent(VERTEX_LOCATION)
    + "/publishers/google/models/" + encodeURIComponent(model) + ":generateContent";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: maximumTokens,
      },
    }),
  });
  const payload = await response.json().catch(() => ({})) as UnknownRecord;
  if (!response.ok) {
    console.error("[speaking-test] Vertex request failed", response.status);
    throw new Error("The scoring service is temporarily unavailable.");
  }
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const responseText = candidates
    .flatMap((candidate) => isRecord(candidate) && isRecord(candidate.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : [])
    .map((part) => isRecord(part) ? asString(part.text, 100_000) : "")
    .join("")
    .trim();
  if (!responseText) throw new Error("The scoring service returned no result.");
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw new Error("The scoring service returned an invalid result.");
  }
}

async function audioPart(path: string, mimeType: string) {
  const { data, error } = await admin().storage.from(AUDIO_BUCKET).download(path);
  if (error || !data) throw new Error("One or more recordings could not be found. Please record the test again.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > 25 * 1024 * 1024) {
    throw new Error("One or more recordings are invalid. Please record the test again.");
  }
  return { inlineData: { mimeType, data: bytes.toString("base64") } };
}

async function transcribeResponse(audio: UnknownRecord, task: PrivateExamItem) {
  const result = await callVertexJson(TRANSCRIPTION_MODEL, [
    audio,
    {
      text: "Transcribe this single English speaking-test response for task " + task.position
        + '. Return only JSON in this exact shape: {"transcript":"string"}. Preserve the speaker\'s words. Do not score, correct, summarize, or add notes. If no intelligible speech is present, return an empty transcript.',
    },
  ], 2_000);
  if (!isRecord(result)) throw new Error("A recording could not be transcribed.");
  return asString(result.transcript, 12_000);
}

function dimension(value: unknown, fallback: number): RubricDimension {
  const source = isRecord(value) ? value : {};
  return {
    score: Math.round(asNumber(source.score, 0, 5, fallback) * 100) / 100,
    evidence: asString(source.evidence, 800),
  };
}

function normalizedDimensions(value: unknown, module: ExamModule, fallback: number) {
  const source = isRecord(value) ? value : {};
  const keys = module === "listen_repeat"
    ? ["fluency", "intelligibility", "repeatAccuracy"]
    : ["fluency", "intelligibility", "languageUse", "organization"];
  return Object.fromEntries(keys.map((key) => [key, dimension(source[key], fallback)]));
}

function taskScoreFromModel(value: unknown, task: PrivateExamItem): TaskScore {
  if (!isRecord(value)) throw new Error("The scorer did not return every task result.");
  const score = Math.round(asNumber(value.score, 0, 5, -1) * 100) / 100;
  const evidence = asString(value.evidence, 1_000);
  const rationale = asString(value.rationale, 1_200);
  const feedback = asString(value.feedback, 1_000);
  if (score < 0 || !evidence || !rationale || !feedback) throw new Error("The scorer returned an incomplete task result.");
  return {
    itemId: task.id,
    taskNumber: task.position,
    module: task.module,
    score,
    rubricScores: normalizedDimensions(value.rubricScores, task.module, score),
    evidence,
    rationale,
    feedback,
  };
}

function bandForRawScore(rawScore: number) {
  const band = Math.max(1, Math.min(6, Math.round((1 + (rawScore / 55) * 5) * 2) / 2));
  const cefr = band >= 6 ? "C2" : band >= 5 ? "C1" : band >= 4 ? "B2" : band >= 3 ? "B1" : band >= 2 ? "A2" : "A1";
  return { band: band.toFixed(1), cefr };
}

async function scoreAttempt(tasks: PrivateExamItem[], transcriptRows: Array<{ task: PrivateExamItem; transcript: string; audio: UnknownRecord; durationSeconds: number }>) {
  const taskContext = transcriptRows.map(({ task, transcript, durationSeconds }) => ({
    taskNumber: task.position,
    itemId: task.id,
    taskType: task.module === "listen_repeat" ? "Listen and Repeat" : "Take an Interview",
    expectedPrompt: task.module === "listen_repeat" ? task.prompt : undefined,
    interviewQuestion: task.module === "interview" ? task.prompt : undefined,
    responseSeconds: task.response_seconds,
    recordedDurationSeconds: durationSeconds,
    transcript,
  }));
  const scoringPrompt = [
    "You are scoring a TOEFL iBT Speaking practice test using the supplied 2026 task rubrics. Score only the attached audio, the supplied transcripts, timings, and task context. Do not claim ETS affiliation or an official result. Do not expose hidden reasoning; give concise, evidence-based scoring rationales instead.",
    "",
    "Listen and Repeat: score 0-5. Consider Fluency, Intelligibility, and Repeat Accuracy against the expected sentence. A 5 is fully intelligible and exact; a 4 retains meaning with minor changes; a 3 is substantially complete but meaning is inaccurate; a 2 misses a significant portion; a 1 is minimal/mostly unintelligible; 0 is no usable response.",
    "",
    "Take an Interview: score 0-5. Consider Fluency, Intelligibility, Language Use, and Organization. A 5 is on topic, well elaborated, natural paced and easily intelligible, with accurate varied language. A 4 is generally successful with adequate language and some minor pauses. A 3 is partially successful with limited elaboration, frequent pauses/fillers, or limited language. A 2 is minimally connected with little elaboration. A 1 is vague/mostly unintelligible. 0 is no usable response.",
    "",
    'Return only valid JSON with this exact shape: {"summary":"string","overallRationale":"string","strengths":["string","string","string"],"focusAreas":["string","string","string"],"taskScores":[{"taskNumber":number,"score":number,"rubricScores":{"fluency":{"score":number,"evidence":"string"},"intelligibility":{"score":number,"evidence":"string"},"repeatAccuracy":{"score":number,"evidence":"string"},"languageUse":{"score":number,"evidence":"string"},"organization":{"score":number,"evidence":"string"}},"evidence":"string","rationale":"string","feedback":"string"}]}. Include only relevant dimensions for each task. Every task needs a score, evidence, rationale, and feedback. Rationale must directly explain why that score was assigned with observable evidence; never state that it is model reasoning.',
    "",
    "Task context follows:",
    JSON.stringify(taskContext),
  ].join("\n");
  const parts: UnknownRecord[] = [{ text: scoringPrompt }];
  transcriptRows.forEach(({ task, audio }) => {
    parts.push({ text: "Audio recording for task " + task.position + " (" + task.module + ")." }, audio);
  });
  const result = await callVertexJson(SCORING_MODEL, parts, 12_000);
  if (!isRecord(result) || !Array.isArray(result.taskScores)) throw new Error("The scorer returned an incomplete report.");
  const byTask = new Map(result.taskScores.filter(isRecord).map((entry) => [Number(entry.taskNumber), entry]));
  const taskScores = tasks.map((task) => taskScoreFromModel(byTask.get(task.position), task));
  const rawScore = Math.round(taskScores.reduce((total, task) => total + task.score, 0) * 100) / 100;
  const band = bandForRawScore(rawScore);
  const strengths = Array.isArray(result.strengths) ? result.strengths.map((item) => asString(item, 300)).filter(Boolean).slice(0, 3) : [];
  const focusAreas = Array.isArray(result.focusAreas) ? result.focusAreas.map((item) => asString(item, 300)).filter(Boolean).slice(0, 3) : [];
  if (!asString(result.summary, 1_500) || !asString(result.overallRationale, 1_500) || strengths.length < 3 || focusAreas.length < 3) {
    throw new Error("The scorer returned an incomplete report.");
  }
  return {
    overall: {
      rawScore,
      band: band.band,
      cefr: band.cefr,
      summary: asString(result.summary, 1_500),
      rationale: asString(result.overallRationale, 1_500),
    },
    taskScores,
    strengths,
    focusAreas,
    reportNote: "Practice feedback based on your recorded responses. It is not an official TOEFL or ETS score report.",
  } satisfies SpeakingTestReport;
}

export async function evaluateSpeakingAttempt(attemptId: string, submissions: unknown) {
  const member = await requireSpeakingTestMember();
  if (!validUuid(attemptId)) throw new Error("Invalid speaking-test attempt.");
  const database = admin();
  const { data: attempt, error: attemptError } = await database
    .from("exam_attempts")
    .select("id, exam_set_id, status")
    .eq("id", attemptId)
    .eq("user_id", member.uid)
    .maybeSingle();
  if (attemptError || !attempt) throw new Error("Speaking-test attempt not found.");
  if (attempt.status === "completed") throw new Error("This speaking test has already been scored.");

  const { data: items, error: itemsError } = await database
    .from("exam_set_items")
    .select("id, module, position, label, prompt, response_seconds")
    .eq("exam_set_id", attempt.exam_set_id)
    .order("module")
    .order("position");
  if (itemsError || !items?.length) throw new Error("The test questions could not be loaded.");
  const tasks = items as PrivateExamItem[];
  const submitted = Array.isArray(submissions)
    ? submissions.map((value) => normalizeSubmission(value, member, attemptId)).filter((value): value is SubmittedAudio => Boolean(value))
    : [];
  const submittedByItem = new Map(submitted.map((entry) => [entry.itemId, entry]));
  if (submittedByItem.size !== tasks.length || tasks.some((task) => !submittedByItem.has(task.id))) {
    throw new Error("Please record a response for every task before requesting your score.");
  }

  await database.from("exam_attempts").update({ status: "scoring", failure_reason: null, failed_at: null, updated_at: new Date().toISOString() }).eq("id", attemptId);
  try {
    const transcriptRows = await Promise.all(tasks.map(async (task) => {
      const submittedAudio = submittedByItem.get(task.id)!;
      const audio = await audioPart(submittedAudio.audioPath, submittedAudio.audioMimeType);
      const transcript = await transcribeResponse(audio, task);
      return { task, transcript, audio, durationSeconds: submittedAudio.durationSeconds, submission: submittedAudio };
    }));
    const report = await scoreAttempt(tasks, transcriptRows);
    const scoreByItem = new Map(report.taskScores.map((score) => [score.itemId, score]));
    const responseRows = transcriptRows.map(({ task, transcript, durationSeconds, submission }) => {
      const score = scoreByItem.get(task.id)!;
      return {
        attempt_id: attemptId,
        exam_set_item_id: task.id,
        task_number: task.position,
        module: task.module,
        audio_path: submission.audioPath,
        audio_mime_type: submission.audioMimeType,
        duration_seconds: durationSeconds,
        transcript,
        transcription: { model: TRANSCRIPTION_MODEL },
        task_score: score.score,
        rubric_scores: score.rubricScores,
        score_rationale: score.rationale,
        updated_at: new Date().toISOString(),
      };
    });
    const { error: responseError } = await database
      .from("exam_attempt_responses")
      .upsert(responseRows, { onConflict: "attempt_id,exam_set_item_id" });
    if (responseError) throw new Error("Your recordings were scored but could not be saved.");
    const { error: saveError } = await database
      .from("exam_attempts")
      .update({
        status: "completed",
        response_count: responseRows.length,
        responses: responseRows.map((row) => ({ taskNumber: row.task_number, itemId: row.exam_set_item_id, transcript: row.transcript, durationSeconds: row.duration_seconds })),
        report,
        scoring_metadata: { rubric: "toefl-speaking-2026", rubric_reasoning: "evidence-based", raw_score_maximum: 55 },
        transcription_model: TRANSCRIPTION_MODEL,
        scoring_model: SCORING_MODEL,
        overall_score: report.overall.rawScore,
        overall_band: report.overall.band,
        overall_cefr: report.overall.cefr,
        score_reasoning: report.overall.rationale,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", attemptId);
    if (saveError) throw new Error("Your score could not be saved.");
    return { attemptId, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The score could not be generated.";
    await database
      .from("exam_attempts")
      .update({ status: "failed", failed_at: new Date().toISOString(), failure_reason: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", attemptId);
    throw error;
  }
}

export async function getSpeakingAttemptHistory(): Promise<SpeakingTestAttempt[]> {
  const member = await requireSpeakingTestMember();
  const database = admin();
  const { data: attempts, error } = await database
    .from("exam_attempts")
    .select("id, exam_set_id, status, overall_score, overall_band, overall_cefr, report, completed_at")
    .eq("user_id", member.uid)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Speaking-test history could not be loaded.");
  const setIds = [...new Set((attempts ?? []).map((attempt) => attempt.exam_set_id))];
  const { data: sets } = setIds.length
    ? await database.from("exam_sets").select("id, title").in("id", setIds)
    : { data: [] as Array<{ id: string; title: string }> };
  const titles = new Map((sets ?? []).map((set) => [set.id, set.title]));
  return (attempts ?? []).map((attempt) => ({
    id: attempt.id,
    examSetId: attempt.exam_set_id,
    examTitle: titles.get(attempt.exam_set_id) || "Speaking test",
    status: attempt.status,
    score: attempt.overall_score === null ? null : Number(attempt.overall_score),
    band: attempt.overall_band,
    cefr: attempt.overall_cefr,
    report: (attempt.report as SpeakingTestReport | null) ?? null,
    completedAt: attempt.completed_at,
  })) as SpeakingTestAttempt[];
}

export async function getAdminExamAttemptReviews(examSetId: string): Promise<AdminExamAttempt[]> {
  if (!validUuid(examSetId)) return [];
  const database = admin();
  const { data: attempts, error } = await database
    .from("exam_attempts")
    .select("id, user_id, status, overall_score, overall_band, overall_cefr, report, completed_at")
    .eq("exam_set_id", examSetId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !attempts?.length) return [];
  const attemptIds = attempts.map((attempt) => attempt.id);
  const userIds = [...new Set(attempts.map((attempt) => attempt.user_id))];
  const [responseResult, membersResult] = await Promise.all([
    database
      .from("exam_attempt_responses")
      .select("id, attempt_id, task_number, module, duration_seconds, transcript, task_score, rubric_scores, score_rationale, audio_path")
      .in("attempt_id", attemptIds)
      .order("task_number"),
    database.from("users").select("uid, display_name, email").in("uid", userIds),
  ]);
  if (responseResult.error || membersResult.error) throw new Error("Attempt review could not be loaded.");
  const memberById = new Map((membersResult.data ?? []).map((member) => [member.uid, member]));
  const responsesByAttempt = new Map<string, UnknownRecord[]>();
  (responseResult.data ?? []).forEach((response) => {
    const current = responsesByAttempt.get(response.attempt_id) ?? [];
    current.push(response as UnknownRecord);
    responsesByAttempt.set(response.attempt_id, current);
  });

  return Promise.all(attempts.map(async (attempt) => {
    const member = memberById.get(attempt.user_id);
    const responses = await Promise.all((responsesByAttempt.get(attempt.id) ?? []).map(async (response) => {
      const path = asString(response.audio_path, 600);
      const { data: signed } = path
        ? await database.storage.from(AUDIO_BUCKET).createSignedUrl(path, 60 * 60)
        : { data: null };
      const module: ExamModule = response.module === "listen_repeat" ? "listen_repeat" : "interview";
      return {
        id: String(response.id),
        taskNumber: Number(response.task_number),
        module,
        durationSeconds: Number(response.duration_seconds),
        transcript: asString(response.transcript, 12_000),
        score: response.task_score === null ? null : Number(response.task_score),
        rubricScores: (isRecord(response.rubric_scores) ? response.rubric_scores : {}) as Record<string, RubricDimension>,
        rationale: typeof response.score_rationale === "string" ? response.score_rationale : null,
        audioUrl: signed?.signedUrl || null,
      };
    }));
    return {
      id: attempt.id,
      memberName: member?.display_name || "Member",
      memberEmail: member?.email || null,
      status: attempt.status,
      score: attempt.overall_score === null ? null : Number(attempt.overall_score),
      band: attempt.overall_band,
      cefr: attempt.overall_cefr,
      report: (attempt.report as SpeakingTestReport | null) ?? null,
      completedAt: attempt.completed_at,
      responses,
    } satisfies AdminExamAttempt;
  }));
}
