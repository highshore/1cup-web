import { NextRequest, NextResponse } from "next/server";

import { getDeployedExams } from "../../../lib/features/speaking-test/services/speaking_test_server";
import { SPEAKING_TEST_CATEGORIES, type SpeakingTestCategory } from "../../../lib/features/speaking-test/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  if (!(SPEAKING_TEST_CATEGORIES as readonly string[]).includes(category || "")) {
    return NextResponse.json({ error: "Choose a valid test category." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      { tests: await getDeployedExams(category as SpeakingTestCategory) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[speaking-test] catalog failed", error);
    return NextResponse.json({ error: "Tests are temporarily unavailable." }, { status: 500 });
  }
}
