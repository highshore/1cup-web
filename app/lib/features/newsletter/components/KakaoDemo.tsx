"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { NEWSLETTER_TRACKS, NewsletterTrack } from "../constants";
import { useInView, usePrefersReducedMotion } from "../hooks";
import { cn } from "./NewsletterUI";
import PhoneFrame from "./PhoneFrame";

const KAKAO_CHAT_BG = "#BACEE0";
const CYCLE_MS = 6500;
const TYPING_MS = 1100;

function Avatar() {
  return (
    <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-xl border-2 border-[#050505] bg-[#f47a4a] text-[0.8rem] font-black text-[#050505]">
      1
    </span>
  );
}

function DatePill({ children }: { children: string }) {
  return (
    <span className="self-center rounded-full bg-black/12 px-3 py-[0.2rem] text-[0.68rem] font-bold text-white">
      {children}
    </span>
  );
}

// Hero demo: the daily Alimtalk arriving at 8:00, cycling through the three tracks.
export default function KakaoDemo() {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, 0.3);
  const [index, setIndex] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (reduced || !inView) return;
    let typingTimer: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      setTyping(true);
      typingTimer = setTimeout(() => {
        setIndex((value) => (value + 1) % NEWSLETTER_TRACKS.length);
        setTyping(false);
      }, TYPING_MS);
    }, CYCLE_MS);
    return () => {
      clearInterval(cycle);
      clearTimeout(typingTimer);
    };
  }, [reduced, inView]);

  const track: NewsletterTrack = NEWSLETTER_TRACKS[index];
  const trackCopy = t.newsletter.tracks[track];
  const previousCopy =
    t.newsletter.tracks[NEWSLETTER_TRACKS[(index + NEWSLETTER_TRACKS.length - 1) % NEWSLETTER_TRACKS.length]];
  const demo = t.newsletter.demo;
  const time = t.newsletter.detail.kakaoTime;

  const bubble = (copy: typeof trackCopy, full: boolean) => (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.7rem] font-bold text-[#3c4a57]">{t.newsletter.brand.name}</span>
      <div className="flex gap-[0.3rem]">
        <div className="w-[196px] overflow-hidden rounded-xl bg-white">
          <div className="bg-[#FEE500] px-3 py-[0.45rem] text-[0.74rem] font-extrabold text-[#050505]">
            {demo.alimtalk}
          </div>
          <div className="flex flex-col gap-[0.2rem] px-3 pt-[0.7rem] pb-[0.6rem] text-[0.72rem] leading-[1.5] text-[#0f172a]">
            <span className="font-extrabold">{demo.messageIntro.replace("{track}", copy.title)}</span>
            <span lang="en" className="mt-[0.3rem] text-[1.05rem] font-black leading-[1.25] text-[#050505]">
              {copy.lesson.expression}
            </span>
            {full && (
              <>
                <span className="font-bold text-[#d95f2d]">{copy.lesson.meaning}</span>
                <span lang="en" className="mt-[0.35rem] font-semibold text-[#475569]">
                  {copy.lesson.examples[0].en}
                </span>
              </>
            )}
          </div>
          {full && (
            <span
              className={cn(
                "mx-3 mt-[0.2rem] mb-3 block rounded-lg bg-[#f1f2f4] p-2 text-center text-[0.72rem] font-extrabold text-[#050505]",
                !reduced && "nl-nudge",
              )}
            >
              {demo.openLesson}
            </span>
          )}
        </div>
        <span className="shrink-0 self-end text-[0.62rem] text-[#3c4a57]">{time}</span>
      </div>
    </div>
  );

  return (
    <div ref={rootRef}>
      <PhoneFrame time="8:00" background={KAKAO_CHAT_BG} label={`${demo.alimtalk}: ${trackCopy.lesson.expression}`}>
        <div className="flex shrink-0 items-center gap-[0.6rem] px-4 pt-[0.35rem] pb-3 text-[0.95rem] font-extrabold text-[#050505]">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px]">
            <path d="M15 5l-7 7 7 7" stroke="#050505" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t.newsletter.brand.name}
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-[0.85rem] pb-[1.1rem]">
          <DatePill>{demo.yesterday}</DatePill>
          <div className="flex gap-2">
            <Avatar />
            {bubble(previousCopy, false)}
          </div>
          <DatePill>{demo.today}</DatePill>
          {typing ? (
            <div className={cn("flex gap-2", !reduced && "nl-arrive")}>
              <Avatar />
              <div className="nl-typing inline-flex gap-1 rounded-xl bg-white px-[0.8rem] py-[0.7rem] [&_span]:size-1.5 [&_span]:rounded-full [&_span]:bg-[#64748b]">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : (
            <div key={track} className={cn("flex gap-2", !reduced && "nl-arrive")}>
              <Avatar />
              {bubble(trackCopy, true)}
            </div>
          )}
        </div>
      </PhoneFrame>
    </div>
  );
}
