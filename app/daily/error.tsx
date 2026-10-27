"use client";

import { useEffect } from "react";
import Link from "next/link";
import { cn, displayClass } from "../lib/features/daily/components/DailyUI";
import { dailyDisplay } from "../lib/features/daily/fonts";
import "../lib/features/daily/daily.css";

// Daily's own error screen. It reports what broke to the server log (/api/daily
// client-error), since a crash seen only on someone's phone otherwise leaves no trace,
// and "다시 시도" reloads the page rather than re-rendering the same broken state.
export default function DailyError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[daily]", error);
    void fetch("/api/daily/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname,
        message: error?.message ?? "",
        stack: error?.stack ?? "",
        digest: error?.digest ?? "",
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className={cn("daily-page flex min-h-[80vh] items-center bg-[#fff8dc] px-4 py-16 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto w-full max-w-[460px] text-center">
        <p className="text-[2.6rem] leading-none" aria-hidden>
          ☕
        </p>
        <h1 className={cn(displayClass, "mt-4 text-[2rem] leading-tight")}>페이지를 불러오지 못했어요</h1>
        <p className="mt-3 text-[0.98rem] font-semibold text-[#475569]">
          잠깐 문제가 생겼어요. 다시 시도해도 같으면 잠시 후 다시 들어와 주세요.
        </p>
        <div className="mt-7 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-[54px] rounded-2xl bg-[#050505] text-[1rem] font-black text-white"
          >
            다시 시도
          </button>
          <Link href="/daily" className="flex h-[54px] items-center justify-center rounded-2xl bg-white text-[1rem] font-black">
            Daily 소개로
          </Link>
        </div>
      </div>
    </div>
  );
}
