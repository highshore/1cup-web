import { NextResponse } from "next/server";
import {
  generateTranscriptCopilot,
  transcriptCopilotFallback,
  type TranscriptCopilotRequest,
} from "../../lib/features/transcript/services/vertex_copilot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: TranscriptCopilotRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(transcriptCopilotFallback);
  }

  try {
    return NextResponse.json(await generateTranscriptCopilot(body));
  } catch (error) {
    console.error("[Copilot] Vertex generation error:", error);
    // Coaching is optional during a live conversation. Keep recording usable
    // and quiet if the provider is temporarily unavailable.
    return NextResponse.json(transcriptCopilotFallback);
  }
}
