import type { Metadata } from "next";

import LeaderboardClient from "./LeaderboardClient";

export const metadata: Metadata = {
  title: "리더보드 | 영어 한잔",
  description: "영어 한잔 밋업 참여 랭킹과 신규 멤버를 확인하세요.",
  alternates: {
    canonical: "/leaderboard",
  },
  openGraph: {
    title: "리더보드 | 영어 한잔",
    description: "영어 한잔 밋업 참여 랭킹과 신규 멤버를 확인하세요.",
    url: "/leaderboard",
    type: "website",
  },
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
