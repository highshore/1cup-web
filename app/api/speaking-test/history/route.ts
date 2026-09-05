import { NextResponse } from "next/server";

import { getSpeakingAttemptHistory } from "../../../lib/features/speaking-test/services/speaking_test_server";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      { attempts: await getSpeakingAttemptHistory() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load speaking test history.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Please sign in") ? 401 : 500 });
  }
}
