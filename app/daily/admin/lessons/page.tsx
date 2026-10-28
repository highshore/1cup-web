import Link from "next/link";
import { ArrowLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import { DAILY_FIELD_LABEL, DAILY_TRACK_LABEL, DAILY_TRACKS, isDailyTrack, type DailyTrack } from "../../../lib/features/daily/constants";
import { loadDailyLessons } from "../../../lib/features/daily/server/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "콘텐츠 | Daily 관리자", robots: { index: false, follow: false } };

// Every lesson of one level, newest first. Each opens /daily/admin/lessons/[id], which
// reads the lesson by id, so no subscriber's message token is involved.
function dateLabel(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default async function DailyAdminLessonsPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track: requested } = await searchParams;
  const track: DailyTrack = requested && isDailyTrack(requested) ? requested : "basic";
  const lessons = await loadDailyLessons();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const visible = lessons.filter((l) => l.track === track);

  return (
    <div className="mx-auto w-full max-w-[752px] px-4 pb-20 pt-8 [word-break:keep-all]">
      <Link href="/daily/admin" className="inline-flex items-center gap-1 text-[14px] font-bold text-[rgba(5,5,5,0.6)]">
        <ArrowLeftIcon className="size-4" />
        Daily 관리자
      </Link>
      <h1 className="m-0 mt-4 text-[28px] font-black">콘텐츠</h1>
      <p className="mt-2 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
        레벨별 레슨 전체예요. 승인한 레슨만 그날 카톡으로 나가고, 초안은 레슨을 열어 승인해요.
      </p>

      <div className="mt-5 flex gap-1.5">
        {DAILY_TRACKS.map((t) => (
          <Link
            key={t}
            href={`/daily/admin/lessons?track=${t}`}
            className={`inline-flex h-9 items-center rounded-full px-3 text-[13px] font-black ${
              t === track ? "bg-[#050505] text-white" : "bg-[#f5f5f4] text-[#050505]"
            }`}
          >
            {DAILY_TRACK_LABEL[t]} {lessons.filter((l) => l.track === t).length}
            {lessons.some((l) => l.track === t && l.status === "draft") &&
              ` · 초안 ${lessons.filter((l) => l.track === t && l.status === "draft").length}`}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center font-bold text-[rgba(5,5,5,0.6)]">아직 {DAILY_TRACK_LABEL[track]} 레슨이 없어요.</p>
      ) : (
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {visible.map((l) => (
            <li key={l.id}>
              <Link
                href={`/daily/admin/lessons/${l.id}`}
                className="flex items-center gap-3 rounded-2xl border-2 border-[#050505] bg-white p-4 text-[#050505]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-[rgba(5,5,5,0.6)]">
                    {dateLabel(l.publishOn)}
                    {l.publishOn === today && <span className="rounded-full bg-[#050505] px-2 py-0.5 font-black text-white">오늘</span>}
                    <span
                      className={`rounded-full px-2 py-0.5 font-black ${
                        l.status === "ready" ? "bg-[#f47a4a] text-[#050505]" : "bg-[#f5f5f4] text-[#64748b]"
                      }`}
                    >
                      {l.status === "ready" ? "승인됨" : "초안"}
                    </span>
                    {l.field && <span>{DAILY_FIELD_LABEL[l.field]}</span>}
                  </span>
                  <span className="mt-1 block text-[17px] font-black">{l.expression}</span>
                  <span className="mt-0.5 block truncate text-[13px] font-semibold text-[#475569]">{l.meaning}</span>
                </span>
                <ChevronRightIcon className="size-5 shrink-0 text-[rgba(5,5,5,0.4)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
