import { Metadata } from "next";
import { cookies } from "next/headers";
import { LessonPage } from "../../../lib/features/daily/components/LessonView";
import DeadLessonLink from "../../../lib/features/daily/components/DeadLessonLink";
import { deadLinkVisitor, getDeliveryByToken } from "../../../lib/features/daily/server/lessons";
import { DAILY_SESSION_COOKIE } from "../../../lib/features/daily/server/session";

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
  if (!delivery || !lesson) return <DeadLessonLink visitor={await deadLinkVisitor((await cookies()).get(DAILY_SESSION_COOKIE)?.value)} />;
  return (
    <LessonPage
      lesson={lesson}
      isTrial={delivery.isTrial}
      paidOtherTrack={delivery.paidOtherTrack}
      subscribeHref={`/daily/subscribe?t=${token}&track=${lesson.track}`}
      linkToken={token}
    />
  );
}
