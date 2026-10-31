// Server-only: reel narration with Gemini TTS, the same model and narrator voice as the
// One Cup Daily lesson audio (app/lib/features/daily/server/audio.ts), returned as raw
// 16-bit mono PCM so the reel builder can lay clips and silences on one timeline.
const MODEL = process.env.SOCIAL_TTS_MODEL || process.env.DAILY_TTS_MODEL || "gemini-3.8-flash-lite-tts";
const VOICE = process.env.SOCIAL_TTS_VOICE || "Kore";

export interface Pcm {
  pcm: Buffer;
  sampleRate: number;
}

const isWav = (bytes: Buffer) =>
  bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE";

// The data chunk of a WAV (Gemini 3.8 appends a C2PA chunk after it, which must not be
// played as sound).
export function wavSamples(bytes: Buffer): Pcm {
  let sampleRate = 24000;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const id = bytes.toString("ascii", at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (id === "fmt ") sampleRate = bytes.readUInt32LE(at + 12);
    if (id === "data") return { pcm: bytes.subarray(at + 8, Math.min(bytes.length, at + 8 + size)), sampleRate };
    at += 8 + size + (size & 1);
  }
  throw new Error("The voice service returned a WAV without audio.");
}

export function wav({ pcm, sampleRate }: Pcm): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesizeNarration(text: string): Promise<Pcm> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  });
  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(50_000),
    });
    if (attempt >= 2 || ![429, 500, 503].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 4_000 * 2 ** attempt));
  }
  const payload = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  };
  if (!response.ok) throw new Error(`Narration voice failed (${response.status}).`);
  const parts = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.inlineData)
    .filter((part): part is { mimeType?: string; data: string } => Boolean(part?.data));
  if (parts.length === 0) throw new Error("The voice service returned no audio.");
  const clips = parts.map((part) => {
    const bytes = Buffer.from(part.data, "base64");
    return isWav(bytes)
      ? wavSamples(bytes)
      : { pcm: bytes, sampleRate: Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24000) };
  });
  return { pcm: Buffer.concat(clips.map((clip) => clip.pcm)), sampleRate: clips[0].sampleRate };
}
