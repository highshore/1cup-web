import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";

import { EventDetailClient } from "./EventDetailClient";
import GlobalLoadingScreen from "../../lib/components/GlobalLoadingScreen";
import { fetchMeetupEventsPageServer } from "../../lib/features/meetup/services/meetup_public_server";
import type { MeetupEvent } from "../../lib/features/meetup/types/meetup_types";
import { getMeetupRouteSlug, routeSlugEquals } from "../../lib/seo/route_slugs";

interface MeetupDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

const SITE_URL = "https://1cupenglish.com";
const PAGE_SIZE = 50;
const MAX_SCAN = 500;

export const dynamic = "force-dynamic";

async function resolveMeetup(routeValue: string): Promise<MeetupEvent | null> {
  let offset = 0;
  while (offset < MAX_SCAN) {
    const page = await fetchMeetupEventsPageServer(offset, PAGE_SIZE);
    const event = page.events.find(
      (item) =>
        item.id === routeValue ||
        routeSlugEquals(getMeetupRouteSlug(item), routeValue),
    );
    if (event) return event;
    if (page.lastDoc === null) return null;
    offset = page.lastDoc;
  }
  return null;
}

function eventDescription(event: MeetupEvent) {
  const description = event.description?.replace(/\s+/g, " ").trim();
  if (description) return description.slice(0, 180);
  return `1 Cup English의 서울 영어 토론 모임입니다. ${event.location_name}에서 시사, 기술, 비즈니스, 커리어 주제로 소그룹 영어 토론을 진행합니다.`;
}

function eventStartIso(event: MeetupEvent) {
  return `${event.date}T${event.time}:00+09:00`;
}

function eventEndIso(event: MeetupEvent) {
  const start = new Date(eventStartIso(event));
  start.setMinutes(start.getMinutes() + Math.max(0, event.duration_minutes || 0));
  return start.toISOString();
}

export default async function EventDetailPage({ params }: MeetupDetailPageProps) {
  const { id } = await params;
  const routeValue = decodeURIComponent(id || "").trim();
  if (!routeValue) notFound();

  const event = await resolveMeetup(routeValue);
  if (!event) notFound();

  const canonicalSlug = getMeetupRouteSlug(event);
  if (!routeSlugEquals(routeValue, canonicalSlug)) {
    permanentRedirect(`/meetup/${encodeURIComponent(canonicalSlug)}`);
  }

  const canonicalUrl = `${SITE_URL}/meetup/${encodeURIComponent(canonicalSlug)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title || `1 Cup English Meetup in ${event.location_name}`,
    description: eventDescription(event),
    url: canonicalUrl,
    startDate: eventStartIso(event),
    endDate: eventEndIso(event),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.location_name,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.location_address,
        addressLocality: "Seoul",
        addressCountry: "KR",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "1 Cup English",
      alternateName: "영어 한잔",
      url: SITE_URL,
    },
    ...(event.image_urls?.length ? { image: event.image_urls } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Suspense fallback={<GlobalLoadingScreen />}>
        <EventDetailClient />
      </Suspense>
    </>
  );
}

export async function generateMetadata({
  params,
}: MeetupDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const routeValue = decodeURIComponent(id || "").trim();
  const event = routeValue ? await resolveMeetup(routeValue) : null;

  if (!event) {
    return {
      title: "Meetup | 1 Cup English",
      robots: { index: false, follow: false },
    };
  }

  const canonicalSlug = getMeetupRouteSlug(event);
  const canonicalPath = `/meetup/${encodeURIComponent(canonicalSlug)}`;
  const description = eventDescription(event);
  const title = `${event.date} ${event.location_name} 영어 토론 모임 | 1 Cup English`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalPath,
      images: event.image_urls?.length ? [event.image_urls[0]] : undefined,
    },
  };
}
