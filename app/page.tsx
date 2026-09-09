import type { Metadata } from "next";

import NewHomeClient from "./new-home/NewHomeClient";
import { fetchUpcomingMeetupEventsServer } from "./lib/features/meetup/services/meetup_service_server";
import { fetchHomeStats, HomeStats } from "./lib/features/home/services/stats_service";
import { fetchHomeTopics, HomeTopicArticle } from "./lib/features/home/services/topics_service";
import { MeetupEvent } from "./lib/features/meetup/types/meetup_types";
import homeFaq from "./lib/i18n/home_faq";
import JsonLd from "./lib/seo/json_ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_NAME_EN } from "./lib/seo/site";

// These queries depend on live Supabase data. Rendering on request keeps a
// temporary database slowdown from preventing otherwise unrelated deployments.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE_NAME} | ${SITE_NAME_EN}`,
  description: SITE_DESCRIPTION,
  keywords: [
    "서울 영어 모임",
    "영어 토론 모임",
    "직장인 영어 모임",
    "비즈니스 영어 모임",
    "영어 회화 모임",
    "영어 한잔",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} | ${SITE_NAME_EN}`,
    description: SITE_DESCRIPTION,
    type: "website",
    url: "/",
    images: [
      {
        url: "/images/url-share-thumbnail.jpg",
        width: 960,
        height: 540,
        alt: `${SITE_NAME} - ${SITE_NAME_EN}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_NAME_EN}`,
    description: SITE_DESCRIPTION,
    images: ["/images/url-share-thumbnail.jpg"],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaq.ko.items.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default async function HomePage() {
  let upcomingEvents: MeetupEvent[] = [];
  let stats: HomeStats = {
    totalMeetups: 0,
    totalMembers: 0,
    totalArticles: 0,
  };
  let topics: HomeTopicArticle[] = [];

  try {
    [upcomingEvents, stats, topics] = await Promise.all([
      fetchUpcomingMeetupEventsServer(),
      fetchHomeStats(),
      fetchHomeTopics(),
    ]);
  } catch (error) {
    console.error("Error fetching home data at build time:", error);
    upcomingEvents = [];
  }

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <NewHomeClient
        initialUpcomingEvents={upcomingEvents}
        initialStats={stats}
        initialTopics={topics}
      />
    </>
  );
}
