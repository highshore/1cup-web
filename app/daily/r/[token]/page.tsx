import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewPage } from "../../../lib/features/daily/components/LessonView";
import { getDeliveryByToken } from "../../../lib/features/daily/server/lessons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이번 주 복습 | One Cup Daily",
  robots: { index: false, follow: false },
};

// Opened from the Saturday review message.
export default async function DailyReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const delivery = await getDeliveryByToken(token);
  if (!delivery || delivery.kind !== "review" || delivery.lessons.length === 0) notFound();
  return <ReviewPage lessons={delivery.lessons} linkToken={token} />;
}
