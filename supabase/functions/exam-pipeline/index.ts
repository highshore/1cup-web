// exam-pipeline — durable server-owned media generation for Test Center.
//
// The Next.js route authorizes an administrator, then this Edge Function creates
// short queue jobs. pg_net/pg_cron invokes process-next, so a browser request or
// an open Test Center tab is never responsible for completing Vertex work.
import { json, preflight } from "../_shared/cors.ts";
import { admin, hasServiceRoleAuthorization } from "../_shared/db.ts";

const ASSET_BUCKET = "exam-pipeline-assets";
const TEXT_MODEL = "gemini-3.1-flash-lite";
const PORTRAIT_MODEL = "gemini-3.1-flash-lite-image";
const ILLUSTRATION_MODEL = "gemini-3.1-flash-image";
const TTS_MODEL = "gemini-3.1-flash-tts-preview";
const VEO_MODEL = "veo-3.1-fast-generate-001";
const VERTEX_PROJECT = Deno.env.get("GOOGLE_CLOUD_PROJECT") || "one-cup-eng";
const VEO_LOCATION = "us-central1";

type Row = Record<string, unknown>;
type JobType = "interviewer" | "exam" | "narration" | "item" | "visuals";
type Job = Row & {
  id: string;
  job_type: JobType;
  status: string;
  attempt_count?: number;
};
type Interviewer = Row & {
  id: string;
  name: string;
  gender: string;
  occupation: string;
  attire: string;
  personality: string;
  voice_tone: string;
};
type Narration = Row & {
  id: string;
  exam_set_id: string;
  cue_key: string;
  script: string;
};
type ExamItem = Row & {
  id: string;
  exam_set_id: string;
  module: "listen_repeat" | "interview";
  position: number;
  prompt: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

const compact = (value: unknown, maximum = 280) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maximum)
    : "";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);

const asRecord = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Row
    : {};

const now = () => new Date().toISOString();

const safeError = (cause: unknown) => {
  const message = cause instanceof Error
    ? cause.message
    : "Unknown processing error";
  return message.replace(/\s+/g, " ").slice(0, 480);
};

const base64url = (input: ArrayBuffer | string): string => {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
};

const pemToPkcs8 = (pem: string): ArrayBuffer => {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(
    /-----END PRIVATE KEY-----/,
    "",
  ).replace(/\s+/g, "");
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
};

async function vertexAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Vertex AI credentials are unavailable.");
  const serviceAccount = JSON.parse(raw) as {
    client_email?: string;
    private_key?: string;
  };
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Vertex AI credentials are invalid.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  }.${
    base64url(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600,
    }))
  }`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(serviceAccount.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Vertex AI token exchange failed (${response.status}).`);
  }
  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) {
    throw new Error("Vertex AI token exchange returned no token.");
  }
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3000) * 1000,
  };
  return cachedToken.value;
}

async function googleFetch(url: string, init: RequestInit = {}) {
  const token = await vertexAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-user-project": VERTEX_PROJECT,
      ...(init.headers ?? {}),
    },
  });
}

async function vertexGenerate(model: string, payload: Row) {
  const response = await googleFetch(
    `https://aiplatform.googleapis.com/v1/projects/${
      encodeURIComponent(VERTEX_PROJECT)
    }/locations/global/publishers/google/models/${
      encodeURIComponent(model)
    }:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const result = await response.json().catch(() => ({})) as Row;
  if (!response.ok) {
    throw new Error(`Vertex ${model} failed (${response.status}).`);
  }
  return result;
}

function generatedText(result: Row) {
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const parts = candidates.flatMap((candidate) => {
    const content = asRecord(candidate).content;
    return Array.isArray(asRecord(content).parts)
      ? asRecord(content).parts
      : [];
  });
  const text = parts.map((part) => compact(asRecord(part).text, 20_000)).find(
    Boolean,
  );
  if (!text) throw new Error("Vertex returned no text.");
  return text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
}

function generatedImage(result: Row) {
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  for (const candidate of candidates) {
    const parts = asRecord(asRecord(candidate).content).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inline = asRecord(asRecord(part).inlineData);
      const data = compact(inline.data, 16_000_000);
      if (data) {
        return {
          bytes: Uint8Array.from(
            atob(data),
            (character) => character.charCodeAt(0),
          ),
          mimeType: imageMime(compact(inline.mimeType, 80)),
        };
      }
    }
  }
  throw new Error("Vertex returned no image.");
}

const imageMime = (value: string) =>
  value === "image/png" ? "image/png" : "image/jpeg";
const videoMime = (value: string) =>
  value === "video/webm" ? "video/webm" : "video/mp4";

function waveFromPcm(pcm: Uint8Array) {
  if (new TextDecoder().decode(pcm.slice(0, 4)) === "RIFF") return pcm;
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode("RIFF"), 0);
  view.setUint32(4, 36 + pcm.byteLength, true);
  header.set(new TextEncoder().encode("WAVEfmt "), 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24_000, true);
  view.setUint32(28, 48_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  header.set(new TextEncoder().encode("data"), 36);
  view.setUint32(40, pcm.byteLength, true);
  const wav = new Uint8Array(header.byteLength + pcm.byteLength);
  wav.set(header);
  wav.set(pcm, header.byteLength);
  return wav;
}

function metadata(value: unknown, patch: Row) {
  const current = asRecord(value);
  return {
    ...current,
    generation: { ...asRecord(current.generation), ...patch, updatedAt: now() },
  };
}

function assetPath(kind: string, id: string, extension: string) {
  return `generated/${kind}/${id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

async function uploadAsset(
  db: ReturnType<typeof admin>,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await db.storage.from(ASSET_BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    throw new Error("Could not save generated media to durable storage.");
  }
  const { data } = db.storage.from(ASSET_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Generated media has no public URL.");
  return data.publicUrl;
}

async function fetchHttpsBytes(url: string, label: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} URL is invalid.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} URL must use HTTPS.`);
  }
  const response = await fetch(parsed, {
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${label} could not be downloaded.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength) throw new Error(`${label} was empty.`);
  return { bytes, contentType: response.headers.get("content-type") ?? "" };
}

function stagingBucket() {
  const bucket = compact(Deno.env.get("EXAM_VERTEX_MEDIA_BUCKET"), 220);
  if (!bucket || !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) {
    throw new Error(
      "EXAM_VERTEX_MEDIA_BUCKET is not configured. Configure a dedicated Google Cloud Storage bucket for Veo staging.",
    );
  }
  return bucket;
}

async function uploadStagingObject(
  bytes: Uint8Array,
  contentType: string,
  objectName: string,
) {
  const bucket = stagingBucket();
  const uploadBody = new Uint8Array(bytes.byteLength);
  uploadBody.set(bytes);
  const response = await googleFetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${
      encodeURIComponent(bucket)
    }/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: uploadBody.buffer,
    },
  );
  if (!response.ok) {
    throw new Error(
      `Could not upload the Veo staging frame (${response.status}).`,
    );
  }
  return `gs://${bucket}/${objectName}`;
}

function gcsObjectName(uri: string) {
  const bucket = stagingBucket();
  const prefix = `gs://${bucket}/`;
  if (!uri.startsWith(prefix)) {
    throw new Error(
      "Veo returned a video outside the configured staging bucket.",
    );
  }
  const objectName = uri.slice(prefix.length);
  if (!objectName) throw new Error("Veo returned an invalid video location.");
  return objectName;
}

async function downloadStagingObject(uri: string) {
  const bucket = stagingBucket();
  const response = await googleFetch(
    `https://storage.googleapis.com/storage/v1/b/${
      encodeURIComponent(bucket)
    }/o/${encodeURIComponent(gcsObjectName(uri))}?alt=media`,
  );
  if (!response.ok) {
    throw new Error(
      `Could not download completed Veo video (${response.status}).`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function generatePortrait(prompt: string) {
  return generatedImage(
    await vertexGenerate(PORTRAIT_MODEL, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "16:9" },
      },
    }),
  );
}

async function generateIllustration(prompt: string) {
  return generatedImage(
    await vertexGenerate(ILLUSTRATION_MODEL, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:3", imageSize: "2K" },
      },
    }),
  );
}

async function generateAudio(script: string) {
  const response = await googleFetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: script },
        voice: { languageCode: "en-US", name: "Kore", modelName: TTS_MODEL },
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24_000 },
      }),
    },
  );
  const result = await response.json().catch(() => ({})) as Row;
  if (!response.ok) {
    throw new Error(`Cloud Text-to-Speech failed (${response.status}).`);
  }
  const audioContent = compact(result.audioContent, 20_000_000);
  if (!audioContent) throw new Error("Cloud Text-to-Speech returned no audio.");
  return waveFromPcm(
    Uint8Array.from(atob(audioContent), (character) => character.charCodeAt(0)),
  );
}

async function startVeo(
  prompt: string,
  image: { bytes: Uint8Array; mimeType: string },
  scope: string,
) {
  const object = `exam-pipeline/frames/${scope}/${crypto.randomUUID()}.${
    image.mimeType === "image/png" ? "png" : "jpg"
  }`;
  const frameUri = await uploadStagingObject(
    image.bytes,
    image.mimeType,
    object,
  );
  const bucket = stagingBucket();
  const response = await googleFetch(
    `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${
      encodeURIComponent(VERTEX_PROJECT)
    }/locations/${VEO_LOCATION}/publishers/google/models/${VEO_MODEL}:predictLongRunning`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{
          prompt,
          image: { gcsUri: frameUri, mimeType: image.mimeType },
          lastFrame: { gcsUri: frameUri, mimeType: image.mimeType },
        }],
        parameters: {
          storageUri: `gs://${bucket}/exam-pipeline/veo-output/`,
          sampleCount: 1,
          aspectRatio: "16:9",
          resolution: "720p",
          durationSeconds: 8,
          personGeneration: "allow_adult",
        },
      }),
    },
  );
  const result = await response.json().catch(() => ({})) as Row;
  const operationName = compact(result.name, 600);
  if (!response.ok || !operationName) {
    throw new Error(
      `Veo did not start a video operation (${response.status}).`,
    );
  }
  return { operationName, frameUri };
}

async function veoOperation(operationName: string) {
  if (!operationName || !operationName.startsWith("projects/")) {
    throw new Error("Invalid Veo operation reference.");
  }
  const response = await googleFetch(
    `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/${operationName}`,
  );
  const result = await response.json().catch(() => ({})) as Row;
  if (!response.ok) throw new Error(`Could not poll Veo (${response.status}).`);
  return result;
}

function interviewerPortraitPrompt(interviewer: Interviewer) {
  return `PROFILE\nName: ${interviewer.name}\nGender: ${interviewer.gender}\nOccupation: ${interviewer.occupation}\nAttire: ${interviewer.attire}\nPersonality: ${interviewer.personality}\nVoice tone: ${interviewer.voice_tone}\n\nDepict this exact fictional profile as a professional English interviewer looking directly into camera. Provide a bust shot, from the shoulder-up. The background must be a completely white wall. Centered medium close-up, 16:9 landscape, neutral expression, wear the specified attire, neutral studio background, soft even studio lighting. No text, logos, subtitles, props, or other people.`;
}

const interviewerNoddingPrompt = () =>
  "The person gently nods and blinks naturally as if quietly listening. The person does not speak and keeps their lips closed throughout. Keep the camera locked and the white studio background unchanged. No other movement or people.";

function questionVideoPrompt(interviewer: Interviewer, script: string) {
  return `Use the supplied profile image as the exact first and last frame. Preserve the same fictional person, clothing, centered shoulder-up framing, white studio wall, lighting, and neutral end pose.\n\nCHARACTER: A fictional adult English interviewer. ${interviewer.personality} and professional; occupation ${interviewer.occupation}; attire ${interviewer.attire}; voice ${interviewer.voice_tone}. Do not identify, name, imitate, or refer to any real person.\n\nThe interviewer looks into camera and asks exactly this question once: "${script}"\n\nUse a natural, clear English speaking voice with matching lip movement. Only the interviewer speaks. No music, soundtrack, singing, ambient noise, sound effects, captions, text, cuts, camera movement, additional words, omissions, or paraphrasing.`;
}

function scenePlanPrompt(theme: string, sentences: string[]) {
  return `Return JSON only: {"sceneDescription":"...","targets":[{"label":"...","prompt":"..."}]}. Create one visual authoring plan for a Listen and Repeat English-speaking test section.\n\nTHEME: ${theme}\n\nThe illustration must visibly and naturally encompass every one of these seven sentences. For every sentence, provide one distinct, concrete, separately visible subject, object, action, or place that SAM 3 can isolate with a short text prompt. The target must represent the sentence's central visual meaning, not a generic background object. Keep every target unique, physically plausible, and visually separated from the other targets. Avoid vague prompts, pronouns, abstract ideas, text-only targets, and targets requiring words inside the illustration. Scene description: 70–150 words. Each label: 2–8 words. Each prompt: 2–12 words.\n\nSENTENCES:\n${
    sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join("\n")
  }`;
}

function illustrationPrompt(
  theme: string,
  sentences: string[],
  plan: {
    sceneDescription: string;
    targets: Array<{ label: string; prompt: string }>;
  },
) {
  return `Create one completely new, polished editorial illustration for an English-language Listen and Repeat test. Use a sophisticated textbook and standardized-test visual language: precise ink-like line drawing, subtle pencil-like shading, realistic simplified anatomy, a coherent three-quarter slightly elevated perspective, clean architectural perspective, and a restrained mostly grayscale, low-saturation palette with selective color only where it improves recognition. It must look professionally commissioned, not like clip art, a photo, a 3D render, a PowerPoint slide, or an infographic.\n\nSCENE: ${plan.sceneDescription}\nTHEME: ${theme}\n\nAll seven source sentences must be represented in this one coherent scene:\n${
    sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join("\n")
  }\n\nInclude these seven distinct, separately visible semantic targets, leaving enough clear space around each for downstream object segmentation:\n${
    plan.targets.map((target, index) => `${index + 1}. ${target.prompt}`).join(
      "\n",
    )
  }\n\nNo text, captions, speech bubbles, labels, callouts, colored highlights, masks, bounding boxes, UI, logos, watermarks, or alternate variants. The delivered image must be the clean, unmasked master illustration.`;
}

function parseScenePlan(value: string) {
  let parsed: Row;
  try {
    parsed = JSON.parse(value) as Row;
  } catch {
    throw new Error("Vertex returned an invalid SAM 3 scene plan.");
  }
  const sceneDescription = compact(parsed.sceneDescription, 700);
  const targets = Array.isArray(parsed.targets)
    ? parsed.targets.map((target) => ({
      label: compact(asRecord(target).label, 80),
      prompt: compact(asRecord(target).prompt, 140),
    }))
    : [];
  if (
    !sceneDescription || targets.length !== 7 ||
    targets.some((target) => !target.label || !target.prompt) ||
    new Set(targets.map((target) => target.prompt.toLowerCase())).size !== 7
  ) {
    throw new Error("Vertex did not return seven distinct SAM 3 targets.");
  }
  return { sceneDescription, targets };
}

function sam3Config() {
  const url = compact(Deno.env.get("EXAM_SAM3_WORKER_URL"), 1200);
  const token = Deno.env.get("EXAM_SAM3_WORKER_TOKEN");
  if (!url || !token) {
    throw new Error(
      "SAM 3 is not configured. Set EXAM_SAM3_WORKER_URL and EXAM_SAM3_WORKER_TOKEN.",
    );
  }
  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("EXAM_SAM3_WORKER_URL is invalid.");
  }
  if (endpoint.protocol !== "https:") {
    throw new Error("EXAM_SAM3_WORKER_URL must use HTTPS.");
  }
  return { endpoint, token };
}

async function segmentWithSam3(
  imageUrl: string,
  targets: Array<{ position: number; label: string; prompt: string }>,
) {
  const config = sam3Config();
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      action: "segment",
      model: "SAM 3",
      imageUrl,
      targets,
    }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as Row;
  const values = Array.isArray(result.masks) ? result.masks : [];
  const masks = values.map((mask) => ({
    position: Number(asRecord(mask).position),
    url: compact(asRecord(mask).url, 1200),
    target: compact(asRecord(mask).target, 100),
    score: typeof asRecord(mask).score === "number"
      ? asRecord(mask).score
      : null,
  }));
  if (
    !response.ok || masks.length !== 7 ||
    masks.some((mask) =>
      !Number.isInteger(mask.position) || mask.position < 1 ||
      mask.position > 7 || !mask.url
    ) || new Set(masks.map((mask) => mask.position)).size !== 7
  ) {
    throw new Error("SAM 3 did not return all seven sentence masks.");
  }
  return masks.sort((left, right) => left.position - right.position);
}

function jobScope(jobType: JobType, id: string) {
  return `${jobType}:${id}`;
}

async function markJob(
  db: ReturnType<typeof admin>,
  jobId: string,
  values: Row,
) {
  const { error } = await db.from("exam_pipeline_jobs").update({
    ...values,
    updated_at: now(),
  }).eq("id", jobId);
  if (error) throw new Error(error.message);
}

async function enqueueJob(
  db: ReturnType<typeof admin>,
  input: {
    jobType: JobType;
    id: string;
    requestedBy?: string;
    markTarget?: boolean;
  },
) {
  const { jobType, id, requestedBy, markTarget = true } = input;
  if (!isUuid(id)) throw new Error("Choose a valid pipeline target.");
  const scopeKey = jobScope(jobType, id);
  const { data: active, error: activeError } = await db.from(
    "exam_pipeline_jobs",
  ).select("id, status, stage").eq("scope_key", scopeKey).in("status", [
    "queued",
    "processing",
  ]).maybeSingle();
  if (activeError) throw new Error(activeError.message);
  if (active) return { job: active, alreadyQueued: true };

  if (markTarget) await markQueuedTarget(db, jobType, id);
  const row: Row = {
    job_type: jobType,
    scope_key: scopeKey,
    requested_by: requestedBy || null,
    status: "queued",
    stage: "queued",
    progress: 0,
  };
  if (jobType === "interviewer") row.interviewer_id = id;
  if (jobType === "exam" || jobType === "visuals") row.exam_set_id = id;
  if (jobType === "narration") row.narration_id = id;
  if (jobType === "item") row.item_id = id;
  const { data, error } = await db.from("exam_pipeline_jobs").insert(row)
    .select("id, status, stage").single();
  if (error) {
    if (error.code === "23505") {
      return {
        job: { status: "queued", stage: "queued" },
        alreadyQueued: true,
      };
    }
    throw new Error(error.message);
  }
  return { job: data, alreadyQueued: false };
}

async function markQueuedTarget(
  db: ReturnType<typeof admin>,
  jobType: JobType,
  id: string,
) {
  const timestamp = now();
  if (jobType === "interviewer") {
    const { error } = await db.from("exam_interviewers").update({
      image_status: "generating",
      video_status: "generating",
      image_error: null,
      video_error: null,
      updated_at: timestamp,
    }).eq("id", id);
    if (error) throw new Error("The interviewer could not be queued.");
    return;
  }
  if (jobType === "narration") {
    const { error } = await db.from("exam_set_narration").update({
      media_status: "generating",
      media_error: null,
      updated_at: timestamp,
    }).eq("id", id);
    if (error) throw new Error("The narration cue could not be queued.");
    return;
  }
  if (jobType === "item") {
    const { data, error } = await db.from("exam_set_items").select("module").eq(
      "id",
      id,
    ).maybeSingle();
    if (error || !data) throw new Error("The exam item could not be queued.");
    const fields = data.module === "listen_repeat"
      ? { audio_status: "generating", audio_error: null, updated_at: timestamp }
      : {
        video_status: "generating",
        video_error: null,
        updated_at: timestamp,
      };
    const { error: updateError } = await db.from("exam_set_items").update(
      fields,
    ).eq("id", id);
    if (updateError) throw new Error("The exam item could not be queued.");
    return;
  }
  if (jobType === "visuals") {
    const { error } = await db.from("exam_set_items").update({
      visual_status: "generating",
      visual_error: null,
      updated_at: timestamp,
    }).eq("exam_set_id", id).eq("module", "listen_repeat");
    if (error) throw new Error("The visual set could not be queued.");
  }
}

async function failTarget(
  db: ReturnType<typeof admin>,
  job: Job,
  message: string,
) {
  const timestamp = now();
  if (job.job_type === "interviewer" && isUuid(compact(job.interviewer_id))) {
    await db.from("exam_interviewers").update({
      image_status: "failed",
      video_status: "failed",
      image_error: message,
      video_error: message,
      updated_at: timestamp,
    }).eq("id", job.interviewer_id as string);
  }
  if (job.job_type === "narration" && isUuid(compact(job.narration_id))) {
    await db.from("exam_set_narration").update({
      media_status: "failed",
      media_error: message,
      updated_at: timestamp,
    }).eq("id", job.narration_id as string);
  }
  if (job.job_type === "item" && isUuid(compact(job.item_id))) {
    const { data } = await db.from("exam_set_items").select("module").eq(
      "id",
      job.item_id as string,
    ).maybeSingle();
    const fields = data?.module === "listen_repeat"
      ? { audio_status: "failed", audio_error: message, updated_at: timestamp }
      : { video_status: "failed", video_error: message, updated_at: timestamp };
    await db.from("exam_set_items").update(fields).eq(
      "id",
      job.item_id as string,
    );
  }
  if (job.job_type === "visuals" && isUuid(compact(job.exam_set_id))) {
    await db.from("exam_set_items").update({
      visual_status: "failed",
      visual_error: message,
      updated_at: timestamp,
    }).eq("exam_set_id", job.exam_set_id as string).eq(
      "module",
      "listen_repeat",
    );
  }
}

async function processInterviewer(
  db: ReturnType<typeof admin>,
  interviewerId: string,
) {
  const { data, error } = await db.from("exam_interviewers").select("*").eq(
    "id",
    interviewerId,
  ).maybeSingle();
  if (error || !data) throw new Error("The interviewer could not be found.");
  const interviewer = data as Interviewer;
  const portrait = await generatePortrait(
    interviewerPortraitPrompt(interviewer),
  );
  const imageUrl = await uploadAsset(
    db,
    assetPath(
      "interviewers",
      interviewerId,
      portrait.mimeType === "image/png" ? "png" : "jpg",
    ),
    portrait.bytes,
    portrait.mimeType,
  );
  const video = await startVeo(
    interviewerNoddingPrompt(),
    portrait,
    `interviewers/${interviewerId}`,
  );
  const { error: updateError } = await db.from("exam_interviewers").update({
    image_url: imageUrl,
    image_status: "ready",
    video_status: "generating",
    image_error: null,
    video_error: null,
    media_mode: "generated",
    source_metadata: metadata(interviewer.source_metadata, {
      models: { portrait: PORTRAIT_MODEL, video: VEO_MODEL },
      portrait: { imageUrl, generatedAt: now() },
      video: {
        operationName: video.operationName,
        frameUri: video.frameUri,
        state: "generating",
        generatedAt: now(),
      },
    }),
    updated_at: now(),
  }).eq("id", interviewerId);
  if (updateError) throw new Error("Could not save interviewer media state.");
}

async function processNarration(
  db: ReturnType<typeof admin>,
  narrationId: string,
) {
  const { data, error } = await db.from("exam_set_narration").select("*").eq(
    "id",
    narrationId,
  ).maybeSingle();
  if (error || !data) throw new Error("The narration cue could not be found.");
  const cue = data as Narration;
  const audioUrl = await uploadAsset(
    db,
    assetPath(`sets/${cue.exam_set_id}/narration`, cue.cue_key, "wav"),
    await generateAudio(cue.script),
    "audio/wav",
  );
  const { error: updateError } = await db.from("exam_set_narration").update({
    audio_url: audioUrl,
    media_status: "ready",
    media_error: null,
    media_metadata: metadata(cue.media_metadata, {
      audio: { model: TTS_MODEL, voice: "Kore", generatedAt: now() },
    }),
    updated_at: now(),
  }).eq("id", narrationId);
  if (updateError) throw new Error("Could not save narration audio.");
  await markSetReadyIfComplete(db, cue.exam_set_id);
}

async function processItem(db: ReturnType<typeof admin>, itemId: string) {
  const { data, error } = await db.from("exam_set_items").select("*").eq(
    "id",
    itemId,
  ).maybeSingle();
  if (error || !data) throw new Error("The exam item could not be found.");
  const item = data as ExamItem;
  if (item.module === "listen_repeat") {
    const audioUrl = await uploadAsset(
      db,
      assetPath(
        `sets/${item.exam_set_id}/listen-repeat`,
        `sentence-${item.position}`,
        "wav",
      ),
      await generateAudio(item.prompt),
      "audio/wav",
    );
    const { error: updateError } = await db.from("exam_set_items").update({
      audio_url: audioUrl,
      audio_status: "ready",
      audio_error: null,
      media_mode: "generated",
      media_metadata: metadata(item.media_metadata, {
        audio: { model: TTS_MODEL, voice: "Kore", generatedAt: now() },
      }),
      updated_at: now(),
    }).eq("id", itemId);
    if (updateError) throw new Error("Could not save sentence audio.");
    await markSetReadyIfComplete(db, item.exam_set_id);
    return;
  }
  const { data: set, error: setError } = await db.from("exam_sets").select(
    "interviewer_id",
  ).eq("id", item.exam_set_id).maybeSingle();
  if (setError || !set || !isUuid(compact(set.interviewer_id))) {
    throw new Error("The item's interviewer could not be found.");
  }
  const { data: interviewer, error: interviewerError } = await db.from(
    "exam_interviewers",
  ).select("*").eq("id", set.interviewer_id).maybeSingle();
  if (interviewerError || !interviewer) {
    throw new Error("The item's interviewer could not be found.");
  }
  const interviewerProfile = interviewer as Interviewer;
  const imageUrl = compact(interviewerProfile.image_url, 2000);
  if (!imageUrl) {
    throw new Error(
      "Generate the selected interviewer's portrait before starting question videos.",
    );
  }
  const image = await fetchHttpsBytes(imageUrl, "Interviewer portrait");
  const video = await startVeo(
    questionVideoPrompt(interviewerProfile, item.prompt),
    {
      bytes: image.bytes,
      mimeType: imageMime(image.contentType.split(";", 1)[0]),
    },
    `questions/${itemId}`,
  );
  const { error: updateError } = await db.from("exam_set_items").update({
    video_status: "generating",
    video_error: null,
    media_mode: "generated",
    media_metadata: metadata(item.media_metadata, {
      video: {
        operationName: video.operationName,
        frameUri: video.frameUri,
        model: VEO_MODEL,
        state: "generating",
        generatedAt: now(),
      },
    }),
    updated_at: now(),
  }).eq("id", itemId);
  if (updateError) throw new Error("Could not save Veo question state.");
}

async function processVisuals(db: ReturnType<typeof admin>, examSetId: string) {
  const [
    { data: set, error: setError },
    { data: itemRows, error: itemsError },
  ] = await Promise.all([
    db.from("exam_sets").select("*").eq("id", examSetId).maybeSingle(),
    db.from("exam_set_items").select("*").eq("exam_set_id", examSetId).eq(
      "module",
      "listen_repeat",
    ).order("position"),
  ]);
  if (setError || itemsError || !set || !itemRows || itemRows.length !== 7) {
    throw new Error(
      "This set needs seven Listen and Repeat items before visual generation.",
    );
  }
  const items = itemRows as ExamItem[];
  const sentences = items.map((item) => compact(item.prompt, 320));
  if (sentences.some((sentence) => !sentence)) {
    throw new Error(
      "Every Listen and Repeat item needs source text before visual generation.",
    );
  }
  const planResult = await vertexGenerate(TEXT_MODEL, {
    contents: [{
      role: "user",
      parts: [{
        text: scenePlanPrompt(compact(set.listen_repeat_theme, 140), sentences),
      }],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.5,
    },
  });
  const plan = parseScenePlan(generatedText(planResult));
  const illustration = await generateIllustration(
    illustrationPrompt(compact(set.listen_repeat_theme, 140), sentences, plan),
  );
  const illustrationUrl = await uploadAsset(
    db,
    assetPath(
      "sets",
      examSetId,
      illustration.mimeType === "image/png" ? "png" : "jpg",
    ),
    illustration.bytes,
    illustration.mimeType,
  );
  const masks = await segmentWithSam3(
    illustrationUrl,
    plan.targets.map((target, index) => ({ position: index + 1, ...target })),
  );
  for (const mask of masks) {
    const item = items[mask.position - 1];
    const source = await fetchHttpsBytes(mask.url, "SAM 3 mask");
    const mimeType = imageMime(source.contentType.split(";", 1)[0]);
    const imageUrl = await uploadAsset(
      db,
      assetPath("masks", item.id, mimeType === "image/png" ? "png" : "jpg"),
      source.bytes,
      mimeType,
    );
    const { error: updateError } = await db.from("exam_set_items").update({
      image_url: imageUrl,
      visual_target: mask.target || plan.targets[mask.position - 1].label,
      visual_status: "ready",
      visual_error: null,
      media_mode: "generated",
      media_metadata: metadata(item.media_metadata, {
        visual: {
          model: ILLUSTRATION_MODEL,
          segmentation: "SAM 3",
          target: mask.target || plan.targets[mask.position - 1].label,
          score: mask.score,
          generatedAt: now(),
        },
      }),
      updated_at: now(),
    }).eq("id", item.id);
    if (updateError) throw new Error("Could not save a SAM 3 mask.");
  }
  const { error: setUpdateError } = await db.from("exam_sets").update({
    illustration_url: illustrationUrl,
    scene_description: plan.sceneDescription,
    media_mode: "generated",
    media_metadata: metadata(set.media_metadata, {
      visual: {
        planningModel: TEXT_MODEL,
        illustrationModel: ILLUSTRATION_MODEL,
        segmentation: "SAM 3",
        generatedAt: now(),
      },
    }),
    updated_at: now(),
  }).eq("id", examSetId);
  if (setUpdateError) {
    throw new Error("Could not save the generated illustration.");
  }
  await markSetReadyIfComplete(db, examSetId);
}

async function fanOutExam(
  db: ReturnType<typeof admin>,
  examSetId: string,
  requestedBy: string | undefined,
) {
  const [{ data: cues, error: cuesError }, { data: items, error: itemsError }] =
    await Promise.all([
      db.from("exam_set_narration").select("id, media_status, audio_url").eq(
        "exam_set_id",
        examSetId,
      ).order("position"),
      db.from("exam_set_items").select(
        "id, module, audio_status, visual_status, video_status, audio_url, image_url, video_url",
      ).eq("exam_set_id", examSetId).order("module").order("position"),
    ]);
  if (
    cuesError || itemsError || !cues || cues.length !== 5 || !items ||
    items.length !== 11
  ) {
    throw new Error(
      "This set needs five narration cues and eleven prompt items before media can be generated.",
    );
  }
  for (const cue of cues) {
    if (cue.media_status !== "ready" || !cue.audio_url) {
      await enqueueJob(db, { jobType: "narration", id: cue.id, requestedBy });
    }
  }
  const listenRepeat = items.filter((item) => item.module === "listen_repeat");
  for (const item of listenRepeat) {
    if (item.audio_status !== "ready" || !item.audio_url) {
      await enqueueJob(db, { jobType: "item", id: item.id, requestedBy });
    }
  }
  if (
    listenRepeat.some((item) =>
      item.visual_status !== "ready" || !item.image_url
    )
  ) await enqueueJob(db, { jobType: "visuals", id: examSetId, requestedBy });
  for (
    const item of items.filter((candidate) => candidate.module === "interview")
  ) {
    if (item.video_status !== "ready" || !item.video_url) {
      await enqueueJob(db, { jobType: "item", id: item.id, requestedBy });
    }
  }
}

async function markSetReadyIfComplete(
  db: ReturnType<typeof admin>,
  examSetId: string,
) {
  const [{ data: cues }, { data: items }, { data: set }] = await Promise.all([
    db.from("exam_set_narration").select("media_status, audio_url").eq(
      "exam_set_id",
      examSetId,
    ),
    db.from("exam_set_items").select(
      "module, audio_status, visual_status, video_status, audio_url, image_url, video_url",
    ).eq("exam_set_id", examSetId),
    db.from("exam_sets").select("status").eq("id", examSetId).maybeSingle(),
  ]);
  const complete = cues?.length === 5 &&
    cues.every((cue) => cue.media_status === "ready" && cue.audio_url) &&
    items?.length === 11 &&
    items.every((item) =>
      item.module === "listen_repeat"
        ? item.audio_status === "ready" && item.visual_status === "ready" &&
          item.audio_url && item.image_url
        : item.video_status === "ready" && item.video_url
    );
  if (complete && set?.status === "draft") {
    await db.from("exam_sets").update({
      status: "media_ready",
      updated_at: now(),
    }).eq("id", examSetId);
  }
}

function pendingOperation(row: Row) {
  const record = asRecord(
    asRecord(row.media_metadata ?? row.source_metadata).generation,
  );
  return compact(asRecord(record.video).operationName, 600);
}

async function pollOutstandingVideos(db: ReturnType<typeof admin>) {
  const [{ data: interviewers }, { data: items }] = await Promise.all([
    db.from("exam_interviewers").select("id, source_metadata, video_status").eq(
      "video_status",
      "generating",
    ).limit(20),
    db.from("exam_set_items").select(
      "id, exam_set_id, media_metadata, video_status",
    ).eq("module", "interview").eq("video_status", "generating").limit(40),
  ]);
  for (const interviewer of interviewers ?? []) {
    await pollInterviewerVideo(db, interviewer as Row).catch((error) =>
      console.error("exam pipeline interviewer poll failed", safeError(error))
    );
  }
  for (const item of items ?? []) {
    await pollQuestionVideo(db, item as Row).catch((error) =>
      console.error("exam pipeline question poll failed", safeError(error))
    );
  }
}

async function completedVideo(operation: Row) {
  if (operation.done !== true) return null;
  if (operation.error) throw new Error("Veo rejected the video operation.");
  const response = asRecord(operation.response);
  const videos = Array.isArray(response.videos)
    ? response.videos
    : Array.isArray(response.generatedVideos)
    ? response.generatedVideos
    : [];
  const first = asRecord(videos[0]);
  const uri = compact(
    first.gcsUri || asRecord(first.video).gcsUri || asRecord(first.video).uri,
    1200,
  );
  if (!uri) throw new Error("Veo completed without a downloadable video.");
  return {
    uri,
    mimeType: videoMime(
      compact(first.mimeType || asRecord(first.video).mimeType, 80),
    ),
  };
}

async function pollInterviewerVideo(
  db: ReturnType<typeof admin>,
  interviewer: Row,
) {
  const operationName = pendingOperation(interviewer);
  if (!operationName) return;
  try {
    const video = await completedVideo(await veoOperation(operationName));
    if (!video) return;
    const videoUrl = await uploadAsset(
      db,
      assetPath(
        "interviewers",
        compact(interviewer.id),
        video.mimeType === "video/webm" ? "webm" : "mp4",
      ),
      await downloadStagingObject(video.uri),
      video.mimeType,
    );
    const { error } = await db.from("exam_interviewers").update({
      video_url: videoUrl,
      video_status: "ready",
      video_error: null,
      media_mode: "generated",
      source_metadata: metadata(interviewer.source_metadata, {
        video: {
          operationName: null,
          state: "ready",
          videoUrl,
          model: VEO_MODEL,
          completedAt: now(),
        },
      }),
      updated_at: now(),
    }).eq("id", interviewer.id as string);
    if (error) throw new Error("Could not save interviewer video.");
  } catch (cause) {
    await db.from("exam_interviewers").update({
      video_status: "failed",
      video_error: "Veo could not complete the interviewer video.",
      updated_at: now(),
    }).eq("id", interviewer.id as string);
    throw cause;
  }
}

async function pollQuestionVideo(db: ReturnType<typeof admin>, item: Row) {
  const operationName = pendingOperation(item);
  if (!operationName) return;
  try {
    const video = await completedVideo(await veoOperation(operationName));
    if (!video) return;
    const videoUrl = await uploadAsset(
      db,
      assetPath(
        "sets",
        compact(item.id),
        video.mimeType === "video/webm" ? "webm" : "mp4",
      ),
      await downloadStagingObject(video.uri),
      video.mimeType,
    );
    const { error } = await db.from("exam_set_items").update({
      video_url: videoUrl,
      video_status: "ready",
      video_error: null,
      media_mode: "generated",
      media_metadata: metadata(item.media_metadata, {
        video: {
          operationName: null,
          state: "ready",
          videoUrl,
          model: VEO_MODEL,
          completedAt: now(),
        },
      }),
      updated_at: now(),
    }).eq("id", item.id as string);
    if (error) throw new Error("Could not save question video.");
    await markSetReadyIfComplete(db, item.exam_set_id as string);
  } catch (cause) {
    await db.from("exam_set_items").update({
      video_status: "failed",
      video_error: "Veo could not complete this interviewer question.",
      updated_at: now(),
    }).eq("id", item.id as string);
    throw cause;
  }
}

async function processJob(db: ReturnType<typeof admin>, job: Job) {
  await markJob(db, job.id, { stage: "working", progress: 15 });
  try {
    if (job.job_type === "interviewer") {
      await processInterviewer(db, compact(job.interviewer_id));
    }
    if (job.job_type === "exam") {
      await fanOutExam(db, compact(job.exam_set_id), compact(job.requested_by));
    }
    if (job.job_type === "narration") {
      await processNarration(db, compact(job.narration_id));
    }
    if (job.job_type === "item") await processItem(db, compact(job.item_id));
    if (job.job_type === "visuals") {
      await processVisuals(db, compact(job.exam_set_id));
    }
    await markJob(db, job.id, {
      status: "completed",
      stage: "completed",
      progress: 100,
      completed_at: now(),
      error: null,
    });
  } catch (cause) {
    const message = safeError(cause);
    console.error("exam pipeline job failed", job.id, job.job_type, message);
    await failTarget(db, job, message);
    await markJob(db, job.id, {
      status: "failed",
      stage: "failed",
      progress: 100,
      completed_at: now(),
      error: message,
    });
  }
}

async function processNext() {
  const db = admin();
  const staleBefore = new Date(Date.now() - 20 * 60_000).toISOString();
  await db.from("exam_pipeline_jobs").update({
    status: "queued",
    stage: "queued",
    progress: 0,
    updated_at: now(),
  }).eq("status", "processing").lt("updated_at", staleBefore);
  await pollOutstandingVideos(db);
  const { data: claimedRows, error: claimError } = await db.rpc(
    "claim_exam_pipeline_job",
  );
  if (claimError) throw new Error(claimError.message);
  const claimed = Array.isArray(claimedRows) ? claimedRows[0] : null;
  if (!claimed) return null;
  await processJob(db, claimed as Job);
  return (claimed as Job).id;
}

async function validSchedulerRequest(
  req: Request,
  db: ReturnType<typeof admin>,
) {
  const { data: secret, error } = await db.rpc(
    "exam_pipeline_scheduler_secret",
  );
  return !error && typeof secret === "string" && secret.length > 0 &&
    req.headers.get("x-exam-pipeline-scheduler-secret") === secret;
}

function theme(value: unknown, label: string) {
  const text = compact(value, 120);
  const words = text.split(" ").filter(Boolean);
  if (
    words.length < 2 || words.length > 16 ||
    /\?|\b(you|please|would|could|should|can|do|does|how|what|why|when|where)\b/i
      .test(text)
  ) {
    throw new Error(
      `${label} must be a neutral 2–16 word scenario topic, not a question.`,
    );
  }
  return text;
}

function wordCount(value: string) {
  return value.split(" ").filter(Boolean).length;
}

function parseThemes(value: string) {
  let parsed: Row;
  try {
    parsed = JSON.parse(value) as Row;
  } catch {
    throw new Error("Vertex returned invalid brief suggestions.");
  }
  return {
    listenRepeatTheme: theme(
      parsed.listenRepeatTheme,
      "Listen and Repeat brief",
    ),
    interviewTheme: theme(parsed.interviewTheme, "Take an Interview brief"),
  };
}

function parseDraft(value: string) {
  let parsed: Row;
  try {
    parsed = JSON.parse(value) as Row;
  } catch {
    throw new Error("Vertex returned an invalid exam draft.");
  }
  const listenRepeatScenario = compact(parsed.listenRepeatScenario);
  const interviewScenario = compact(parsed.interviewScenario);
  const listenRepeat = Array.isArray(parsed.listenRepeat)
    ? parsed.listenRepeat.map((item) => compact(item)).filter(Boolean)
    : [];
  const interviewQuestions = Array.isArray(parsed.interviewQuestions)
    ? parsed.interviewQuestions.map((item) => compact(item)).filter(Boolean)
    : [];
  if (
    !listenRepeatScenario || !interviewScenario ||
    wordCount(listenRepeatScenario) < 18 ||
    wordCount(listenRepeatScenario) > 42 || wordCount(interviewScenario) < 36 ||
    wordCount(interviewScenario) > 60
  ) {
    throw new Error(
      "The generated candidate setups did not meet the required length.",
    );
  }
  if (
    !/^You are\b/i.test(listenRepeatScenario) ||
    !/Listen to the speaker and repeat what (he or she|they) says\./i.test(
      listenRepeatScenario,
    ) || !/Repeat only once\.?$/i.test(listenRepeatScenario)
  ) {
    throw new Error(
      "The Listen and Repeat setup did not follow the required test format.",
    );
  }
  if (
    !/^You have (volunteered|agreed) to participate in a research study about\b/i
      .test(interviewScenario) ||
    !/You will have a short online interview with a researcher\./i.test(
      interviewScenario,
    ) ||
    !/The researcher will ask you some questions\./i.test(interviewScenario) ||
    !/Please answer the interviewer's questions\.?$/i.test(interviewScenario)
  ) {
    throw new Error(
      "The interview setup did not follow the required test format.",
    );
  }
  if (
    listenRepeat.length !== 7 || interviewQuestions.length !== 4 ||
    listenRepeat.some((line) => wordCount(line) < 8 || wordCount(line) > 22) ||
    interviewQuestions.some((line) =>
      wordCount(line) < 5 || wordCount(line) > 20 || !line.endsWith("?")
    )
  ) {
    throw new Error(
      "Vertex did not return the required seven sentences and four questions.",
    );
  }
  return {
    listenRepeatScenario,
    interviewScenario,
    listenRepeat,
    interviewQuestions,
  };
}

function profilePrompt() {
  return `Return JSON only: {"profiles":[{"name":"...","gender":"Female|Male|Nonbinary","occupation":"...","attire":"...","personality":"...","voiceTone":"..."}]}. Generate exactly 10 distinct fictional adult professional English interviewer profiles for an online speaking assessment. Use diverse identities, occupations, clothing, and calm professional communication styles. Never use a real person, celebrity, public figure, trademark, or organization. Every field should be concise (two to eight words), appropriate to an education assessment, and suitable for an adult portrait.`;
}

function parseProfiles(value: string) {
  let parsed: Row;
  try {
    parsed = JSON.parse(value) as Row;
  } catch {
    throw new Error("Vertex returned invalid interviewer profiles.");
  }
  const profiles = Array.isArray(parsed.profiles)
    ? parsed.profiles.map((profile) => ({
      name: compact(asRecord(profile).name, 120),
      gender: compact(asRecord(profile).gender, 20),
      occupation: compact(asRecord(profile).occupation, 120),
      attire: compact(asRecord(profile).attire, 120),
      personality: compact(asRecord(profile).personality, 120),
      voiceTone: compact(asRecord(profile).voiceTone, 80),
    }))
    : [];
  if (
    profiles.length !== 10 || profiles.some((profile) =>
      !profile.name ||
      !["Female", "Male", "Nonbinary"].includes(profile.gender) ||
      !profile.occupation || !profile.attire || !profile.personality ||
      !profile.voiceTone
    )
  ) {
    throw new Error(
      "Vertex must return exactly ten complete interviewer profiles.",
    );
  }
  return profiles;
}

async function createCandidates(
  db: ReturnType<typeof admin>,
  requestedBy: string,
) {
  const result = await vertexGenerate(TEXT_MODEL, {
    contents: [{ role: "user", parts: [{ text: profilePrompt() }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 1 },
  });
  const profiles = parseProfiles(generatedText(result));
  const { data, error } = await db.from("exam_interviewers").insert(
    profiles.map((profile) => ({
      name: profile.name,
      gender: profile.gender,
      occupation: profile.occupation,
      attire: profile.attire,
      personality: profile.personality,
      voice_tone: profile.voiceTone,
      avatar_key: `${
        profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
          /(^-|-$)/g,
          "",
        ) || "interviewer"
      }-${crypto.randomUUID().slice(0, 8)}`,
      status: "pending",
      image_status: "idle",
      video_status: "idle",
      media_mode: "generated",
      source_metadata: {
        source: "vertex-ai-candidate-batch",
        model: TEXT_MODEL,
      },
      created_by: requestedBy || null,
    })),
  ).select("*");
  if (error) {
    throw new Error("Could not create the interviewer candidate batch.");
  }
  // Candidate review in the source workflow happens only after each profile has
  // a real portrait and listening video, not a browser placeholder.
  for (const interviewer of data ?? []) {
    await enqueueJob(db, {
      jobType: "interviewer",
      id: compact(interviewer.id, 80),
      requestedBy,
    });
  }
  return { interviewers: data ?? [], model: TEXT_MODEL };
}

async function approvedInterviewer(
  db: ReturnType<typeof admin>,
  interviewerId: string,
) {
  if (!isUuid(interviewerId)) throw new Error("Choose a valid interviewer.");
  const { data, error } = await db.from("exam_interviewers").select("*").eq(
    "id",
    interviewerId,
  ).maybeSingle();
  if (error || !data || data.status !== "approved") {
    throw new Error(
      "Approve the selected interviewer before creating a test set.",
    );
  }
  return data as Interviewer;
}

async function suggestBriefs(
  db: ReturnType<typeof admin>,
  title: string,
  interviewerId: string,
) {
  const interviewer = await approvedInterviewer(db, interviewerId);
  const prompt =
    `Return JSON only: {"listenRepeatTheme":"...","interviewTheme":"..."}.\n\nSuggest two distinct, concrete TOEFL-style scenario topics for the named set "${title}". A theme is internal writing context only: it is not candidate-facing text, a test sentence, or a question. Each value must be a neutral 2–16 word noun phrase. Do not use a question mark, second-person language, commands, or test instructions.\n\nThe Listen and Repeat topic should name a concrete role and situation that can lead to short factual messages. The interview topic should name an accessible research-study topic that ${interviewer.name}, a ${interviewer.personality} ${interviewer.occupation}, could ask about. Keep both specific and non-specialist. Do not use broad themes such as campus life, daily routines, work, or travel.`;
  const result = await vertexGenerate(TEXT_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 1 },
  });
  return { themes: parseThemes(generatedText(result)), model: TEXT_MODEL };
}

async function createDraft(
  db: ReturnType<typeof admin>,
  input: Row,
  requestedBy: string,
) {
  const title = compact(input.title, 140);
  if (title.length < 2) {
    throw new Error(
      "Add a title and two clear scenario briefs before creating the exam draft.",
    );
  }
  const interviewerId = compact(input.interviewerId, 80);
  const interviewer = await approvedInterviewer(db, interviewerId);
  const listenRepeatTheme = theme(
    input.listenRepeatTheme,
    "Listen and Repeat brief",
  );
  const interviewTheme = theme(input.interviewTheme, "Take an Interview brief");
  const [{ data: previousItems }, { data: previousNarration }] = await Promise
    .all([
      db.from("exam_set_items").select("prompt").limit(160),
      db.from("exam_set_narration").select("script").limit(160),
    ]);
  const existing = [
    ...(previousItems ?? []).map((row) => compact(row.prompt)),
    ...(previousNarration ?? []).map((row) => compact(row.script)),
  ].filter(Boolean).slice(0, 160).map((script) => `- ${script}`).join("\n") ||
    "- No earlier scripts";
  const prompt =
    `Return JSON only: {"listenRepeatScenario":"...","interviewScenario":"...","listenRepeat":[...],"interviewQuestions":[...]}. Create two candidate-facing scenario setups, exactly 7 original Listen and Repeat sentences, and exactly 4 original interview questions in natural English. Never expose internal theme labels or generation metadata to the candidate.\n\nLISTEN AND REPEAT THEME: ${listenRepeatTheme}\nCreate one 18–42 word candidate-facing scenario setup in this exact structure: (1) "You are" followed by a natural role and situation based on the theme; (2) "Listen to the speaker and repeat what he or she says."; (3) "Repeat only once." Do not call it a task, theme, scenario, or practice item. Create 7 factual sentences of 8–22 words.\n\nINTERVIEW THEME: ${interviewTheme}\nCreate one 36–60 word candidate-facing scenario setup in this exact four-sentence structure: (1) "You have volunteered to participate in a research study about" followed by the topic; (2) "You will have a short online interview with a researcher."; (3) "The researcher will ask you some questions."; (4) "Please answer the interviewer's questions." Create 4 conversational questions of 5–20 words, each ending with a question mark. The interviewer is ${interviewer.name}, a ${interviewer.personality} ${interviewer.occupation}. Questions must progress: factual experience, reflection/prediction, two-sided evaluation with justification, broader policy/societal opinion.\n\nDo not reuse, paraphrase closely, or share a distinctive four-word phrase with any prior exam script:\n${existing}`;
  const generated = await vertexGenerate(TEXT_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 1 },
  });
  const draft = parseDraft(generatedText(generated));
  const { data: set, error: setError } = await db.from("exam_sets").insert({
    title,
    interviewer_id: interviewerId,
    listen_repeat_theme: listenRepeatTheme,
    interview_theme: interviewTheme,
    scene_description:
      `A clear, inclusive generated scene for ${listenRepeatTheme}.`,
    status: "draft",
    media_mode: "generated",
    created_by: requestedBy || null,
  }).select("*").single();
  if (setError || !set) throw new Error("Could not create the exam set.");
  const narration = [
    {
      cue_key: "section_intro",
      label: "Speaking section introduction",
      script:
        "In the Speaking section, you will answer up to 11 questions to demonstrate how well you can speak English. There are two types of tasks.",
      source: "fixed",
      position: 1,
    },
    {
      cue_key: "listen_repeat_instructions",
      label: "Listen and Repeat directions",
      script:
        "You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock indicates your speaking time. There is no preparation time.",
      source: "fixed",
      position: 2,
    },
    {
      cue_key: "listen_repeat_scenario",
      label: "Listen and Repeat scenario",
      script: draft.listenRepeatScenario,
      source: "generated",
      position: 3,
    },
    {
      cue_key: "interview_instructions",
      label: "Take an Interview directions",
      script:
        "An interviewer will ask you questions. Answer the questions and be sure to say as much as you can in the time allowed. There is no preparation time.",
      source: "fixed",
      position: 4,
    },
    {
      cue_key: "interview_scenario",
      label: "Take an Interview scenario",
      script: draft.interviewScenario,
      source: "generated",
      position: 5,
    },
  ];
  const items = [
    ...draft.listenRepeat.map((prompt, index) => ({
      module: "listen_repeat",
      position: index + 1,
      label: `Sentence ${index + 1}`,
      prompt,
      response_seconds: 12,
      visual_target: listenRepeatTheme,
      audio_status: "idle",
      visual_status: "idle",
      video_status: "idle",
      media_mode: "generated",
    })),
    ...draft.interviewQuestions.map((prompt, index) => ({
      module: "interview",
      position: index + 1,
      label: `Question ${index + 1}`,
      prompt,
      response_seconds: index < 2 ? 30 : 45,
      visual_target: "",
      audio_status: "idle",
      visual_status: "idle",
      video_status: "idle",
      media_mode: "generated",
    })),
  ];
  const [narrationResult, itemsResult] = await Promise.all([
    db.from("exam_set_narration").insert(
      narration.map((cue) => ({
        ...cue,
        exam_set_id: set.id,
        media_status: "idle",
      })),
    ),
    db.from("exam_set_items").insert(
      items.map((item) => ({ ...item, exam_set_id: set.id })),
    ),
  ]);
  if (narrationResult.error || itemsResult.error) {
    await db.from("exam_sets").delete().eq("id", set.id);
    throw new Error("Could not build the exam items. Nothing was saved.");
  }
  return { set, model: TEXT_MODEL };
}

async function manualPoll(db: ReturnType<typeof admin>, input: Row) {
  const interviewerId = compact(input.interviewerId, 80);
  const itemId = compact(input.itemId, 80);
  if (isUuid(interviewerId)) {
    const { data } = await db.from("exam_interviewers").select(
      "id, source_metadata, video_status",
    ).eq("id", interviewerId).maybeSingle();
    if (!data) throw new Error("The interviewer could not be found.");
    await pollInterviewerVideo(db, data as Row);
    return { status: "polled" };
  }
  if (isUuid(itemId)) {
    const { data } = await db.from("exam_set_items").select(
      "id, exam_set_id, media_metadata, video_status",
    ).eq("id", itemId).eq("module", "interview").maybeSingle();
    if (!data) throw new Error("The interviewer question could not be found.");
    await pollQuestionVideo(db, data as Row);
    return { status: "polled" };
  }
  throw new Error("Choose a video to poll.");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }
  const input = await req.json().catch(() => ({})) as Row;
  const action = compact(input.action, 80);
  const db = admin();

  if (action === "process-next") {
    if (!(await validSchedulerRequest(req, db))) {
      return json(req, { error: "permission-denied" }, 403);
    }
    const work = processNext().catch((error) =>
      console.error("exam pipeline queue failed", safeError(error))
    );
    const runtime = (globalThis as {
      EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
    }).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(work);
      return json(req, { accepted: true });
    }
    await work;
    return json(req, { accepted: true });
  }

  if (!hasServiceRoleAuthorization(req)) {
    return json(req, { error: "permission-denied" }, 403);
  }
  try {
    const requestedBy = compact(input.requestedBy, 120);
    if (action === "create-candidates") {
      return json(req, {
        ok: true,
        ...(await createCandidates(db, requestedBy)),
      });
    }
    if (action === "suggest-briefs") {
      return json(req, {
        ok: true,
        ...(await suggestBriefs(
          db,
          compact(input.title, 140) || "Speaking practice set",
          compact(input.interviewerId, 80),
        )),
      });
    }
    if (action === "create-draft") {
      return json(req, {
        ok: true,
        ...(await createDraft(db, input, requestedBy)),
      });
    }
    if (action === "enqueue") {
      const jobType = compact(input.jobType, 20) as JobType;
      const id = compact(
        input.interviewerId || input.examSetId || input.narrationId ||
          input.itemId,
        80,
      );
      if (
        !["interviewer", "exam", "narration", "item", "visuals"].includes(
          jobType,
        )
      ) throw new Error("Choose a valid pipeline job.");
      return json(req, {
        ok: true,
        ...(await enqueueJob(db, { jobType, id, requestedBy })),
      }, 202);
    }
    if (action === "poll") {
      return json(req, { ok: true, ...(await manualPoll(db, input)) });
    }
    return json(req, { error: "unsupported_action" }, 400);
  } catch (cause) {
    return json(req, { error: safeError(cause) }, 400);
  }
});
