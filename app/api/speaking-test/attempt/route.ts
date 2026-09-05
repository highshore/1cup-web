import { NextRequest, NextResponse } from "next/server";

import { createSpeakingAttempt } from "../../../lib/features/speaking-test/services/speaking_test_server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await request.json() as { examSetId?: unknown };
    if (typeof body.examSetId !== "string") {
      return NextResponse.json({ error: "Choose a valid test." }, { status: 400 });
    }
    return NextResponse.json(await createSpeakingAttempt(body.examSetId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The test could not be started.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Please sign in") ? 401 : 400 });
  }
}
