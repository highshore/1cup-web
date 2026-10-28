"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { LessonBody } from "../../../../lib/features/daily/components/LessonView";
import { cn } from "../../../../lib/features/daily/components/DailyUI";
import { DAILY_TRACK_LABEL } from "../../../../lib/features/daily/constants";
import { dailyDisplay } from "../../../../lib/features/daily/fonts";
import type { DailyLessonContent } from "../../../../lib/features/daily/server/lessons";

// The lesson body exactly as subscribers see it, without the parts tied to one reader's
// message (sign-in, 함께 쓰는 문장, progress, the trial banner). The quiz works but
// records nothing. Staff approve a draft here: only ready lessons are sent on their date.
export default function DailyAdminLessonClient({ lesson, status }: { lesson: DailyLessonContent; status: "draft" | "ready" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const setStatus = async (next: "draft" | "ready") => {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/daily-lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lesson.id, status: next }),
    });
    if (!response.ok) setMessage((await response.json().catch(() => ({}))).error ?? "처리하지 못했어요.");
    setBusy(false);
    router.refresh();
  };

  return (
    <div className={cn("daily-page mx-auto w-full max-w-[752px] px-4 pb-20 pt-8 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <Link
        href={`/daily/admin/lessons?track=${lesson.track}`}
        className="inline-flex items-center gap-1 text-[14px] font-bold text-[rgba(5,5,5,0.6)]"
      >
        <ArrowLeftIcon className="size-4" />
        콘텐츠 · {DAILY_TRACK_LABEL[lesson.track]}
      </Link>

      <div className="mb-4 mt-3 flex flex-col gap-3 rounded-2xl bg-[#f5f5f4] p-4 min-[600px]:flex-row min-[600px]:items-center">
        <p className="m-0 min-w-0 flex-1 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
          {status === "ready"
            ? "승인된 레슨이에요. 이 날짜에 카톡으로 나가요."
            : "초안이에요. 승인해야 이 날짜에 카톡으로 나가요."}{" "}
          구독자 화면 그대로 보여요(퀴즈 답은 기록되지 않아요).
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus(status === "ready" ? "draft" : "ready")}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-[0.9rem] font-black disabled:opacity-40",
            status === "ready" ? "bg-white text-[#050505]" : "bg-[#f47a4a] text-[#050505]",
          )}
        >
          {status === "ready" ? "초안으로 되돌리기" : "승인하기"}
        </button>
      </div>
      {message && <p className="mb-4 text-[13px] font-bold text-[#dc2626]">{message}</p>}

      <LessonBody lesson={lesson} />
    </div>
  );
}
