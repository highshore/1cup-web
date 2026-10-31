"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

// One Cup Daily 함께 쓰는 문장: pick each lesson's 통역사 PICK (shown in the next
// lesson) and hide sentences that should not be public. Korean only, like the rest of
// Daily (a product decision: Daily is not localized).

interface Row {
  id: string;
  body: string;
  display_name: string | null;
  hidden_at: string | null;
  picked_at: string | null;
  created_at: string;
  lesson_id: string;
  cups: number;
  lesson: { expression: string; track: "basic" | "advanced"; publish_on: string } | null;
}

const TRACK = { basic: "초·중급", advanced: "고급" } as const;
const buttonClass = "inline-flex h-9 items-center justify-center rounded-xl px-3 text-[13px] font-black disabled:opacity-40";

export default function AdminDailySentencesClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/daily-sentences", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "불러오지 못했어요.");
      setRows([]);
      return;
    }
    setRows(payload.sentences);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "hide" | "unhide" | "pick" | "unpick") => {
    setBusy(id);
    setMessage("");
    const response = await fetch("/api/admin/daily-sentences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!response.ok) setMessage((await response.json().catch(() => ({}))).error ?? "처리하지 못했어요.");
    setBusy(null);
    await load();
  };

  // Grouped by lesson, newest lesson first; within a lesson the most ☕ first.
  const groups = useMemo(() => {
    const byLesson = new Map<string, Row[]>();
    for (const row of rows ?? []) byLesson.set(row.lesson_id, [...(byLesson.get(row.lesson_id) ?? []), row]);
    return [...byLesson.values()]
      .map((list) => list.sort((a, b) => b.cups - a.cups))
      .sort((a, b) => (b[0].lesson?.publish_on ?? "").localeCompare(a[0].lesson?.publish_on ?? ""));
  }, [rows]);

  return (
    <div className="mx-auto w-full max-w-page px-4 min-[900px]:px-gutter pb-20 pt-8 [word-break:keep-all]">
      <Link href="/daily/admin" className="inline-flex items-center gap-1 text-[14px] font-bold text-[rgba(5,5,5,0.6)]">
        <ArrowLeftIcon className="size-4" />
        Daily 관리자
      </Link>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="m-0 text-[28px] font-black">Daily 함께 쓰는 문장</h1>
        <button type="button" onClick={() => void load()} className={`${buttonClass} bg-[#f5f5f4]`} aria-label="새로고침">
          <ArrowPathIcon className="size-5" />
        </button>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
        레슨마다 하나를 통역사 PICK으로 고르면 같은 레벨의 다음 레슨 위쪽에 소개돼요. 숨긴 문장은 쓴 사람에게만 보여요.
      </p>
      {message && <p className="mt-4 rounded-xl bg-[#fff8dc] px-4 py-3 text-[14px] font-bold">{message}</p>}

      {rows === null ? (
        <p className="mt-8 text-center font-bold text-[rgba(5,5,5,0.6)]">불러오는 중…</p>
      ) : groups.length === 0 ? (
        <p className="mt-8 text-center font-bold text-[rgba(5,5,5,0.6)]">아직 올라온 문장이 없어요.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {groups.map((list) => {
            const lesson = list[0].lesson;
            return (
              <section key={list[0].lesson_id} className="rounded-2xl border border-[#e9e8e5] bg-white p-4 sm:p-5">
                <h2 className="m-0 text-[18px] font-black">
                  {lesson?.expression}{" "}
                  <span className="text-[13px] font-bold text-[rgba(5,5,5,0.55)]">
                    {lesson ? `${TRACK[lesson.track]} · ${lesson.publish_on}` : ""} · {list.length}개
                  </span>
                </h2>
                <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                  {list.map((row) => (
                    <li
                      key={row.id}
                      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl px-3 py-2.5 ${row.picked_at ? "bg-[#fff8dc]" : row.hidden_at ? "bg-[#f5f5f4] opacity-60" : "bg-[#fafaf9]"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p lang="en" className="m-0 text-[15px] font-bold">
                          {row.body}
                        </p>
                        <p className="m-0 mt-0.5 text-[12px] font-semibold text-[rgba(5,5,5,0.55)]">
                          {row.display_name ?? "익명"} · ☕ {row.cups}
                          {row.picked_at ? " · 🏆 PICK" : ""}
                          {row.hidden_at ? " · 숨김" : ""}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => act(row.id, row.picked_at ? "unpick" : "pick")}
                          className={`${buttonClass} ${row.picked_at ? "bg-[#f5f5f4]" : "bg-[#050505] text-white"}`}
                        >
                          {row.picked_at ? "PICK 취소" : "PICK"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => act(row.id, row.hidden_at ? "unhide" : "hide")}
                          className={`${buttonClass} bg-[#f5f5f4]`}
                        >
                          {row.hidden_at ? "다시 보이기" : "숨기기"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
