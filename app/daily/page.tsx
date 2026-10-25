import { Metadata } from "next";
import DailyClient from "./DailyClient";
import { approvedReviews } from "../lib/features/daily/server/reviews";

// Approved reviews are read on the server and refreshed every five minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "One Cup Daily | 통역사가 매일 직접 올리는 카톡 영어",
  description:
    "출근길 5분, 카카오톡으로 오는 비즈니스·테크 영어. 통역사가 실제 회의에서 오간 표현만 골라 매일 보내드려요. 첫 하루 무료.",
  // Not indexed until the free trial opens.
  robots: { index: false, follow: false },
};

export default async function DailyPage() {
  const reviews = await approvedReviews().catch(() => []);
  return <DailyClient reviews={reviews} />;
}
