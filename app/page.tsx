import type { Metadata } from "next";

import NewHomeClient from "./new-home/NewHomeClient";
import { fetchUpcomingMeetupEventsServer } from "./lib/features/meetup/services/meetup_service_server";
import { fetchHomeStats, HomeStats } from "./lib/features/home/services/stats_service";
import { fetchHomeTopics, HomeTopicArticle } from "./lib/features/home/services/topics_service";
import { MeetupEvent } from "./lib/features/meetup/types/meetup_types";

const description =
  "1 Cup English 영어 한잔은 서울에서 한국인과 외국인 거주자가 시사, 기술, 비즈니스, 커리어를 영어로 토론하는 소그룹 커뮤니티입니다. 안암과 여의도를 중심으로 토론형 meetup을 운영합니다.";

export const metadata: Metadata = {
  title: "서울 영어 토론 커뮤니티 | 1 Cup English 영어 한잔",
  description,
  keywords: [
    "1 Cup English",
    "영어 한잔",
    "서울 영어 모임",
    "서울 영어 토론",
    "English discussion Seoul",
    "English community Seoul",
    "안암 영어 모임",
    "여의도 영어 모임",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "서울 영어 토론 커뮤니티 | 1 Cup English",
    description,
    type: "website",
    url: "/",
    images: [
      {
        url: "/images/url-share-thumbnail.jpg",
        width: 960,
        height: 540,
        alt: "1 Cup English 영어 한잔 - Seoul English discussion community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "서울 영어 토론 커뮤니티 | 1 Cup English",
    description,
    images: ["/images/url-share-thumbnail.jpg"],
  },
};

// These queries depend on live Supabase data. Rendering on request keeps a
// temporary database slowdown from preventing otherwise unrelated deployments.
export const dynamic = "force-dynamic";

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
      <section className="sr-only" aria-label="1 Cup English overview">
        <h1>서울 영어 토론 커뮤니티 1 Cup English 영어 한잔</h1>
        <p>
          1 Cup English는 서울에서 한국인과 외국인 거주자가 시사, 기술,
          비즈니스, 커리어와 한국 생활에 관한 주제를 영어로 토론하는 소그룹
          커뮤니티입니다. 안암과 여의도를 중심으로 정기 meetup을 운영하며,
          영어를 가르치고 배우는 일반적인 언어교환보다 깊이 있는 대화와 토론에
          초점을 둡니다.
        </p>
      </section>
      <NewHomeClient
        initialUpcomingEvents={upcomingEvents}
        initialStats={stats}
        initialTopics={topics}
      />
    </>
  );
}
