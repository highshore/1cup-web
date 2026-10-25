import { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPage } from "../../../lib/features/daily/components/LessonView";
import { getDeliveryByToken } from "../../../lib/features/daily/server/lessons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "오늘의 레슨 | One Cup Daily",
  robots: { index: false, follow: false },
};

// Opened from the "오늘의 레슨 보기" button in the Kakao message.
export default async function DailyLessonPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const delivery = await getDeliveryByToken(token);
  const lesson = delivery?.kind === "lesson" ? delivery.lessons[0] : undefined;
  if (!delivery || !lesson) notFound();
  return <LessonPage lesson={lesson} isTrial={delivery.isTrial} subscribeHref={`/daily/subscribe?t=${token}`} linkToken={token} />;
}
