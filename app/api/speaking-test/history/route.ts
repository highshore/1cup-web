import { NextResponse } from "next/server";

import { createServerClientRSC } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerClientRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase
    .from("speaking_test_attempts")
    .select("id, overall_cefr, overall_band, overall_score, report, completed_at")
    .order("completed_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[speaking-test] could not load history", error.message);
    return NextResponse.json({ error: "Could not load speaking test history." }, { status: 500 });
  }

  return NextResponse.json({
    attempts: (data ?? []).map((attempt) => ({
      id: attempt.id,
      cefr: attempt.overall_cefr,
      band: attempt.overall_band,
      score: attempt.overall_score,
      report: attempt.report,
      completedAt: attempt.completed_at,
    })),
  });
}
