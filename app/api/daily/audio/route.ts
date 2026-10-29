import { NextResponse } from "next/server";
import { DailyAudioError, lessonAudioUrl } from "../../../lib/features/daily/server/audio";

export const runtime = "nodejs";
// The first play of a clip waits for Gemini to read it.
export const maxDuration = 60;

// GET /api/daily/audio?lesson=<id>&clip=<expression|example-N|dialogue>
// Redirects to the stored WAV, so an <audio> element can play it directly. The text read
// always comes from the lesson row, never from the request.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    const url = await lessonAudioUrl(params.get("lesson") ?? "", params.get("clip") ?? "");
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof DailyAudioError ? error.status : 500;
    if (status >= 500) console.error("api/daily/audio:", error);
    return NextResponse.json({ error: "audio unavailable" }, { status });
  }
}
