import { NextRequest, NextResponse } from "next/server";

import { fetchMeetupEventsPageServer } from "../../../lib/features/meetup/services/meetup_public_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
  const limit = Number(request.nextUrl.searchParams.get("limit") || 5);

  try {
    const result = await fetchMeetupEventsPageServer(offset, limit);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Public meetup events API failed", error);
    return NextResponse.json(
      { error: "service_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
