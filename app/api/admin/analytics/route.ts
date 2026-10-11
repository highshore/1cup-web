import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { createServerClientRSC } from "../../../lib/supabase/server";
import { getAdminAnalytics } from "../../../lib/features/admin-analytics/service";
import type { AnalyticsRange, AnalyticsComparison } from "../../../lib/features/admin-analytics/types";

export const dynamic = "force-dynamic";

const ALLOWED_RANGES: AnalyticsRange[] = ["day", "week", "month", "year", "custom"];
const validDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + "T00:00:00+09:00");
  return Number.isFinite(timestamp) && new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10) === value;
};

// Server-side aggregate snapshots, keyed by range and comparison.
const historicalSnapshot = unstable_cache(
  async (range: AnalyticsRange, from: string, to: string, compare: AnalyticsComparison) => getAdminAnalytics(range, from, to, compare),
  ["onecup-historical-analytics-v1"],
  { revalidate: 86400, tags: ["admin-analytics"] },
);
const recentSnapshot = unstable_cache(
  async (range: AnalyticsRange, from: string, to: string, compare: AnalyticsComparison) => getAdminAnalytics(range, from, to, compare),
  ["onecup-recent-analytics-v1"],
  { revalidate: 60, tags: ["admin-analytics"] },
);
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

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const compare = request.nextUrl.searchParams.get("compare");
    if (!validDate(from) || !validDate(to)) {
      return NextResponse.json({ error: "Valid from/to dates required." }, { status: 400, headers: noStore });
    }
    const start = Date.parse(from + "T00:00:00+09:00");
    const end = Date.parse(to + "T00:00:00+09:00");
    const now = Date.now();
    if (start > end || start > now || end - start > 366 * 5 * 86400000) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400, headers: noStore });
    }
    const comparison: AnalyticsComparison = compare === "yearAgo" || compare === "none" ? compare : "previous";
    const force = request.nextUrl.searchParams.get("refresh") === "1";
    const todayKst = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
    const historical = to! < todayKst;
    const data = force
      ? await getAdminAnalytics(range, from!, to!, comparison)
      : historical
        ? await historicalSnapshot(range, from!, to!, comparison)
        : await recentSnapshot(range, from!, to!, comparison);
    return NextResponse.json({
      ...data,
      freshness: { source: force ? "live" : historical ? "historical-cache" : "recent-cache",
        fetchedAt: new Date().toISOString(), ttlSeconds: force ? 0 : historical ? 86400 : 60 },
    }, { headers: noStore });
  } catch (error) {
    console.error("[admin analytics] Failed to build dashboard:", error);
    return NextResponse.json({ error: "Analytics are temporarily unavailable." }, { status: 500, headers: noStore });
  }
}
