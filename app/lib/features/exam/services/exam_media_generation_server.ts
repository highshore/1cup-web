import "server-only";

import { GenerateVideosOperation, GoogleGenAI } from "@google/genai";

import { admin } from "../../../supabase/server";
import type { ExamInterviewer, ExamItem, ExamNarration } from "../types";

type Database = ReturnType<typeof admin>;

const EXAM_MEDIA_BUCKET = "exam-pipeline-assets";
const TEXT_MODEL = "gemini-3.1-flash-lite";
const PORTRAIT_MODEL = "gemini-3.1-flash-lite-image";
const ILLUSTRATION_MODEL = "gemini-3.1-flash-image";
const TTS_MODEL = "gemini-3.1-flash-tts-preview";
const VIDEO_MODEL = "veo-3.1-lite-generate-preview";
const TTS_VOICE = "Kore";

export const EXAM_MEDIA_MODELS = {
  planning: TEXT_MODEL,
  portrait: PORTRAIT_MODEL,
  illustration: ILLUSTRATION_MODEL,
  segmentation: "SAM 3",
  narration: TTS_MODEL,
  video: VIDEO_MODEL,
} as const;

type MediaMetadata = Record<string, unknown>;

type GeneratedVideoSource = {
  uri?: string;
  videoBytes?: string;
  mimeType?: string;
};

type Sam3WorkerMask = {
  position?: unknown;
  url?: unknown;
  target?: unknown;
  score?: unknown;
};

type Sam3WorkerResponse = {
  masks?: unknown;
};

const scenePlanSchema = {
  type: "object",
  properties: {
    sceneDescription: { type: "string" },
    targets: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["label", "prompt"],
        additionalProperties: false,
      },
    },
  },
  required: ["sceneDescription", "targets"],
  additionalProperties: false,
} as const;

function asRecord(value: unknown): MediaMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as MediaMetadata : {};
}

function compact(value: unknown, maximum = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function generationMetadata(current: unknown, patch: MediaMetadata) {
  const existing = asRecord(current);
  return {
    ...existing,
    generation: {
      ...asRecord(existing.generation),
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}

function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Media generation is not configured. Add the server-only GEMINI_API_KEY to the production project, then retry.");
  }
  return new GoogleGenAI({ apiKey });
}

function mediaError(stage: string, cause: unknown) {
  console.error(`[exam-media] ${stage} failed`, cause);
  return new Error(`${stage} could not be completed. Check the server media configuration and retry.`);
}

function pngOrJpegMimeType(value: string | null | undefined) {
  const mimeType = value?.split(";", 1)[0]?.toLowerCase();
  return mimeType === "image/png" ? "image/png" : "image/jpeg";
}

function videoMimeType(value: string | undefined) {
  return value === "video/webm" ? "video/webm" : "video/mp4";
}

function audioPath(examSetId: string, kind: "narration" | "listen-repeat", name: string) {
  return `generated/sets/${examSetId}/${kind}/${name}-${crypto.randomUUID()}.wav`;
}

function imagePath(kind: "interviewers" | "sets" | "masks", id: string, extension: "jpg" | "png") {
  return `generated/${kind}/${id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

function videoPath(kind: "interviewers" | "sets", id: string, extension: "mp4" | "webm") {
  return `generated/${kind}/${id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

async function uploadBytes(database: Database, path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await database.storage.from(EXAM_MEDIA_BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("Could not save generated media to durable storage.");
  const { data } = database.storage.from(EXAM_MEDIA_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Generated media was saved but its public URL could not be created.");
  return data.publicUrl;
}

async function fetchBytes(url: string, purpose: "image" | "video" | "mask") {
  let source: URL;
  try {
    source = new URL(url);
  } catch {
    throw new Error(`The generated ${purpose} source is not a valid URL.`);
  }
  if (source.protocol !== "https:") throw new Error(`The generated ${purpose} source must use HTTPS.`);
  const response = await fetch(source, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`The generated ${purpose} source could not be downloaded.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength) throw new Error(`The generated ${purpose} source was empty.`);
  return { bytes, contentType: response.headers.get("content-type") };
}

function wavFromPcm24kMono(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24_000, 24);
  header.writeUInt32LE(48_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function buildInterviewerFramePrompt(interviewer: Pick<ExamInterviewer, "name" | "gender" | "occupation" | "attire" | "personality" | "voice_tone">) {
  return `
PROFILE
Name: ${interviewer.name}
Gender: ${interviewer.gender}
Occupation: ${interviewer.occupation}
Attire: ${interviewer.attire}
Personality: ${interviewer.personality}
Voice tone: ${interviewer.voice_tone}

Depict this exact fictional profile as a professional English interviewer looking directly into camera. Provide a bust shot, from the shoulder-up. The background must be a completely white wall. Centered medium close-up, 16:9 landscape, neutral expression, wear the specified attire, neutral studio background, soft even studio lighting. No text, logos, subtitles, props, or other people.`;
}

function buildInterviewerNoddingPrompt() {
  return "The person gently nods and blinks naturally as if quietly listening. The person does not speak and keeps their lips closed throughout. Keep the camera locked and the white studio background unchanged. No other movement or people.";
}

function buildQuestionVideoPrompt(interviewer: Pick<ExamInterviewer, "name" | "occupation" | "attire" | "personality" | "voice_tone">, script: string) {
  return `Use the supplied profile image as the exact first and last frame. Preserve the same fictional person, clothing, centered shoulder-up framing, white studio wall, lighting, and neutral end pose.

CHARACTER: A fictional adult English interviewer. ${interviewer.personality} and professional; occupation ${interviewer.occupation}; attire ${interviewer.attire}; voice ${interviewer.voice_tone}. Do not identify, name, imitate, or refer to any real person.

The interviewer looks into camera and asks exactly this question once: "${script}"

Use a natural, clear English speaking voice with matching lip movement. Only the interviewer speaks. No music, soundtrack, singing, ambient noise, sound effects, captions, text, cuts, camera movement, additional words, omissions, or paraphrasing.`;
}

function buildScenePlanPrompt(theme: string, sentences: string[]) {
  return `Return JSON only: {"sceneDescription":"...","targets":[{"label":"...","prompt":"..."}]}. Create one visual authoring plan for a Listen and Repeat English-speaking test section.

THEME: ${theme}

The illustration must visibly and naturally encompass every one of these seven sentences. For every sentence, provide one distinct, concrete, separately visible subject, object, action, or place that SAM 3 can isolate with a short text prompt. The target must represent the sentence's central visual meaning, not a generic background object. Keep every target unique, physically plausible, and visually separated from the other targets. Avoid vague prompts, pronouns, abstract ideas, text-only targets, and targets requiring words inside the illustration. Scene description: 70–150 words. Each label: 2–8 words. Each prompt: 2–12 words.

SENTENCES:
${sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join("\n")}`;
}

function buildSceneIllustrationPrompt(theme: string, sentences: string[], plan: { sceneDescription: string; targets: Array<{ label: string; prompt: string }> }) {
  return `Create one completely new, polished editorial illustration for an English-language Listen and Repeat test. Use a sophisticated textbook and standardized-test visual language: precise ink-like line drawing, subtle pencil-like shading, realistic simplified anatomy, a coherent three-quarter slightly elevated perspective, clean architectural perspective, and a restrained mostly grayscale, low-saturation palette with selective color only where it improves recognition. It must look professionally commissioned, not like clip art, a photo, a 3D render, a PowerPoint slide, or an infographic.

SCENE: ${plan.sceneDescription}
THEME: ${theme}

All seven source sentences must be represented in this one coherent scene:
${sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join("\n")}

Include these seven distinct, separately visible semantic targets, leaving enough clear space around each for downstream object segmentation:
${plan.targets.map((target, index) => `${index + 1}. ${target.prompt}`).join("\n")}

No text, captions, speech bubbles, labels, callouts, colored highlights, masks, bounding boxes, UI, logos, watermarks, or alternate variants. The delivered image must be the clean, unmasked master illustration.`;
}

async function generateImage(prompt: string, model: typeof PORTRAIT_MODEL | typeof ILLUSTRATION_MODEL, aspectRatio: "16:9" | "4:3", imageSize: "1K" | "2K") {
  if (model === ILLUSTRATION_MODEL) {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        model,
        input: [{ type: "text", text: prompt }],
        response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: aspectRatio, image_size: imageSize },
      }),
    });
    const payload = await response.json().catch(() => ({})) as {
      output_image?: { data?: string; mime_type?: string };
      steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string; mime_type?: string }> }>;
    };
    if (!response.ok) throw new Error("Nano Banana did not return an illustration.");
    const image = payload.output_image?.data
      ? payload.output_image
      : payload.steps?.flatMap((step) => step.type === "model_output" ? step.content ?? [] : []).find((part) => part.type === "image" && part.data);
    if (!image?.data) throw new Error("Nano Banana did not return an illustration image.");
    return { bytes: Buffer.from(image.data, "base64"), mimeType: pngOrJpegMimeType(image.mime_type) };
  }

  const response = await gemini().models.generateContent({
    model,
    contents: prompt,
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio, imageSize } },
  });
  const image = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.inlineData?.data)?.inlineData;
  if (!image?.data) throw new Error("Nano Banana did not return a portrait image.");
  return { bytes: Buffer.from(image.data, "base64"), mimeType: pngOrJpegMimeType(image.mimeType) };
}

async function generateAudio(database: Database, examSetId: string, pathKind: "narration" | "listen-repeat", pathName: string, script: string) {
  const interaction = await gemini().interactions.create({
    model: TTS_MODEL,
    input: script,
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: TTS_VOICE }] },
  });
  const data = interaction.output_audio?.data;
  if (!data) throw new Error("Gemini TTS did not return audio.");
  const wav = wavFromPcm24kMono(Buffer.from(data, "base64"));
  return uploadBytes(database, audioPath(examSetId, pathKind, pathName), wav, "audio/wav");
}

async function startVideo(prompt: string, image: { bytes: Uint8Array; mimeType: string }) {
  const operation = await gemini().models.generateVideos({
    model: VIDEO_MODEL,
    prompt,
    image: { mimeType: image.mimeType, imageBytes: Buffer.from(image.bytes).toString("base64") },
    config: {
      lastFrame: { mimeType: image.mimeType, imageBytes: Buffer.from(image.bytes).toString("base64") },
      aspectRatio: "16:9",
      durationSeconds: 8,
      resolution: "720p",
    },
  });
  if (!operation.name) throw new Error("Veo did not return a video operation.");
  return operation.name;
}

async function getVideoOperation(operationName: string) {
  const reference = new GenerateVideosOperation();
  reference.name = operationName;
  return gemini().operations.getVideosOperation({ operation: reference });
}

async function persistVideo(database: Database, kind: "interviewers" | "sets", id: string, video: GeneratedVideoSource) {
  if (typeof video.videoBytes === "string") {
    const mimeType = videoMimeType(video.mimeType);
    return uploadBytes(database, videoPath(kind, id, mimeType === "video/webm" ? "webm" : "mp4"), Buffer.from(video.videoBytes, "base64"), mimeType);
  }
  if (!video.uri) throw new Error("Veo completed without downloadable video bytes.");
  const { bytes, contentType } = await fetchBytes(video.uri, "video");
  const mimeType = videoMimeType(contentType ?? video.mimeType);
  return uploadBytes(database, videoPath(kind, id, mimeType === "video/webm" ? "webm" : "mp4"), bytes, mimeType);
}

async function ensureInterviewerImage(database: Database, interviewer: ExamInterviewer & { source_metadata?: unknown }) {
  if (interviewer.image_url) {
    const image = await fetchBytes(interviewer.image_url, "image");
    return { ...image, mimeType: pngOrJpegMimeType(image.contentType) };
  }
  const refreshed = await regenerateInterviewerMedia(database, interviewer.id);
  const image = await fetchBytes(refreshed.imageUrl, "image");
  return { ...image, mimeType: pngOrJpegMimeType(image.contentType) };
}

export async function regenerateInterviewerMedia(database: Database, interviewerId: string) {
  if (!isUuid(interviewerId)) throw new Error("Choose a valid interviewer.");
  const { data, error } = await database.from("exam_interviewers").select("*").eq("id", interviewerId).maybeSingle();
  if (error || !data) throw new Error("The interviewer could not be found.");
  const interviewer = data as ExamInterviewer & { source_metadata?: unknown };

  try {
    await database.from("exam_interviewers").update({ image_status: "generating", video_status: "generating", image_error: null, video_error: null, updated_at: new Date().toISOString() }).eq("id", interviewerId);
    const portrait = await generateImage(buildInterviewerFramePrompt(interviewer), PORTRAIT_MODEL, "16:9", "1K");
    const imageUrl = await uploadBytes(database, imagePath("interviewers", interviewerId, portrait.mimeType === "image/png" ? "png" : "jpg"), portrait.bytes, portrait.mimeType);
    const operationName = await startVideo(buildInterviewerNoddingPrompt(), portrait);
    const metadata = generationMetadata(interviewer.source_metadata, {
      models: { portrait: PORTRAIT_MODEL, video: VIDEO_MODEL },
      portrait: { imageUrl, generatedAt: new Date().toISOString() },
      video: { operationName, state: "generating", generatedAt: new Date().toISOString() },
    });
    const { error: updateError } = await database.from("exam_interviewers").update({
      image_url: imageUrl,
      image_status: "ready",
      video_status: "generating",
      media_mode: "generated",
      source_metadata: metadata,
      updated_at: new Date().toISOString(),
    }).eq("id", interviewerId);
    if (updateError) throw new Error("Could not save the new interviewer media state.");
    return { imageUrl, operationName, model: VIDEO_MODEL };
  } catch (cause) {
    await database.from("exam_interviewers").update({ image_status: "failed", video_status: "failed", image_error: "Portrait generation failed.", video_error: "Portrait generation failed.", updated_at: new Date().toISOString() }).eq("id", interviewerId);
    throw mediaError("Interviewer media generation", cause);
  }
}

export async function pollInterviewerVideo(database: Database, interviewerId: string) {
  if (!isUuid(interviewerId)) throw new Error("Choose a valid interviewer.");
  const { data, error } = await database.from("exam_interviewers").select("id, source_metadata, video_status").eq("id", interviewerId).maybeSingle();
  if (error || !data) throw new Error("The interviewer could not be found.");
  const metadata = asRecord(data.source_metadata);
  const generation = asRecord(metadata.generation);
  const video = asRecord(generation.video);
  const operationName = compact(video.operationName, 260);
  if (!operationName) return { status: data.video_status };

  try {
    const operation = await getVideoOperation(operationName);
    if (!operation.done) return { status: "generating" as const };
    if (operation.error) throw new Error("Veo rejected the interviewer video.");
    const generated = operation.response?.generatedVideos?.[0]?.video as GeneratedVideoSource | undefined;
    if (!generated) throw new Error("Veo completed without an interviewer video.");
    const videoUrl = await persistVideo(database, "interviewers", interviewerId, generated);
    const nextMetadata = generationMetadata(metadata, {
      video: { operationName: null, state: "ready", videoUrl, completedAt: new Date().toISOString(), model: VIDEO_MODEL },
    });
    const { error: updateError } = await database.from("exam_interviewers").update({
      video_url: videoUrl,
      video_status: "ready",
      video_error: null,
      media_mode: "generated",
      source_metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    }).eq("id", interviewerId);
    if (updateError) throw new Error("Could not save the interviewer video.");
    return { status: "ready" as const, videoUrl };
  } catch (cause) {
    await database.from("exam_interviewers").update({ video_status: "failed", video_error: "Veo could not complete the interviewer video.", updated_at: new Date().toISOString() }).eq("id", interviewerId);
    throw mediaError("Interviewer video generation", cause);
  }
}

export async function regenerateNarrationMedia(database: Database, narrationId: string) {
  if (!isUuid(narrationId)) throw new Error("Choose a valid narration cue.");
  const { data, error } = await database.from("exam_set_narration").select("*").eq("id", narrationId).maybeSingle();
  if (error || !data) throw new Error("The narration cue could not be found.");
  const cue = data as ExamNarration & { media_metadata?: unknown };
  try {
    await database.from("exam_set_narration").update({ media_status: "generating", media_error: null, updated_at: new Date().toISOString() }).eq("id", narrationId);
    const audioUrl = await generateAudio(database, cue.exam_set_id, "narration", cue.cue_key, cue.script);
    const { error: updateError } = await database.from("exam_set_narration").update({
      audio_url: audioUrl,
      media_status: "ready",
      media_error: null,
      media_metadata: generationMetadata(cue.media_metadata, { audio: { model: TTS_MODEL, voice: TTS_VOICE, generatedAt: new Date().toISOString() } }),
      updated_at: new Date().toISOString(),
    }).eq("id", narrationId);
    if (updateError) throw new Error("Could not save the narration audio.");
    return { audioUrl, model: TTS_MODEL };
  } catch (cause) {
    await database.from("exam_set_narration").update({ media_status: "failed", media_error: "Gemini TTS could not complete this narration cue.", updated_at: new Date().toISOString() }).eq("id", narrationId);
    throw mediaError("Narration audio generation", cause);
  }
}

export async function regenerateItemMedia(database: Database, itemId: string) {
  if (!isUuid(itemId)) throw new Error("Choose a valid exam item.");
  const { data, error } = await database.from("exam_set_items").select("*").eq("id", itemId).maybeSingle();
  if (error || !data) throw new Error("The exam item could not be found.");
  const item = data as ExamItem & { media_metadata?: unknown };

  if (item.module === "listen_repeat") {
    try {
      await database.from("exam_set_items").update({ audio_status: "generating", audio_error: null, updated_at: new Date().toISOString() }).eq("id", itemId);
      const audioUrl = await generateAudio(database, item.exam_set_id, "listen-repeat", `sentence-${item.position}`, item.prompt);
      const { error: updateError } = await database.from("exam_set_items").update({
        audio_url: audioUrl,
        audio_status: "ready",
        audio_error: null,
        media_mode: "generated",
        media_metadata: generationMetadata(item.media_metadata, { audio: { model: TTS_MODEL, voice: TTS_VOICE, generatedAt: new Date().toISOString() } }),
        updated_at: new Date().toISOString(),
      }).eq("id", itemId);
      if (updateError) throw new Error("Could not save the sentence audio.");
      return { status: "ready" as const, audioUrl, model: TTS_MODEL };
    } catch (cause) {
      await database.from("exam_set_items").update({ audio_status: "failed", audio_error: "Gemini TTS could not complete this sentence.", updated_at: new Date().toISOString() }).eq("id", itemId);
      throw mediaError("Sentence audio generation", cause);
    }
  }

  const { data: set, error: setError } = await database.from("exam_sets").select("id, interviewer_id").eq("id", item.exam_set_id).maybeSingle();
  if (setError || !set) throw new Error("The exam set for this item could not be found.");
  const { data: interviewerData, error: interviewerError } = await database.from("exam_interviewers").select("*").eq("id", set.interviewer_id).maybeSingle();
  if (interviewerError || !interviewerData) throw new Error("The selected interviewer could not be found.");
  const interviewer = interviewerData as ExamInterviewer & { source_metadata?: unknown };

  try {
    await database.from("exam_set_items").update({ video_status: "generating", video_error: null, updated_at: new Date().toISOString() }).eq("id", itemId);
    const image = await ensureInterviewerImage(database, interviewer);
    const operationName = await startVideo(buildQuestionVideoPrompt(interviewer, item.prompt), image);
    const { error: updateError } = await database.from("exam_set_items").update({
      video_status: "generating",
      video_error: null,
      media_mode: "generated",
      media_metadata: generationMetadata(item.media_metadata, { video: { operationName, model: VIDEO_MODEL, state: "generating", generatedAt: new Date().toISOString() } }),
      updated_at: new Date().toISOString(),
    }).eq("id", itemId);
    if (updateError) throw new Error("Could not save the Veo job.");
    return { status: "generating" as const, operationName, model: VIDEO_MODEL };
  } catch (cause) {
    await database.from("exam_set_items").update({ video_status: "failed", video_error: "Veo could not start this interviewer question.", updated_at: new Date().toISOString() }).eq("id", itemId);
    throw mediaError("Interviewer question video generation", cause);
  }
}

export async function pollItemVideo(database: Database, itemId: string) {
  if (!isUuid(itemId)) throw new Error("Choose a valid exam item.");
  const { data, error } = await database.from("exam_set_items").select("id, module, media_metadata, video_status").eq("id", itemId).maybeSingle();
  if (error || !data || data.module !== "interview") throw new Error("Choose a valid interviewer question.");
  const metadata = asRecord(data.media_metadata);
  const generation = asRecord(metadata.generation);
  const video = asRecord(generation.video);
  const operationName = compact(video.operationName, 260);
  if (!operationName) return { status: data.video_status };

  try {
    const operation = await getVideoOperation(operationName);
    if (!operation.done) return { status: "generating" as const };
    if (operation.error) throw new Error("Veo rejected the interviewer question.");
    const generated = operation.response?.generatedVideos?.[0]?.video as GeneratedVideoSource | undefined;
    if (!generated) throw new Error("Veo completed without an interviewer question video.");
    const videoUrl = await persistVideo(database, "sets", data.id, generated);
    const { error: updateError } = await database.from("exam_set_items").update({
      video_url: videoUrl,
      video_status: "ready",
      video_error: null,
      media_mode: "generated",
      media_metadata: generationMetadata(metadata, { video: { operationName: null, state: "ready", videoUrl, completedAt: new Date().toISOString(), model: VIDEO_MODEL } }),
      updated_at: new Date().toISOString(),
    }).eq("id", itemId);
    if (updateError) throw new Error("Could not save the interviewer question video.");
    return { status: "ready" as const, videoUrl };
  } catch (cause) {
    await database.from("exam_set_items").update({ video_status: "failed", video_error: "Veo could not complete this interviewer question.", updated_at: new Date().toISOString() }).eq("id", itemId);
    throw mediaError("Interviewer question video generation", cause);
  }
}

function parseScenePlan(value: string) {
  const parsed = JSON.parse(value) as { sceneDescription?: unknown; targets?: unknown };
  const sceneDescription = compact(parsed.sceneDescription, 700);
  const targets = Array.isArray(parsed.targets)
    ? parsed.targets.map((target) => ({ label: compact(asRecord(target).label, 80), prompt: compact(asRecord(target).prompt, 140) }))
    : [];
  if (!sceneDescription || targets.length !== 7 || targets.some((target) => !target.label || !target.prompt)) {
    throw new Error("Gemini did not return a complete SAM 3 scene plan.");
  }
  if (new Set(targets.map((target) => target.prompt.toLowerCase())).size !== targets.length) {
    throw new Error("Gemini returned duplicate SAM 3 segmentation targets.");
  }
  return { sceneDescription, targets };
}

function sam3WorkerConfiguration() {
  const url = process.env.EXAM_SAM3_WORKER_URL;
  const token = process.env.EXAM_SAM3_WORKER_TOKEN;
  if (!url || !token) {
    throw new Error("SAM 3 is not connected to the dashboard. Configure the server-only EXAM_SAM3_WORKER_URL and EXAM_SAM3_WORKER_TOKEN, then retry the visual set.");
  }
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:") throw new Error();
    return { url: endpoint, token };
  } catch {
    throw new Error("EXAM_SAM3_WORKER_URL must be a secure HTTPS endpoint.");
  }
}

async function requestSam3Masks(input: { imageUrl: string; targets: Array<{ position: number; label: string; prompt: string }> }) {
  const config = sam3WorkerConfiguration();
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ action: "segment", model: "SAM 3", imageUrl: input.imageUrl, targets: input.targets }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Sam3WorkerResponse;
  if (!response.ok || !Array.isArray(payload.masks)) throw new Error("The SAM 3 worker did not return all sentence masks.");
  const masks = payload.masks.map((mask) => mask as Sam3WorkerMask).map((mask) => ({
    position: Number(mask.position),
    url: compact(mask.url, 1000),
    target: compact(mask.target, 80),
    score: typeof mask.score === "number" ? mask.score : null,
  }));
  if (masks.length !== 7 || masks.some((mask) => !Number.isInteger(mask.position) || mask.position < 1 || mask.position > 7 || !mask.url) || new Set(masks.map((mask) => mask.position)).size !== 7) {
    throw new Error("The SAM 3 worker returned an incomplete mask set.");
  }
  return masks.sort((left, right) => left.position - right.position);
}

export async function regenerateListenRepeatVisuals(database: Database, examSetId: string) {
  if (!isUuid(examSetId)) throw new Error("Choose a valid exam set.");
  sam3WorkerConfiguration();
  const [{ data: set, error: setError }, { data: items, error: itemsError }] = await Promise.all([
    database.from("exam_sets").select("id, listen_repeat_theme, media_metadata").eq("id", examSetId).maybeSingle(),
    database.from("exam_set_items").select("id, position, prompt, module, media_metadata").eq("exam_set_id", examSetId).eq("module", "listen_repeat").order("position"),
  ]);
  if (setError || !set || itemsError || !items || items.length !== 7) throw new Error("This set needs exactly seven Listen and Repeat items before visuals can be generated.");
  const sentences = items.map((item) => compact(item.prompt, 320));
  if (sentences.some((sentence) => !sentence)) throw new Error("Every Listen and Repeat item needs source text before visuals can be generated.");

  try {
    await database.from("exam_set_items").update({ visual_status: "generating", visual_error: null, updated_at: new Date().toISOString() }).eq("exam_set_id", examSetId).eq("module", "listen_repeat");
    const planResponse = await gemini().models.generateContent({
      model: TEXT_MODEL,
      contents: buildScenePlanPrompt(set.listen_repeat_theme, sentences),
      config: { responseMimeType: "application/json", responseJsonSchema: scenePlanSchema, temperature: 0.5 },
    });
    if (!planResponse.text) throw new Error("Gemini did not return a Listen and Repeat visual plan.");
    const plan = parseScenePlan(planResponse.text);
    const illustration = await generateImage(buildSceneIllustrationPrompt(set.listen_repeat_theme, sentences, plan), ILLUSTRATION_MODEL, "4:3", "2K");
    const illustrationUrl = await uploadBytes(database, imagePath("sets", examSetId, illustration.mimeType === "image/png" ? "png" : "jpg"), illustration.bytes, illustration.mimeType);
    const masks = await requestSam3Masks({ imageUrl: illustrationUrl, targets: plan.targets.map((target, index) => ({ position: index + 1, ...target })) });
    await Promise.all(masks.map(async (mask) => {
      const source = await fetchBytes(mask.url, "mask");
      const mimeType = pngOrJpegMimeType(source.contentType);
      const row = items[mask.position - 1];
      const imageUrl = await uploadBytes(database, imagePath("masks", row.id, mimeType === "image/png" ? "png" : "jpg"), source.bytes, mimeType);
      const { error: updateError } = await database.from("exam_set_items").update({
        image_url: imageUrl,
        visual_target: mask.target || plan.targets[mask.position - 1].label,
        visual_status: "ready",
        visual_error: null,
        media_mode: "generated",
        media_metadata: generationMetadata(row.media_metadata, { visual: { model: ILLUSTRATION_MODEL, segmentation: "SAM 3", target: mask.target || plan.targets[mask.position - 1].label, score: mask.score, generatedAt: new Date().toISOString() } }),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (updateError) throw new Error("Could not save a SAM 3 sentence mask.");
    }));
    const { error: setUpdateError } = await database.from("exam_sets").update({
      illustration_url: illustrationUrl,
      scene_description: plan.sceneDescription,
      media_mode: "generated",
      media_metadata: generationMetadata(set.media_metadata, { visual: { planningModel: TEXT_MODEL, illustrationModel: ILLUSTRATION_MODEL, segmentation: "SAM 3", generatedAt: new Date().toISOString() } }),
      updated_at: new Date().toISOString(),
    }).eq("id", examSetId);
    if (setUpdateError) throw new Error("Could not save the generated Listen and Repeat illustration.");
    return { illustrationUrl, models: { planning: TEXT_MODEL, illustration: ILLUSTRATION_MODEL, segmentation: "SAM 3" } };
  } catch (cause) {
    await database.from("exam_set_items").update({ visual_status: "failed", visual_error: "Nano Banana and SAM 3 could not complete this visual set.", updated_at: new Date().toISOString() }).eq("exam_set_id", examSetId).eq("module", "listen_repeat");
    throw mediaError("Listen and Repeat visual generation", cause);
  }
}

export async function generateExamMedia(database: Database, examSetId: string) {
  if (!isUuid(examSetId)) throw new Error("Choose a valid exam set.");
  // Validate the one non-serverless stage before generating any billable media.
  sam3WorkerConfiguration();
  const [{ data: narration, error: narrationError }, { data: items, error: itemsError }] = await Promise.all([
    database.from("exam_set_narration").select("id").eq("exam_set_id", examSetId).order("position"),
    database.from("exam_set_items").select("id, module").eq("exam_set_id", examSetId).order("module").order("position"),
  ]);
  if (narrationError || itemsError || !narration || narration.length !== 5 || !items || items.length !== 11) {
    throw new Error("This set needs five narration cues and eleven prompt items before all media can be generated.");
  }

  for (const cue of narration) await regenerateNarrationMedia(database, cue.id);
  for (const item of items.filter((item) => item.module === "listen_repeat")) await regenerateItemMedia(database, item.id);
  await regenerateListenRepeatVisuals(database, examSetId);
  const videos = [];
  for (const item of items.filter((item) => item.module === "interview")) videos.push(await regenerateItemMedia(database, item.id));
  return { narration: narration.length, listenRepeat: 7, interviewVideos: videos.length, videoModel: VIDEO_MODEL };
}
