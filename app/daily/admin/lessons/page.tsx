import { isDailyTrack, type DailyTrack } from "../../../lib/features/daily/constants";
import { loadDailyLessons } from "../../../lib/features/daily/server/admin";
import DailyAdminLessonsClient from "./DailyAdminLessonsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "콘텐츠 | Daily 관리자", robots: { index: false, follow: false } };

export default async function DailyAdminLessonsPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track: requested } = await searchParams;
  const track: DailyTrack = requested && isDailyTrack(requested) ? requested : "basic";
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  // Keyed by level so switching tabs starts with nothing selected.
  return <DailyAdminLessonsClient key={track} lessons={await loadDailyLessons()} track={track} today={today} />;
}
