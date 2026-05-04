import HomePageClient from "../lib/features/home/components/HomePageClient";
import { fetchUpcomingMeetupEventsServer } from "../lib/features/meetup/services/meetup_service_server";
import { fetchHomeStats } from "../lib/features/home/services/stats_service";
import { fetchHomeTopics } from "../lib/features/home/services/topics_service";
import { HomeTopicArticle } from "../lib/features/home/services/topics_service";
import { MeetupEvent } from "../lib/features/meetup/types/meetup_types";

// This page will be statically generated at build time
export default async function HomePage() {
  let upcomingEvents: MeetupEvent[] = [];
  let stats = {
    totalMeetups: 0,
    totalMembers: 0,
    totalArticles: 0,
  };
  let topics: HomeTopicArticle[] = [];

  try {
    // Fetch upcoming meetup events and stats at build time (SSG)
    [upcomingEvents, stats, topics] = await Promise.all([
      fetchUpcomingMeetupEventsServer(),
      fetchHomeStats(),
      fetchHomeTopics(),
    ]);
    console.log("Homepage data fetched:", {
      eventsCount: upcomingEvents.length,
      stats,
      topicsCount: topics.length,
    });
  } catch (error) {
    console.error("Error fetching data at build time:", error);
    // Fall back to empty arrays/defaults - client will handle fetching
    upcomingEvents = [];
  }

  return (
    <HomePageClient
      initialUpcomingEvents={upcomingEvents}
      initialStats={stats}
      initialTopics={topics}
    />
  );
}

// Generate metadata for SEO
export async function generateMetadata() {
  return {
    title: "영어 한잔 | 오프라인 실전 영어",
    description:
      "매주 영어 모임으로 실전 회화 연습하고, 매일 영어 아티클로 어휘력을 늘려보세요.",
    keywords:
      "영어 학습, 영어 회화, 영어 모임, 영어 뉴스, 영어 공부, 영어 한잔",
    openGraph: {
      title: "영어 한잔 | 오프라인 실전 영어",
      description:
        "매주 영어 모임으로 실전 회화 연습하고, 매일 영어 아티클로 어휘력을 늘려보세요.",
      type: "website",
      url: "https://1cupenglish.com",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "영어 한잔 - 1 Cup English",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "영어 한잔 | 오프라인 실전 영어",
      description:
        "매주 영어 모임으로 실전 회화 연습하고, 매일 영어 아티클로 어휘력을 늘려보세요.",
      images: ["/opengraph-image"],
    },
  };
}
