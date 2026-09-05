import { NextResponse } from "next/server";

import { getDeployedExam } from "../../../../lib/features/speaking-test/services/speaking_test_server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ examSetId: string }> }) {
  try {
    const { examSetId } = await params;
    const test = await getDeployedExam(examSetId);
    if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 });
    return NextResponse.json(test, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[speaking-test] test detail failed", error);
    return NextResponse.json({ error: "This test is temporarily unavailable." }, { status: 500 });
  }
}
