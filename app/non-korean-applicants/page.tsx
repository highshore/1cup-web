import type { Metadata } from "next";
import NonKoreanApplicantsClient from "./NonKoreanApplicantsClient";
import { fetchHomeStats, HomeStats } from "../lib/features/home/services/stats_service";

// Do not make the deployment depend on a live statistics query.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For Non-Korean Members | 1 Cup English",
  description:
    "A meetup for long-term international members who want to build a meaningful Korean network through thoughtful English conversations.",
  openGraph: {
    title: "For Non-Korean Members | 1 Cup English",
    description:
      "Build a quality Korean network through interesting conversations with English-speaking Korean professionals and students.",
    url: "https://1cupenglish.com/non-korean-applicants",
    type: "website",
    images: [
      {
        url: "/images/url-share-thumbnail.jpg",
        width: 960,
        height: 540,
        alt: "1 Cup English",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "For Non-Korean Members | 1 Cup English",
    description:
      "Build a meaningful Korean network through thoughtful English conversations in Seoul.",
    images: ["/images/url-share-thumbnail.jpg"],
  },
};

export default async function NonKoreanApplicantsPage() {
  let stats: HomeStats = {
    totalMeetups: 0,
    totalMembers: 0,
    totalArticles: 0,
  };

  try {
    stats = await fetchHomeStats();
  } catch (error) {
    console.error("Error fetching non-Korean applicants page stats:", error);
  }

  return <NonKoreanApplicantsClient stats={stats} />;
}
