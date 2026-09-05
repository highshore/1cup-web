import { NextResponse } from "next/server";

import { fetchMeetupEventsPageServer } from "../../../../lib/features/meetup/services/meetup_public_active_server";

const PAGE_SIZE = 50;
const MAX_SCAN = 500;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const eventId = decodeURIComponent(id || "").trim();

  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  try {
    let offset = 0;
    while (offset < MAX_SCAN) {
      const page = await fetchMeetupEventsPageServer(offset, PAGE_SIZE);
      const event = page.events.find((item) => item.id === eventId);
      if (event) {
        return NextResponse.json(event, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      if (page.lastDoc === null) break;
      offset = page.lastDoc;
    }

    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  } catch (error) {
    console.error("Failed to load meetup detail", error);
    return NextResponse.json(
      { error: "Meetup service temporarily unavailable" },
      { status: 503 },
    );
  }
}
