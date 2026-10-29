import { NextResponse } from "next/server";
import { fillMissingLessonAudio } from "../../../lib/features/daily/server/audio";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/daily-audio — Vercel Cron, daily at 05:17 KST, before the first delivery
// (vercel.json): reads every approved lesson's missing clips in bulk and stores them, so
// readers find the audio ready.
// It needs no secret: it only ever reads text from approved lessons and skips clips
// already stored, so another run costs nothing once the audio exists.
export async function GET() {
  try {
    return NextResponse.json(await fillMissingLessonAudio());
  } catch (error) {
    console.error("api/cron/daily-audio:", error);
    return NextResponse.json({ error: "audio fill failed" }, { status: 500 });
  }
}
