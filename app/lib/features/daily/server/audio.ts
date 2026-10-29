// Server-only: the lesson audio. Gemini TTS reads each clip once; the WAV goes to the
// public `assets` bucket under a name that hashes everything that shapes the sound
// (model, voices, direction, text), so every reader after the first gets the stored
// file, and editing a lesson's text makes the next play generate a fresh one.
import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { admin } from "../../../supabase/server";
import { isAudioClip, lessonClips, spokenText, type DailyAudioClip } from "../spoken";
import type { DailyLessonContent } from "./lessons";

const BUCKET = "assets";
const FOLDER = "daily-audio";
const MODEL = process.env.VERTEX_AI_DAILY_TTS_MODEL || "gemini-3.8-flash-lite-tts";
const VERTEX_PROJECT = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "";
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || "global";

// The expression and examples share one voice; the dialogue's two people get two.
const NARRATOR_VOICE = "Kore";
const DIALOGUE_VOICES = ["Kore", "Puck"] as const;

export class DailyAudioError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

type LessonText = Pick<DailyLessonContent, "expression" | "examples" | "dialogue">;

interface SpeechRequest {
  prompt: string;
  /** One voice, or one per dialogue speaker (named as in the prompt). */
  voices: Array<{ speaker: string | null; voice: string }>;
}

// The two people in a dialogue, named the way the prompt writes them. Gemini takes at
// most two configured speakers; anything else is read by turns, as the page shows it.
function dialogueSpeakers(dialogue: LessonText["dialogue"]): string[] {
  const names = [...new Set(dialogue.map((line) => (line.speaker ?? "").replace(/[^A-Za-z0-9]/g, "")).filter(Boolean))];
  const byTurn = dialogue.map((line, index) => (line.speaker ?? "").replace(/[^A-Za-z0-9]/g, "") || (index % 2 === 0 ? "A" : "B"));
  if (names.length === 2 && byTurn.every((name) => names.includes(name))) return byTurn;
  return dialogue.map((_, index) => (index % 2 === 0 ? "A" : "B"));
}

function speechRequest(lesson: LessonText, clip: DailyAudioClip): SpeechRequest | null {
  if (clip === "expression") {
    return {
      prompt:
        "Say this English expression clearly and a little slowly, the way a friendly American English teacher models it for a learner. Say only the expression.\n\n"
        + spokenText(lesson.expression),
      voices: [{ speaker: null, voice: NARRATOR_VOICE }],
    };
  }
  if (clip === "dialogue") {
    if (lesson.dialogue.length === 0) return null;
    const turns = dialogueSpeakers(lesson.dialogue);
    const people = [...new Set(turns)];
    const script = lesson.dialogue.map((line, index) => `${turns[index]}: ${spokenText(line.en)}`).join("\n");
    return {
      prompt:
        `Read this conversation between ${people.join(" and ")} as native American English speakers talking naturally at work: relaxed, warm and at an everyday pace. Do not read the speaker names aloud.\n\n`
        + script,
      voices: people.map((speaker, index) => ({ speaker: people.length > 1 ? speaker : null, voice: DIALOGUE_VOICES[index % 2] })),
    };
  }
  const example = lesson.examples[Number(clip.slice("example-".length))];
  if (!example) return null;
  return {
    prompt:
      "Read this sentence aloud the way a native American English speaker says it to a colleague: natural, conversational and at an everyday pace.\n\n"
      + spokenText(example.en),
    voices: [{ speaker: null, voice: NARRATOR_VOICE }],
  };
}

function clipFileName(clip: DailyAudioClip, request: SpeechRequest) {
  const hash = createHash("sha256").update(JSON.stringify({ model: MODEL, ...request })).digest("hex").slice(0, 16);
  return `${clip}-${hash}.wav`;
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

function speechConfig(voices: SpeechRequest["voices"]) {
  const voiceConfig = (voice: string) => ({ prebuiltVoiceConfig: { voiceName: voice } });
  if (voices.length === 1) return { voiceConfig: voiceConfig(voices[0].voice) };
  return {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: voices.map(({ speaker, voice }) => ({ speaker, voiceConfig: voiceConfig(voice) })),
    },
  };
}

type InlineAudio = { mimeType?: string; data?: string };

// Gemini answers with raw 16-bit little-endian mono PCM ("audio/L16;codec=pcm;rate=24000").
async function synthesize(request: SpeechRequest): Promise<{ pcm: Buffer; sampleRate: number }> {
  if (!VERTEX_PROJECT) throw new DailyAudioError("Vertex AI is not configured.", 503);
  const token = await buildGoogleAuth().getAccessToken();
  if (!token) throw new DailyAudioError("Vertex AI access token is unavailable.", 503);
  const endpoint = "https://aiplatform.googleapis.com/v1/projects/" + encodeURIComponent(VERTEX_PROJECT)
    + "/locations/" + encodeURIComponent(VERTEX_LOCATION)
    + "/publishers/google/models/" + encodeURIComponent(MODEL) + ":generateContent";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: speechConfig(request.voices) },
    }),
    signal: AbortSignal.timeout(50_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: InlineAudio }> } }>;
  };
  if (!response.ok) {
    console.error("[daily-audio] Vertex TTS request failed", response.status, JSON.stringify(payload).slice(0, 500));
    throw new DailyAudioError("The voice service is temporarily unavailable.", 502);
  }
  const parts = (payload.candidates?.[0]?.content?.parts ?? []).map((part) => part.inlineData).filter((part): part is InlineAudio => Boolean(part?.data));
  if (parts.length === 0) throw new DailyAudioError("The voice service returned no audio.", 502);
  const rate = Number(/rate=(\d+)/.exec(parts[0].mimeType ?? "")?.[1] ?? 24000);
  return { pcm: Buffer.concat(parts.map((part) => Buffer.from(part.data!, "base64"))), sampleRate: rate };
}

function wav(pcm: Buffer, sampleRate: number) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Two readers pressing play together share one generation (per server instance).
const inFlight = new Map<string, Promise<string>>();

async function ensureClip(lessonId: string, lesson: LessonText, clip: DailyAudioClip): Promise<string> {
  const request = speechRequest(lesson, clip);
  if (!request) throw new DailyAudioError("This lesson has no such audio.", 404);
  const folder = `${FOLDER}/${lessonId}`;
  const name = clipFileName(clip, request);
  const path = `${folder}/${name}`;
  const storage = admin().storage.from(BUCKET);
  const publicUrl = storage.getPublicUrl(path).data.publicUrl;

  const pending = inFlight.get(path);
  if (pending) return pending;
  const job = (async () => {
    const { data: existing } = await storage.list(folder, { limit: 100 });
    if (existing?.some((file) => file.name === name)) return publicUrl;

    const { pcm, sampleRate } = await synthesize(request);
    const { error } = await storage.upload(path, wav(pcm, sampleRate), {
      contentType: "audio/wav",
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) {
      console.error("[daily-audio] upload failed", path, error.message);
      throw new DailyAudioError("Could not save the audio.", 500);
    }
    // The clip's earlier versions (from before an edit) are never asked for again.
    const stale = (existing ?? []).filter((file) => file.name.startsWith(`${clip}-`) && file.name !== name);
    if (stale.length > 0) await storage.remove(stale.map((file) => `${folder}/${file.name}`));
    return publicUrl;
  })();
  inFlight.set(path, job);
  try {
    return await job;
  } finally {
    inFlight.delete(path);
  }
}

async function loadLessonText(lessonId: string): Promise<LessonText | null> {
  const { data } = await admin().from("daily_lessons").select("expression, examples, dialogue").eq("id", lessonId).maybeSingle();
  if (!data) return null;
  return { expression: data.expression, examples: data.examples ?? [], dialogue: data.dialogue ?? [] };
}

/** The stored clip's public URL, generating it first if this text has not been read yet. */
export async function lessonAudioUrl(lessonId: string, clip: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId) || !isAudioClip(clip)) throw new DailyAudioError("No such audio.", 404);
  const lesson = await loadLessonText(lessonId);
  if (!lesson) throw new DailyAudioError("No such lesson.", 404);
  return ensureClip(lessonId, lesson, clip);
}

/** Reads every clip of these lessons ahead of their first reader. Failures only log: a clip
 *  that is still missing is generated when someone first plays it. */
export async function prepareLessonAudio(lessonIds: string[]) {
  for (const lessonId of lessonIds) {
    const lesson = await loadLessonText(lessonId);
    if (!lesson) continue;
    const results = await Promise.allSettled(lessonClips(lesson).map((clip) => ensureClip(lessonId, lesson, clip)));
    for (const result of results) {
      if (result.status === "rejected") console.error("[daily-audio] prepare failed", lessonId, (result.reason as Error)?.message);
    }
  }
}
