import { Metadata } from "next";
import { cookies } from "next/headers";
import { ReviewPage } from "../../../lib/features/daily/components/LessonView";
import DeadLessonLink from "../../../lib/features/daily/components/DeadLessonLink";
import { deadLinkVisitor, getDeliveryByToken } from "../../../lib/features/daily/server/lessons";
import { DAILY_SESSION_COOKIE } from "../../../lib/features/daily/server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이번 주 복습 | One Cup Daily",
  robots: { index: false, follow: false },
};

// Opened from the Saturday review message.
export default async function DailyReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const delivery = await getDeliveryByToken(token);
  if (!delivery || delivery.kind !== "review" || delivery.lessons.length === 0) {
    return <DeadLessonLink visitor={await deadLinkVisitor((await cookies()).get(DAILY_SESSION_COOKIE)?.value)} />;
  }
  return <ReviewPage lessons={delivery.lessons} linkToken={token} />;
}
