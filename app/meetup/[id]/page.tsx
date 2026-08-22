import { Suspense } from "react";
import { notFound } from "next/navigation";

import { EventDetailClient } from "./EventDetailClient";
import GlobalLoadingScreen from "../../lib/components/GlobalLoadingScreen";
import { fetchMeetupEventsPageServer } from "../../lib/features/meetup/services/meetup_public_server";

interface MeetupDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

const PAGE_SIZE = 50;
const MAX_SCAN = 500;

export const dynamic = "force-dynamic";

async function meetupExists(id: string) {
  let offset = 0;
  while (offset < MAX_SCAN) {
    const page = await fetchMeetupEventsPageServer(offset, PAGE_SIZE);
    if (page.events.some((event) => event.id === id)) return true;
    if (page.lastDoc === null) return false;
    offset = page.lastDoc;
  }
  return false;
}

export default async function EventDetailPage({ params }: MeetupDetailPageProps) {
  const { id } = await params;
  const eventId = decodeURIComponent(id || "").trim();

  if (!eventId || !(await meetupExists(eventId))) notFound();

  return (
    <Suspense fallback={<GlobalLoadingScreen />}>
      <EventDetailClient />
    </Suspense>
  );
}
