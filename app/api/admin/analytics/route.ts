import { NextRequest, NextResponse } from "next/server";

import { createServerClientRSC } from "../../../lib/supabase/server";
import { getAdminAnalytics } from "../../../lib/features/admin-analytics/service";
import type { AnalyticsRange } from "../../../lib/features/admin-analytics/types";

export const dynamic = "force-dynamic";

const ALLOWED_RANGES: AnalyticsRange[] = ["month", "lastMonth", "3m", "12m"];

export async function GET(request: NextRequest) {
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    const supabase = await createServerClientRSC();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claims?.claims?.sub) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401, headers: noStore });
    }

    // Never trust user-editable JWT metadata for authorization.
    const { data: rows, error: profileError } = await supabase.rpc("current_user_row");
    const profile = Array.isArray(rows) ? rows[0] : rows;
    if (profileError || profile?.account_status !== "admin") {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403, headers: noStore });
    }

    const requestedRange = request.nextUrl.searchParams.get("range");
    const range: AnalyticsRange = ALLOWED_RANGES.includes(requestedRange as AnalyticsRange)
      ? requestedRange as AnalyticsRange
      : "month";

    const data = await getAdminAnalytics(range);
    return NextResponse.json(data, { headers: noStore });
  } catch (error) {
    console.error("[admin analytics] Failed to build dashboard:", error);
    return NextResponse.json({ error: "Analytics are temporarily unavailable." }, { status: 500, headers: noStore });
  }
}
