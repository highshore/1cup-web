"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DailyApiError, dailyApi } from "../../lib/features/daily/api";
import { cn, displayClass, Emoji, Pill } from "../../lib/features/daily/components/DailyUI";
import PhoneVerification from "../../lib/features/daily/components/PhoneVerification";
import { DAILY_ACCOUNT_PATH, DAILY_TRACK_LABEL, type DailyTrack } from "../../lib/features/daily/constants";
import { dailyCopy } from "../../lib/features/daily/copy";
import { dailyDisplay } from "../../lib/features/daily/fonts";
import "../../lib/features/daily/daily.css";

interface BookItem {
  date: string;
  token: string;
  track: DailyTrack;
  expression: string;
  meaning: string;
  quiz: "correct" | "wrong" | "open" | null;
}

const copy = dailyCopy.book;
const TRACK_TITLE = DAILY_TRACK_LABEL;
const QUIZ_CLASS = { correct: "bg-[#dcfce7] text-[#166534]", wrong: "bg-[#fee2e2] text-[#991b1b]", open: "bg-[#f1f5f9] text-[#475569]" } as const;

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
}

export default function BookClient() {
  // undefined: loading; null: not signed in.
  const [book, setBook] = useState<{ streak: number; items: BookItem[] } | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setBook(await dailyApi<{ streak: number; items: BookItem[] }>("expression-book"));
    } catch (e) {
      setBook(e instanceof DailyApiError && e.status === 401 ? null : { streak: 0, items: [] });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={cn("daily-page min-h-[80vh] bg-[#fff8dc] px-4 pb-20 pt-10 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
        <div className="text-center min-[900px]:text-left">
          <Emoji className="text-[2.6rem]">📚</Emoji>
          <h1 className={cn(displayClass, "mt-3 text-[2.3rem] leading-tight")}>{copy.title}</h1>
          <p className="mt-2 text-[1rem] font-semibold text-[#57534e]">{copy.sub}</p>
        </div>

        {book === undefined && <div className="h-40 animate-pulse rounded-[24px] bg-white/70" />}

        {book === null && (
          <section className="rounded-[24px] bg-white p-5 min-[900px]:p-6">
            <h2 className="text-center text-[1.1rem] font-black min-[900px]:text-left">{copy.signIn}</h2>
            <div className="mt-4">
              <PhoneVerification bare onVerified={load} />
            </div>
          </section>
        )}

        {book && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2 min-[900px]:justify-start">
              <Pill className="bg-[#050505] px-3 py-1.5 text-[0.9rem] text-white">{copy.streak.replace("{days}", String(book.streak))}</Pill>
              <Pill className="bg-white px-3 py-1.5 text-[0.9rem]">{copy.total.replace("{count}", String(book.items.length))}</Pill>
            </div>
            {book.items.length === 0 ? (
              <p className="rounded-[24px] bg-white p-6 text-center text-[0.95rem] font-semibold text-[#64748b]">{copy.empty}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {book.items.map((item) => (
                  <li key={item.token}>
                    <Link href={`/daily/l/${item.token}`} className="block rounded-[22px] bg-white p-5 transition-shadow hover:shadow-[0_0_0_2px_#050505]">
                      <span className="flex flex-wrap items-center gap-2 text-[0.8rem] font-bold text-[#64748b]">
                        {dateLabel(item.date)} · {TRACK_TITLE[item.track]}
                        {item.quiz && <span className={cn("rounded-full px-2 py-0.5 text-[0.72rem] font-black", QUIZ_CLASS[item.quiz])}>{copy.quiz[item.quiz]}</span>}
                      </span>
                      <span lang="en" className={cn(displayClass, "mt-1.5 block text-[1.6rem] leading-tight")}>
                        {item.expression}
                      </span>
                      <span className="mt-0.5 block text-[0.95rem] font-semibold text-[#475569]">{item.meaning}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href={DAILY_ACCOUNT_PATH} className="mt-2 text-center text-[0.88rem] font-bold text-[#475569] underline underline-offset-2">
              {dailyCopy.nav.account}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
