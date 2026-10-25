import { Metadata } from "next";
import DailyGuide from "../../lib/features/daily/components/DailyGuide";

export const metadata: Metadata = {
  title: "이용 가이드 | One Cup Daily",
  description: "영어 한잔 Daily 신청, 레슨 받기, 구독과 해지, 환불까지 쓰는 방법을 모두 모았어요.",
  // Same as the landing page: not indexed until the free trial opens to search.
  robots: { index: false, follow: false },
};

export default function DailyGuidePage() {
  return <DailyGuide />;
}
