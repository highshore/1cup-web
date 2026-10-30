import { Metadata } from "next";
import DailyClient from "./DailyClient";
import { approvedReviews } from "../lib/features/daily/server/reviews";
import { landingProof, landingStart } from "../lib/features/daily/server/landing";

// Approved reviews, the first lessons a new member gets and the live counts are read on the server and
// refreshed every five minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "One Cup Daily | 글로벌 임원 통역사가 직접 고른 영어",
  description:
    "출근길 5분, 카카오톡으로 오는 현장 비즈니스 영어. 통역사가 컨설팅·금융·테크 업계 회의에서 실제로 오간 표현을 토익 900점을 기준으로 초·중급, 고급 두 레벨로 나눠 매일 보내드려요. 첫 하루 무료.",
  // The trial and paid plans are live: allow search engines and ad landing crawlers.
  robots: { index: true, follow: true },
  // Shared links show Daily, not the 1cup community the root layout describes. The image
  // comes from ./opengraph-image.tsx (the 1cup logo on black).
  openGraph: {
    title: "One Cup Daily | 글로벌 임원 통역사가 직접 고른 영어",
    description: "출근길 5분, 카카오톡으로 오는 현장 비즈니스 영어. 첫 하루 무료.",
    url: "https://1cupenglish.com/daily",
    siteName: "One Cup Daily",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "One Cup Daily | 글로벌 임원 통역사가 직접 고른 영어",
    description: "출근길 5분, 카카오톡으로 오는 현장 비즈니스 영어. 첫 하루 무료.",
  },
};

export default async function DailyPage() {
  const [reviews, start, proof] = await Promise.all([
    approvedReviews().catch(() => []),
    landingStart().catch(() => null),
    landingProof().catch(() => null),
  ]);
  return <DailyClient reviews={reviews} start={start} proof={proof} />;
}
