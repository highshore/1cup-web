import { NextResponse } from "next/server";

import { admin } from "../../lib/supabase/server";

export async function GET() {
  try {
    const { data, error } = await admin()
      .from("celebrations")
      .select("*")
      .abortSignal(AbortSignal.timeout(7_000));

    if (error) throw error;

    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to load achievements", error);
    return NextResponse.json(
      { error: "Achievement service temporarily unavailable" },
      { status: 503 },
    );
  }
}
