// Server-only: turns a reel draft (slides + one narration line per slide) into an
// Instagram Reel. Each slide becomes a 1080×1920 frame with its narration as a subtitle,
// Gemini TTS reads the narration, and ffmpeg joins the frames (with a short fade-in)
// over the narration track into an H.264/AAC MP4. The first frame doubles as the cover.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";

import { admin } from "../../../supabase/server";
import type { CardSlide, SocialMedia } from "../types";
import { PROFILE_CTA, renderSlidePng } from "./cards";
import { type Pcm, synthesizeNarration, wav } from "./voice";

const run = promisify(execFile);
const FPS = 30;
const LEAD_SECONDS = 0.3; // silence before each line
const TAIL_SECONDS = 0.5; // silence after it, so the viewer can read the frame
const MIN_SLIDE_SECONDS = 2.5;
const FADE_SECONDS = 0.25;

const ffmpegPath = () => process.env.FFMPEG_PATH || ffmpegInstaller.path;

async function inPool<T, R>(items: T[], concurrency: number, work: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index], index);
      }
    }),
  );
  return results;
}

export interface BuiltReel {
  video: Buffer;
  cover: Buffer;
  durationSeconds: number;
}

export async function buildReel(
  slides: CardSlide[],
  narration: string[],
  voice: (text: string) => Promise<Pcm> = synthesizeNarration,
  cta = PROFILE_CTA,
): Promise<BuiltReel> {
  const lines = slides.map((_, index) => (narration[index] ?? "").trim());
  const clips = await inPool(lines, 3, (line) => (line ? voice(line) : Promise.resolve(null)));
  const sampleRate = clips.find((clip) => clip)?.sampleRate ?? 24000;
  if (clips.some((clip) => clip && clip.sampleRate !== sampleRate)) {
    throw new Error("Narration clips came back at different sample rates.");
  }

  // Each slide lasts as long as its line plus breathing room, rounded to whole frames so
  // the picture and the sound stay in step.
  const durations = clips.map((clip) => {
    const spoken = clip ? clip.pcm.length / 2 / sampleRate : 0;
    const seconds = Math.max(MIN_SLIDE_SECONDS, LEAD_SECONDS + spoken + TAIL_SECONDS);
    return Math.ceil(seconds * FPS) / FPS;
  });
  const track = Buffer.concat(
    clips.map((clip, index) => {
      const total = Math.round(durations[index] * sampleRate) * 2;
      const segment = Buffer.alloc(total); // zero = silence
      if (clip) clip.pcm.copy(segment, Math.round(LEAD_SECONDS * sampleRate) * 2, 0, Math.max(0, total - Math.round(LEAD_SECONDS * sampleRate) * 2));
      return segment;
    }),
  );

  const frames = await inPool(slides, 3, (slide, index) =>
    renderSlidePng(slide, index, slides.length, { reel: true, subtitle: lines[index], cta }),
  );

  const dir = await mkdtemp(join(tmpdir(), "reel-"));
  try {
    await Promise.all(frames.map((frame, index) => writeFile(join(dir, `f${index}.png`), frame)));
    await writeFile(join(dir, "narration.wav"), wav({ pcm: track, sampleRate }));
    const output = join(dir, "reel.mp4");

    const inputs = durations.flatMap((seconds, index) => [
      "-loop", "1", "-framerate", String(FPS), "-t", seconds.toFixed(3), "-i", join(dir, `f${index}.png`),
    ]);
    const audioIndex = durations.length;
    // Later scenes fade in; the first frame is the hook and must be readable at once.
    const filter =
      durations
        .map(
          (_, index) =>
            `[${index}:v]scale=1080:1920,setsar=1,format=yuv420p${index === 0 ? "" : `,fade=t=in:st=0:d=${FADE_SECONDS}`}[v${index}]`,
        )
        .join(";") +
      ";" +
      durations.map((_, index) => `[v${index}]`).join("") +
      `concat=n=${durations.length}:v=1:a=0[v]`;

    await run(
      ffmpegPath(),
      [
        "-y", "-loglevel", "error",
        ...inputs,
        "-i", join(dir, "narration.wav"),
        "-filter_complex", filter,
        "-map", "[v]", "-map", `${audioIndex}:a`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", String(FPS),
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
        "-movflags", "+faststart", "-shortest",
        output,
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: 180_000 },
    );

    return {
      video: await readFile(output),
      cover: await sharp(frames[0]).jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
      durationSeconds: durations.reduce((sum, seconds) => sum + seconds, 0),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function renderAndStoreReel(
  postId: string,
  slides: CardSlide[],
  narration: string[],
  cta = PROFILE_CTA,
): Promise<SocialMedia[]> {
  const reel = await buildReel(slides, narration, synthesizeNarration, cta);
  const hash = createHash("sha256").update(JSON.stringify([slides, narration, cta])).digest("hex").slice(0, 12);
  const storage = admin().storage.from("assets");
  const videoPath = `social/${postId}/reel-${hash}.mp4`;
  const coverPath = `social/${postId}/reel-cover-${hash}.jpg`;
  const [videoUpload, coverUpload] = await Promise.all([
    storage.upload(videoPath, reel.video, { contentType: "video/mp4", upsert: true }),
    storage.upload(coverPath, reel.cover, { contentType: "image/jpeg", upsert: true }),
  ]);
  if (videoUpload.error) throw new Error(`Unable to store the reel: ${videoUpload.error.message}`);
  if (coverUpload.error) throw new Error(`Unable to store the reel cover: ${coverUpload.error.message}`);
  return [
    { url: storage.getPublicUrl(videoPath).data.publicUrl, kind: "video" },
    { url: storage.getPublicUrl(coverPath).data.publicUrl, kind: "image" },
  ];
}
