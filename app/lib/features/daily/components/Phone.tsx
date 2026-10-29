"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  EllipsisHorizontalIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { dailyCopy } from "../copy";
import { dailyDisplay, dailyWordmark } from "../fonts";
import { usePrefersReducedMotion, useVisible } from "../hooks";
import type { DailyLessonContent } from "../server/lessons";
import { CupMark, cn } from "./DailyUI";
import { LessonBody } from "./LessonView";

// The 1cup app mark: a white cup on black, as on the channel profile and app icon.
function AppMark({ className, cupClassName }: { className: string; cupClassName: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-[#050505]", className)}>
      <CupMark className={cupClassName} color="#ffffff" />
    </span>
  );
}

// An iPhone-style device: titanium rim, Dynamic Island, status bar, home indicator.
export function IPhone({
  children,
  className,
  statusClassName = "bg-[#bacee0] text-[#050505]",
}: {
  children: ReactNode;
  className?: string;
  statusClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[9/19.5] w-[320px] rounded-[48px] bg-[linear-gradient(145deg,#5b5b60,#1d1d20_40%,#3a3a3e)] p-[9px] shadow-[0_40px_80px_-24px_rgba(5,5,5,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
        className,
      )}
    >
      <span aria-hidden className="absolute left-[-2px] top-[112px] h-[30px] w-[3px] rounded-l bg-[#2b2b2e]" />
      <span aria-hidden className="absolute left-[-2px] top-[156px] h-[52px] w-[3px] rounded-l bg-[#2b2b2e]" />
      <span aria-hidden className="absolute right-[-2px] top-[150px] h-[76px] w-[3px] rounded-r bg-[#2b2b2e]" />
      <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] bg-black">
        <StatusBar className={statusClassName} />
        <span aria-hidden className="absolute left-1/2 top-[10px] z-20 h-[26px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        <span
          aria-hidden
          className="absolute bottom-[7px] left-1/2 z-20 h-[4px] w-[96px] -translate-x-1/2 rounded-full bg-black/80"
        />
      </div>
    </div>
  );
}

function StatusBar({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative z-10 flex h-[46px] shrink-0 items-center justify-between px-7 pt-1.5 text-[0.8rem] font-bold transition-colors duration-300 motion-reduce:transition-none",
        className,
      )}
    >
      <span>8:00</span>
      <span className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="h-[10px] w-[16px]" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-[10px] w-[14px]" fill="currentColor">
          <path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.3 10.3 0 0 0 8 .5 10.3 10.3 0 0 0 .6 3.5l1.2 1.2A8.6 8.6 0 0 1 8 2.2Zm0 3.4c1.5 0 2.8.6 3.8 1.5L13 5.9A7 7 0 0 0 8 3.9a7 7 0 0 0-5 2l1.2 1.2c1-.9 2.3-1.5 3.8-1.5Zm0 3.4c-.6 0-1.1.2-1.5.6L8 11.1l1.5-1.5c-.4-.4-.9-.6-1.5-.6Z" />
        </svg>
        <span className="relative ml-0.5 inline-block h-[11px] w-[22px] rounded-[3px] border border-current p-[1.5px] opacity-90">
          <span className="block h-full w-[78%] rounded-[1.5px] bg-current" />
        </span>
      </span>
    </div>
  );
}

// KakaoTalk chat with the 영어 한잔 channel showing today's Alimtalk, as the approved
// template renders it: the yellow "알림톡 도착" header, the title line, the greeting and
// the link button. `tapping` shows a finger press on the button (the hero demo).
export function KakaoChat({ tapping = false }: { tapping?: boolean }) {
  const copy = dailyCopy.kakao;

  return (
    <div className="flex h-full flex-col bg-[#bacee0] text-[#050505]">
      <div className="flex items-center gap-2 px-3 pb-2 text-[0.92rem] font-bold">
        <ChevronLeftIcon className="size-5" aria-hidden />
        <span className="flex-1">{copy.channel}</span>
        <MagnifyingGlassIcon className="size-4 opacity-70" aria-hidden />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-2.5 pt-1">
        <p className="mx-auto rounded-full bg-black/10 px-3 py-1 text-[0.66rem] font-semibold text-[#3b4a59]">
          {copy.date}
        </p>
        <div className="daily-arrive flex gap-2 [animation-delay:600ms]">
          <AppMark className="size-9 rounded-[14px]" cupClassName="h-5 w-4" />
          <div className="min-w-0 flex-1 pr-1">
            <p className="mb-1 text-[0.7rem] font-semibold text-[#3b4a59]">{copy.channel}</p>
            <div className="flex items-end gap-1">
              <div className="min-w-0 flex-1 overflow-hidden rounded-[14px] rounded-tl-[4px] bg-white">
                <p className="bg-[#fee500] px-3 py-2 text-[0.7rem] font-extrabold">{copy.alimtalk}</p>
                <div className="px-3 pb-3 pt-2.5 text-[0.74rem] leading-[1.55]">
                  <p className="font-bold">{copy.title}</p>
                  <p className="mt-2.5">{copy.greeting}</p>
                  <p className="mt-2.5">{copy.prompt}</p>
                  <p
                    className={cn(
                      "relative mt-3 rounded-md py-2 text-center text-[0.74rem] font-semibold transition-[transform,background-color] duration-150",
                      tapping ? "scale-[0.97] bg-[#dcdcdc]" : "bg-[#f2f2f2]",
                    )}
                  >
                    {copy.open}
                    {tapping && <span aria-hidden className="daily-tap absolute left-1/2 top-1/2 size-12 rounded-full bg-[#050505]/35 ring-2 ring-white/70" />}
                  </p>
                </div>
              </div>
              <span className="shrink-0 pb-0.5 text-[0.56rem] text-[#3b4a59]">{copy.time}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-white px-3 pb-6 pt-2">
        <PlusIcon className="size-5 text-[#94a3b8]" aria-hidden />
        <span className="flex-1 rounded-full bg-[#f2f2f2] px-3 py-1.5 text-[0.7rem] text-[#94a3b8]">{copy.input}</span>
      </div>
    </div>
  );
}

type DemoPhase = "chat" | "tap" | "lesson";

// How long each step of the hero demo holds before the next.
const DEMO_HOLD: Record<DemoPhase, number> = { chat: 2600, tap: 850, lesson: 4600 };

// The hero phone: today's Alimtalk arrives, a finger taps its button, and the lesson
// page slides in, then back to the chat, on a loop. It only runs while on screen, and
// with reduced motion it stays on the chat.
export function HeroPhoneDemo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref);
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<DemoPhase>("chat");
  const running = visible && !reduced;

  useEffect(() => {
    if (!running) {
      setPhase("chat");
      return;
    }
    const next: Record<DemoPhase, DemoPhase> = { chat: "tap", tap: "lesson", lesson: "chat" };
    const timer = window.setTimeout(() => setPhase(next[phase]), DEMO_HOLD[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, running]);

  const onLesson = phase === "lesson";
  const slide = "absolute inset-0 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none";

  return (
    <div ref={ref} role="img" aria-label={dailyCopy.hero.demoLabel}>
      <IPhone
        className={className}
        statusClassName={onLesson ? "bg-white text-[#050505]" : "bg-[#bacee0] text-[#050505]"}
      >
        <div aria-hidden className="relative h-full overflow-hidden">
          <div className={cn(slide, onLesson ? "-translate-x-1/4 opacity-60" : "translate-x-0")}>
            <KakaoChat tapping={phase === "tap"} />
          </div>
          <div className={cn(slide, "shadow-[-8px_0_24px_rgba(5,5,5,0.12)]", onLesson ? "translate-x-0" : "translate-x-full")}>
            <LessonScreen />
          </div>
        </div>
      </IPhone>
    </div>
  );
}

// KakaoTalk's app icon in a notification: a dark speech bubble on yellow.
function KakaoIcon({ className }: { className: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-[#fee500]", className)}>
      <svg viewBox="0 0 24 22" className="h-[55%] w-[55%]" fill="#3c1e1e" aria-hidden>
        <path d="M12 0C5.4 0 0 4.2 0 9.4c0 3.4 2.3 6.4 5.7 8l-1.2 4.3c-.1.4.3.7.6.5l5-3.3c.6.1 1.2.1 1.9.1 6.6 0 12-4.2 12-9.4S18.6 0 12 0Z" />
      </svg>
    </span>
  );
}

// The iOS notification banner that lands over the hero phone: KakaoTalk's, with the
// channel's name and the start of the message.
export function IosNotification({ className }: { className?: string }) {
  const copy = dailyCopy.hero.notification;

  return (
    <div
      className={cn(
        "flex w-[300px] items-center gap-3 rounded-[22px] bg-white/85 p-3 text-[#050505] shadow-[0_18px_40px_-12px_rgba(5,5,5,0.4)] backdrop-blur-xl",
        className,
      )}
    >
      <KakaoIcon className="size-10 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="flex justify-between text-[0.82rem] font-extrabold">
          {copy.app}
          <span className="text-[0.72rem] font-medium text-[#64748b]">{copy.time}</span>
        </p>
        <p className="truncate text-[0.82rem] text-[#334155]">{copy.body}</p>
      </div>
    </div>
  );
}

// A real lesson (basic, 2026-10-23), word for word, dated like the chat above it.
const SAMPLE_LESSON: DailyLessonContent = {
  id: "sample",
  track: "basic",
  publishOn: "2026-10-27",
  field: null,
  expression: "circle back",
  meaning: "(논의를) 나중에 다시 이어가다",
  pronunciation: "/ˈsɜːrkəl bæk/",
  stress: "써클 백",
  nuance: "결론을 지금 내지 않고 다음에 다시 다루자고 할 때 써요. 'talk later'보다 업무적이고 정중해요.",
  similar: ["follow up on", "revisit", "touch base"],
  examples: [
    { context: "회의", en: "Let's circle back on pricing after the launch.", ko: "가격 얘기는 출시 후에 다시 하죠.", ko_highlight: "다시 하죠" },
    { context: "일정", en: "Can we circle back to this on Friday?", ko: "이건 금요일에 다시 얘기할 수 있을까요?", ko_highlight: "다시 얘기할 수" },
    { context: "메일", en: "I'll circle back once I have the numbers.", ko: "수치가 나오면 다시 연락드릴게요.", ko_highlight: "다시 연락드릴게요" },
  ],
  dialogue: [
    { speaker: "A", role: "Manager", en: "We're running out of time. What about the budget?", ko: "시간이 없네요. 예산은요?" },
    { speaker: "B", role: "You", en: "Let's circle back on that next week.", ko: "그건 다음 주에 다시 이야기하죠.", ko_highlight: "다시 이야기하죠" },
  ],
  quiz: {
    prompt: "We're out of time. Let's ______ on the budget next week.",
    options: ["circle back", "loop in", "move the needle"],
    answer: 0,
    explanation: "논의를 나중에 다시 이어갈 때는 circle back을 써요.",
    ko: "시간이 다 됐네요. 예산 얘기는 다음 주에 다시 하죠.",
    ko_highlight: "다시 하죠",
  },
};

// The width the lesson page is laid out at inside the phone, before it is shrunk to fit.
const PAGE_WIDTH = 390;

// The lesson page that opens from the Kakao button, inside KakaoTalk's in-app browser.
// It is the real page: the Daily navbar and LessonBody at a phone's width, shrunk to the
// screen, so it cannot drift from what subscribers get. With `scroll`, it reads slowly
// down to the quiz and back while on screen.
export function LessonScreen({ scroll = false }: { scroll?: boolean }) {
  const copy = dailyCopy.lesson.screen;
  const viewport = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const visible = useVisible(viewport);
  const reduced = usePrefersReducedMotion();
  const [scale, setScale] = useState(0.88);
  const [travel, setTravel] = useState(0);

  useEffect(() => {
    const frame = viewport.current;
    const content = page.current;
    if (!frame || !content) return;
    const measure = () => {
      const next = frame.clientWidth / PAGE_WIDTH;
      setScale(next);
      setTravel(Math.max(0, Math.round(content.offsetHeight * next - frame.clientHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const reading = scroll && !reduced && travel > 0;

  return (
    <div className={cn("flex h-full flex-col bg-white text-left text-[#050505]", dailyWordmark.variable, dailyDisplay.variable)}>
      <div className="flex items-center gap-2 border-b border-[#ececec] px-3 pb-2">
        <XMarkIcon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 text-center">
          <span className="block truncate text-[0.66rem] font-bold">{copy.pageTitle}</span>
          <span className="flex items-center justify-center gap-0.5 text-[0.56rem] text-[#64748b]">
            <LockClosedIcon className="size-2.5" aria-hidden />
            {copy.url}
          </span>
        </span>
        <EllipsisHorizontalIcon className="size-4 shrink-0" aria-hidden />
      </div>
      <div ref={viewport} aria-hidden inert className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(reading && "daily-read")}
          style={{ ["--daily-read" as string]: `${travel}px`, animationPlayState: visible ? "running" : "paused" }}
        >
          <div ref={page} style={{ width: PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <LessonNavbar />
            <div className="daily-page bg-white px-4 pb-10 pt-6 text-left text-[#050505] [word-break:keep-all]">
              <LessonBody lesson={SAMPLE_LESSON} preview />
            </div>
          </div>
        </div>
      </div>
      <div className="h-6 shrink-0 bg-white" />
    </div>
  );
}

// DailyNavbar as a signed-in reader sees it: opening the message's button signs them in.
function LessonNavbar() {
  return (
    <div className="daily-nav flex h-[60px] items-center justify-between gap-4 bg-white px-4">
      <span className="flex h-[22px] shrink-0 items-baseline gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logos/1cup_logo_new.svg" alt="" className="h-[22px] w-auto" />
        <span className="relative -top-[3px] h-4 w-px bg-[#cbd5e1]" />
        <span className="relative -top-[2.55px] text-[20.16px] font-bold uppercase leading-none tracking-[0.025em] text-[#f47a4a] [font-family:var(--font-daily-wordmark),sans-serif] [font-stretch:62.5%]">
          {dailyCopy.nav.brand}
        </span>
      </span>
      <span className="inline-flex h-10 items-center rounded-full bg-[#050505] px-4 text-[0.9rem] font-black text-white">
        {dailyCopy.nav.account}
      </span>
    </div>
  );
}
