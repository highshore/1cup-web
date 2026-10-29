// Server-only: the lesson audio. Gemini TTS reads each clip once; the WAV goes to the
// public `assets` bucket under a name that hashes everything that shapes the sound
// (model, voices, direction, text), so every reader after the first gets the stored
// file, and editing a lesson's text makes the next play generate a fresh one.
// fillMissingLessonAudio() reads every approved lesson's missing clips in bulk ahead of
// their readers (the daily cron, /api/cron/daily-audio).
import { createHash } from "node:crypto";
import { admin } from "../../../supabase/server";
import { isAudioClip, lessonClips, spokenText, type DailyAudioClip } from "../spoken";
import type { DailyLessonContent } from "./lessons";

const BUCKET = "assets";
const FOLDER = "daily-audio";
const MODEL = process.env.DAILY_TTS_MODEL || "gemini-3.8-flash-lite-tts";

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new DailyAudioError("GEMINI_API_KEY is not configured.", 503);
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(MODEL) + ":generateContent";
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: speechConfig(request.voices) },
  });
  // A bulk run meets the per-minute limit; wait and try again a couple of times.
  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(50_000),
    });
    if (attempt >= 2 || ![429, 500, 503].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 5_000 * 2 ** attempt));
  }
  const payload = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: InlineAudio }> } }>;
  };
  if (!response.ok) {
    console.error("[daily-audio] Gemini TTS request failed", response.status, JSON.stringify(payload).slice(0, 500));
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

interface ClipTarget {
  clip: DailyAudioClip;
  request: SpeechRequest;
  folder: string;
  name: string;
}

function clipTarget(lessonId: string, lesson: LessonText, clip: DailyAudioClip): ClipTarget | null {
  const request = speechRequest(lesson, clip);
  if (!request) return null;
  return { clip, request, folder: `${FOLDER}/${lessonId}`, name: clipFileName(clip, request) };
}

const bucket = () => admin().storage.from(BUCKET);

async function storedNames(folder: string): Promise<string[]> {
  const { data, error } = await bucket().list(folder, { limit: 100 });
  if (error) throw new DailyAudioError("Could not list the stored audio.", 500);
  return (data ?? []).map((file) => file.name);
}

async function generateClip(target: ClipTarget, stored: string[]) {
  const path = `${target.folder}/${target.name}`;
  const { pcm, sampleRate } = await synthesize(target.request);
  const { error } = await bucket().upload(path, wav(pcm, sampleRate), {
    contentType: "audio/wav",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) {
    console.error("[daily-audio] upload failed", path, error.message);
    throw new DailyAudioError("Could not save the audio.", 500);
  }
  // The clip's earlier versions (from before an edit) are never asked for again.
  const stale = stored.filter((name) => name.startsWith(`${target.clip}-`) && name !== target.name);
  if (stale.length > 0) await bucket().remove(stale.map((name) => `${target.folder}/${name}`));
}

// Two readers pressing play together share one generation (per server instance).
const inFlight = new Map<string, Promise<void>>();

async function ensureClip(target: ClipTarget, stored?: string[]): Promise<string> {
  const path = `${target.folder}/${target.name}`;
  const publicUrl = bucket().getPublicUrl(path).data.publicUrl;
  let job = inFlight.get(path);
  if (!job) {
    job = (async () => {
      const names = stored ?? (await storedNames(target.folder));
      if (!names.includes(target.name)) await generateClip(target, names);
    })();
    inFlight.set(path, job);
    job.finally(() => inFlight.delete(path)).catch(() => {});
  }
  await job;
  return publicUrl;
}

type LessonRow = LessonText & { id: string };

function toLessonText(row: { id: string; expression: string; examples: LessonText["examples"] | null; dialogue: LessonText["dialogue"] | null }): LessonRow {
  return { id: row.id, expression: row.expression, examples: row.examples ?? [], dialogue: row.dialogue ?? [] };
}

/** The stored clip's public URL, generating it first if this text has not been read yet. */
export async function lessonAudioUrl(lessonId: string, clip: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId) || !isAudioClip(clip)) throw new DailyAudioError("No such audio.", 404);
  const { data } = await admin().from("daily_lessons").select("id, expression, examples, dialogue").eq("id", lessonId).maybeSingle();
  const target = data ? clipTarget(lessonId, toLessonText(data), clip) : null;
  if (!target) throw new DailyAudioError("No such audio.", 404);
  return ensureClip(target);
}

async function inPool<T>(items: T[], concurrency: number, work: (item: T) => Promise<void>, until = Infinity) {
  let next = 0;
  const worker = async () => {
    while (next < items.length && Date.now() < until) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

export interface AudioFillResult {
  lessons: number;
  missing: number;
  generated: number;
  failed: number;
  /** Clips left for the next run because the time budget ran out. */
  remaining: number;
}

/**
 * Reads every missing clip of these lessons (all approved lessons when no ids are
 * given) and stores it, several requests at a time, stopping for the next run once the
 * time budget is spent. Clips already stored are skipped, so it is safe to run again.
 */
export async function fillMissingLessonAudio(
  { lessonIds, budgetMs = 200_000, concurrency = 4 }: { lessonIds?: string[]; budgetMs?: number; concurrency?: number } = {},
): Promise<AudioFillResult> {
  const until = Date.now() + budgetMs;
  let query = admin().from("daily_lessons").select("id, expression, examples, dialogue").order("publish_on");
  query = lessonIds ? query.in("id", lessonIds) : query.eq("status", "ready");
  const { data, error } = await query;
  if (error) throw new DailyAudioError("Could not load the lessons.", 500);
  const lessons = (data ?? []).map(toLessonText);

  const missing: Array<{ target: ClipTarget; stored: string[] }> = [];
  await inPool(lessons, 10, async (lesson) => {
    const stored = await storedNames(`${FOLDER}/${lesson.id}`);
    for (const clip of lessonClips(lesson)) {
      const target = clipTarget(lesson.id, lesson, clip);
      if (target && !stored.includes(target.name)) missing.push({ target, stored });
    }
  });

  let generated = 0;
  let failed = 0;
  await inPool(
    missing,
    concurrency,
    async ({ target, stored }) => {
      try {
        await ensureClip(target, stored);
        generated += 1;
      } catch (err) {
        failed += 1;
        console.error("[daily-audio] clip failed", target.folder, target.clip, (err as Error)?.message);
      }
    },
    until,
  );
  const result = { lessons: lessons.length, missing: missing.length, generated, failed, remaining: missing.length - generated - failed };
  console.log("[daily-audio] fill", JSON.stringify(result));
  return result;
}
