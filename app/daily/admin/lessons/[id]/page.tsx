import { notFound } from "next/navigation";

import { loadDailyLesson } from "../../../../lib/features/daily/server/admin";
import DailyAdminLessonClient from "./DailyAdminLessonClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "레슨 보기 | Daily 관리자", robots: { index: false, follow: false } };

export default async function DailyAdminLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await loadDailyLesson(id);
  if (!found) notFound();
  return <DailyAdminLessonClient lesson={found.lesson} status={found.status} />;
}
