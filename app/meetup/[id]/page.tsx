import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { EventDetailClient } from "./EventDetailClient";
import GlobalLoadingScreen from "../../lib/components/GlobalLoadingScreen";
import {
  fetchMeetupSeoByIdServer,
  MeetupSeoRecord,
} from "../../lib/seo/content_server";
import JsonLd from "../../lib/seo/json_ld";
import {
  absoluteUrl,
  ORGANIZATION_ID,
  SITE_NAME,
} from "../../lib/seo/site";

interface MeetupDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

const normalizeEventId = (id: string) => {
  try {
    return decodeURIComponent(id || "").trim();
  } catch {
    return "";
  }
};

const eventDescription = (event: MeetupSeoRecord) => {
  const description = event.description.replace(/\s+/g, " ").trim();
  if (description) return description.slice(0, 160);

  const date = event.dateTimeISO
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(event.dateTimeISO))
    : "예정된 일정";
  const location = event.locationName || event.locationAddress || "서울";
  return `${date} ${location}에서 진행되는 영어 한잔 영어 토론 밋업입니다.`;
};

const eventLocationJsonLd = (event: MeetupSeoRecord) => {
  const hasCoordinates = event.latitude !== null && event.longitude !== null;
  if (!event.locationName && !event.locationAddress && !hasCoordinates) {
    return undefined;
  }

  return {
    "@type": "Place",
    ...(event.locationName ? { name: event.locationName } : {}),
    ...(event.locationAddress
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: event.locationAddress,
            addressCountry: "KR",
          },
        }
      : {}),
    ...(hasCoordinates
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: event.latitude,
            longitude: event.longitude,
          },
        }
      : {}),
  };
};

export default async function EventDetailPage({ params }: MeetupDetailPageProps) {
  const { id } = await params;
  const eventId = normalizeEventId(id);
  if (!eventId) notFound();

  const event = await fetchMeetupSeoByIdServer(eventId);
  if (!event) notFound();

  const canonicalPath = `/meetup/${encodeURIComponent(event.id)}`;
  const pageUrl = absoluteUrl(canonicalPath);
  const images = event.imageUrls.length
    ? event.imageUrls.map(absoluteUrl)
    : [absoluteUrl("/images/url-share-thumbnail.jpg")];
  const startDate = event.dateTimeISO || undefined;
  const endDate =
    event.dateTimeISO && event.durationMinutes > 0
      ? new Date(
          new Date(event.dateTimeISO).getTime() + event.durationMinutes * 60_000,
        ).toISOString()
      : undefined;

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${pageUrl}#event`,
    name: event.title || `${SITE_NAME} 밋업`,
    description: eventDescription(event),
    url: pageUrl,
    image: images,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    ...(eventLocationJsonLd(event)
      ? { location: eventLocationJsonLd(event) }
      : {}),
    organizer: {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "밋업",
        item: absoluteUrl("/meetup"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: event.title || `${SITE_NAME} 밋업`,
        item: pageUrl,
      },
    ],
  };

  return (
    <>
      <JsonLd data={[eventJsonLd, breadcrumbJsonLd]} />
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
  const eventId = normalizeEventId(id);
  if (!eventId) {
    return {
      title: `밋업 | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const event = await fetchMeetupSeoByIdServer(eventId);
  if (!event) {
    return {
      title: `밋업 | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = `/meetup/${encodeURIComponent(event.id)}`;
  const title = event.title || `${SITE_NAME} 밋업`;
  const description = eventDescription(event);
  const images = event.imageUrls.length
    ? event.imageUrls
    : ["/images/url-share-thumbnail.jpg"];

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalPath,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}
