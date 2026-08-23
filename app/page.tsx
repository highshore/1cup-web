import NewHomeClient from "./new-home/NewHomeClient";
import { fetchUpcomingMeetupEventsServer } from "./lib/features/meetup/services/meetup_service_server";
import { fetchHomeStats, HomeStats } from "./lib/features/home/services/stats_service";
import { fetchHomeTopics, HomeTopicArticle } from "./lib/features/home/services/topics_service";
import { MeetupEvent } from "./lib/features/meetup/types/meetup_types";

// This page will be statically generated at build time
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
    <NewHomeClient
      initialUpcomingEvents={upcomingEvents}
      initialStats={stats}
      initialTopics={topics}
    />
  );
}

// Generate metadata for SEO
export async function generateMetadata() {
  return {
    title: "영어 한잔 | 1 Cup English",
    description: "Business English Community hosted in Seoul",
    keywords:
      "영어 학습, 영어 회화, 영어 모임, 영어 뉴스, 영어 공부, 영어 한잔",
    openGraph: {
      title: "영어 한잔 | 1 Cup English",
      description: "Business English Community hosted in Seoul",
      type: "website",
      url: "https://1cupenglish.com",
      images: [
        {
          url: "/images/url-share-thumbnail.jpg",
          width: 960,
          height: 540,
          alt: "영어 한잔 - 1 Cup English",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "영어 한잔 | 1 Cup English",
      description: "Business English Community hosted in Seoul",
      images: ["/images/url-share-thumbnail.jpg"],
    },
  };
}
