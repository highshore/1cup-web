"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { LessonBody } from "../../../../lib/features/daily/components/LessonView";
import { cn } from "../../../../lib/features/daily/components/DailyUI";
import { DAILY_TRACK_LABEL } from "../../../../lib/features/daily/constants";
import { dailyDisplay } from "../../../../lib/features/daily/fonts";
import type { DailyLessonContent } from "../../../../lib/features/daily/server/lessons";

// The lesson body exactly as subscribers see it, without the parts tied to one reader's
// message (sign-in, 함께 쓰는 문장, progress, the trial banner). The quiz works but
// records nothing.
export default function DailyAdminLessonClient({ lesson, status }: { lesson: DailyLessonContent; status: "draft" | "ready" }) {
  return (
    <div className={cn("daily-page mx-auto w-full max-w-[752px] px-4 pb-20 pt-8 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <Link
        href={`/daily/admin/lessons?track=${lesson.track}`}
        className="inline-flex items-center gap-1 text-[14px] font-bold text-[rgba(5,5,5,0.6)]"
      >
        <ArrowLeftIcon className="size-4" />
        콘텐츠 · {DAILY_TRACK_LABEL[lesson.track]}
      </Link>
      <p className="mb-4 mt-3 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
        {status === "ready" ? "발송 준비된 레슨이에요." : "초안이에요. 이 날짜엔 아직 발송되지 않아요."} 구독자 화면 그대로 보여요(퀴즈 답은 기록되지 않아요).
      </p>
      <LessonBody lesson={lesson} />
    </div>
  );
}
