import { NextRequest, NextResponse } from "next/server";

import { fetchMeetupLeaderboardsServer } from "../../../lib/features/meetup/services/meetup_public_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || 5);

  try {
    const result = await fetchMeetupLeaderboardsServer(limit);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Public meetup leaderboards API failed", error);
    return NextResponse.json(
      { error: "service_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
