import { NextRequest, NextResponse } from "next/server";

import { evaluateSpeakingAttempt } from "../../../lib/features/speaking-test/services/speaking_test_server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await request.json() as { attemptId?: unknown; responses?: unknown };
    if (typeof body.attemptId !== "string") {
      return NextResponse.json({ error: "Invalid assessment request." }, { status: 400 });
    }
    return NextResponse.json(await evaluateSpeakingAttempt(body.attemptId, body.responses), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "We could not generate your report. Please try again.";
    console.error("[speaking-test] assessment failed", message);
    return NextResponse.json({ error: message }, { status: message.startsWith("Please sign in") ? 401 : 400 });
  }
}
