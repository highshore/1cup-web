"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import { DAILY_FIELD_LABEL, DAILY_TRACK_LABEL, DAILY_TRACKS, type DailyTrack } from "../../../lib/features/daily/constants";
import type { DailyAdminLessonRow } from "../../../lib/features/daily/server/admin";

// Every lesson of one level, newest first. Each opens /daily/admin/lessons/[id], which
// reads the lesson by id, so no subscriber's message token is involved. Drafts can be
// ticked and approved together.
function dateLabel(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

const checkboxClass = "size-5 shrink-0 cursor-pointer accent-[#f47a4a]";

export default function DailyAdminLessonsClient({
  lessons,
  track,
  today,
}: {
  lessons: DailyAdminLessonRow[];
  track: DailyTrack;
  today: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const visible = lessons.filter((l) => l.track === track);
  const drafts = visible.filter((l) => l.status === "draft");
  const allSelected = drafts.length > 0 && drafts.every((l) => selected.has(l.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const approve = async () => {
    const ids = drafts.filter((l) => selected.has(l.id)).map((l) => l.id);
    if (ids.length === 0) return;
    if (!window.confirm(`레슨 ${ids.length}개를 승인할까요? 승인한 레슨은 각 날짜에 카톡으로 나가요.`)) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/daily-lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status: "ready" }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "처리하지 못했어요.");
      return;
    }
    setMessage(`${payload.updated ?? ids.length}개를 승인했어요.`);
    setSelected(new Set());
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-[752px] px-4 pb-20 pt-8 [word-break:keep-all]">
      <Link href="/daily/admin" className="inline-flex items-center gap-1 text-[14px] font-bold text-[rgba(5,5,5,0.6)]">
        <ArrowLeftIcon className="size-4" />
        Daily 관리자
      </Link>
      <h1 className="m-0 mt-4 text-[28px] font-black">콘텐츠</h1>
      <p className="mt-2 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
        레벨별 레슨 전체예요. 승인한 레슨만 나가요. 회원은 누구나 표현 1부터 날짜 순서대로 받고, 레슨은 그 날짜 전에는 나가지 않아요. 초안은 골라서 한 번에 승인하거나, 열어서 하나씩 승인해요.
      </p>

      <div className="mt-5 flex gap-1.5">
        {DAILY_TRACKS.map((t) => {
          const count = lessons.filter((l) => l.track === t).length;
          const draftCount = lessons.filter((l) => l.track === t && l.status === "draft").length;
          return (
            <Link
              key={t}
              href={`/daily/admin/lessons?track=${t}`}
              className={`inline-flex h-9 items-center rounded-full px-3 text-[13px] font-black ${
                t === track ? "bg-[#050505] text-white" : "bg-[#f5f5f4] text-[#050505]"
              }`}
            >
              {DAILY_TRACK_LABEL[t]} {count}
              {draftCount > 0 && ` · 초안 ${draftCount}`}
            </Link>
          );
        })}
      </div>

      {drafts.length > 0 && (
        <div className="sticky top-[60px] z-10 mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#f5f5f4] p-3 pl-4">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-[14px] font-black">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(drafts.map((l) => l.id)))}
            />
            초안 전체 선택 ({drafts.length})
          </label>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={approve}
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#f47a4a] px-4 text-[0.9rem] font-black text-[#050505] disabled:opacity-40"
          >
            {selected.size > 0 ? `선택한 ${selected.size}개 승인하기` : "승인할 레슨을 골라 주세요"}
          </button>
        </div>
      )}
      {message && <p className="mt-3 text-[13px] font-bold text-[rgba(5,5,5,0.7)]">{message}</p>}

      {visible.length === 0 ? (
        <p className="mt-10 text-center font-bold text-[rgba(5,5,5,0.6)]">아직 {DAILY_TRACK_LABEL[track]} 레슨이 없어요.</p>
      ) : (
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {visible.map((l) => (
            <li
              key={l.id}
              className={`flex items-center rounded-2xl border-2 bg-white ${selected.has(l.id) ? "border-[#f47a4a]" : "border-[#050505]"}`}
            >
              {l.status === "draft" ? (
                <label className="flex cursor-pointer self-stretch items-center pl-4 pr-1" aria-label={`${l.expression} 선택`}>
                  <input type="checkbox" className={checkboxClass} checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                </label>
              ) : (
                drafts.length > 0 && <span aria-hidden className="w-10 shrink-0" />
              )}
              <Link href={`/daily/admin/lessons/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-[#050505]">
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
