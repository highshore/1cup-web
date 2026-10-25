"use client";

import Link from "next/link";
import { CheckIcon } from "@heroicons/react/24/solid";
import { cn, displayClass, Emoji, Pill } from "../../lib/features/daily/components/DailyUI";
import { DAILY_MONTHLY_PRICE_KRW, DAILY_PASSES, DAILY_TERMS_PATH, formatKrw } from "../../lib/features/daily/constants";
import { dailyCopy } from "../../lib/features/daily/copy";
import { dailyDisplay } from "../../lib/features/daily/fonts";
import "../../lib/features/daily/daily.css";

// Plans and prices. Payment is not built yet, so the page says so plainly instead of
// showing a button that does nothing.
export default function SubscribeClient() {
  const copy = dailyCopy.pricing;
  const price = formatKrw(DAILY_MONTHLY_PRICE_KRW);

  return (
    <div className={cn("daily-page min-h-[80vh] bg-[#f47a4a] px-4 pb-20 pt-10 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto w-full max-w-[720px]">
        <div className="text-center min-[900px]:text-left">
          <Emoji className="text-[2.6rem]">☕</Emoji>
          <h1 className={cn(displayClass, "mt-3 text-[2.3rem] leading-tight")}>계속 받아보기</h1>
          <p className="mt-2 text-[1rem] font-semibold text-[rgba(5,5,5,0.78)]">
            평일엔 원하는 시간에 새 표현이, 토요일엔 한 주 복습이 카카오톡으로 와요.
          </p>
        </div>

        <div className="mt-8 rounded-[28px] bg-white p-6 min-[900px]:p-9">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[1.15rem] font-black">{copy.subscription.name}</p>
            <Pill className="bg-[#050505] text-white">{copy.subscription.badge}</Pill>
          </div>
          <p className="mt-4 text-[1rem] font-black">{copy.subscription.espresso}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className={cn(displayClass, "text-[2.3rem] leading-none")}>₩{price}</span>
            <span className="text-[0.9rem] font-bold text-[#475569]">/ {copy.subscription.period}</span>
          </p>
          <ul className="m-0 mt-5 flex list-none flex-col gap-2.5 p-0">
            {copy.subscription.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-[0.98rem] font-bold">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#050505] text-[#f47a4a]">
                  <CheckIcon className="size-3.5" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.88rem] font-semibold text-[#64748b]">
            {copy.passes.title}:{" "}
            {DAILY_PASSES.map((pass) => `${pass.label} ₩${formatKrw(pass.priceKrw)}`).join(" · ")}
          </p>
        </div>

        <div className="mt-4 rounded-[28px] bg-[#050505] p-6 text-white">
          <p className="flex items-center gap-2 text-[1.1rem] font-black">
            <Emoji className="text-[1.6rem]">⏳</Emoji>
            결제는 곧 열려요
          </p>
          <p className="mt-2 text-[0.95rem] font-semibold leading-relaxed text-white/70">
            지금은 무료 체험만 받을 수 있어요. 결제가 열리면 이 페이지에서 바로 구독할 수 있어요. 궁금한 점은
            hello@1cupenglish.com 으로 보내주세요.
          </p>
        </div>

        <p className="mt-5 text-center text-[0.85rem] font-semibold text-[rgba(5,5,5,0.72)]">
          <Link href={DAILY_TERMS_PATH} className="underline underline-offset-2">
            {copy.terms}
          </Link>
        </p>
      </div>
    </div>
  );
}
