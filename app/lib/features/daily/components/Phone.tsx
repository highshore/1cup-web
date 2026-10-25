"use client";

import { ReactNode } from "react";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  PlusIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/solid";
import { dailyCopy } from "../copy";
import { CupMark, cn } from "./DailyUI";

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
        "relative aspect-[9/19.5] w-[280px] rounded-[48px] bg-[linear-gradient(145deg,#5b5b60,#1d1d20_40%,#3a3a3e)] p-[9px] shadow-[0_40px_80px_-24px_rgba(5,5,5,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
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
        "relative z-10 flex h-[46px] shrink-0 items-center justify-between px-7 pt-1.5 text-[0.8rem] font-bold",
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

// KakaoTalk chat with the 영어 한잔 channel showing today's Alimtalk.
export function KakaoChat() {
  const copy = dailyCopy.kakao;

  return (
    <div className="flex h-full flex-col bg-[#bacee0] text-[#050505]">
      <div className="flex items-center gap-2 px-3 pb-2 text-[0.92rem] font-bold">
        <ChevronLeftIcon className="size-5" aria-hidden />
        <span className="flex-1">{copy.channel}</span>
        <MagnifyingGlassIcon className="size-4 opacity-70" aria-hidden />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-1">
        <p className="mx-auto rounded-full bg-black/10 px-3 py-1 text-[0.66rem] font-semibold text-[#3b4a59]">
          {copy.date}
        </p>
        <div className="daily-arrive flex gap-2 [animation-delay:600ms]">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[14px] bg-[#f47a4a]">
            <CupMark className="h-5 w-4" color="#050505" />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-[0.7rem] font-semibold text-[#3b4a59]">{copy.channel}</p>
            <div className="flex items-end gap-1.5">
              <div className="w-[176px] overflow-hidden rounded-[14px] rounded-tl-[4px] bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                <p className="bg-[#fee500] px-3 py-1.5 text-[0.66rem] font-extrabold">{copy.alimtalk}</p>
                <div className="px-3 pb-3 pt-2.5">
                  <p className="text-[0.68rem] font-bold text-[#64748b]">{copy.intro}</p>
                  <p className="mt-1.5 text-[1.12rem] font-black leading-tight">{copy.expression}</p>
                  <p className="mt-0.5 text-[0.7rem] font-semibold text-[#475569]">{copy.meaning}</p>
                  <p className="mt-2 rounded-lg bg-[#f5f5f5] px-2 py-1.5 text-[0.68rem] leading-snug text-[#334155]">
                    {copy.example}
                  </p>
                  <p className="mt-2.5 rounded-lg bg-[#f2f2f2] py-2 text-center text-[0.72rem] font-extrabold">
                    {copy.open}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[0.58rem] text-[#3b4a59]">{copy.time}</span>
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

// The iOS notification banner that lands over the hero phone.
export function IosNotification({ className }: { className?: string }) {
  const copy = dailyCopy.hero.notification;

  return (
    <div
      className={cn(
        "flex w-[300px] items-center gap-3 rounded-[22px] bg-white/85 p-3 text-[#050505] shadow-[0_18px_40px_-12px_rgba(5,5,5,0.4)] backdrop-blur-xl",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f47a4a]">
        <CupMark className="h-6 w-5" color="#050505" />
      </span>
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

// The lesson page that opens from the Kakao button, shown in Safari.
export function LessonScreen() {
  const copy = dailyCopy.lesson.screen;

  return (
    <div className="flex h-full flex-col bg-white text-[#050505]">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="bg-[#f47a4a] px-4 pb-4 pt-2">
          <p className="text-[1.7rem] font-black leading-tight [font-family:var(--font-daily-display),sans-serif] [font-weight:400]">
            {copy.expression}
          </p>
          <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#050505] px-2.5 py-2 text-white">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#f47a4a] text-[#050505]">
              <PlayIcon className="size-3.5" aria-hidden />
            </span>
            <Waveform className="h-4 flex-1" />
            <span className="text-[0.62rem] font-bold">0:03</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <div>
            <p className="text-[0.64rem] font-extrabold text-[#d95f2d]">{copy.meaningLabel}</p>
            <p className="text-[0.8rem] font-bold">{copy.meaning}</p>
          </div>
          <div className="rounded-xl bg-[#fff8dc] px-3 py-2.5">
            <p className="text-[0.64rem] font-extrabold text-[#d95f2d]">{copy.nuanceLabel}</p>
            <p className="mt-0.5 text-[0.68rem] leading-snug text-[#334155]">{copy.nuance}</p>
          </div>
          <div>
            <p className="mb-1.5 text-[0.64rem] font-extrabold text-[#d95f2d]">{copy.examplesLabel}</p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {copy.examples.map((example) => (
                <li key={example.en} className="flex gap-2 rounded-xl border border-[#e5e7eb] px-2.5 py-2">
                  <SpeakerWaveIcon className="mt-0.5 size-3.5 shrink-0 text-[#f47a4a]" aria-hidden />
                  <span>
                    <span className="block text-[0.68rem] font-bold leading-snug">{example.en}</span>
                    <span className="block text-[0.6rem] text-[#64748b]">{example.ko}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[#e5e7eb] bg-[#f7f7f8] px-3 pb-6 pt-2">
        <span className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#e9e9eb] py-1.5 text-[0.7rem] font-semibold text-[#334155]">
          <LockClosedIcon className="size-3" aria-hidden />
          {copy.url}
        </span>
        <ArrowPathIcon className="size-4 text-[#64748b]" aria-hidden />
      </div>
    </div>
  );
}

const WAVE = [5, 9, 6, 12, 8, 14, 7, 11, 5, 9, 13, 6, 10, 7, 12, 5, 8];

export function Waveform({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("daily-wave flex items-center gap-[2px]", className)}>
      {WAVE.map((height, index) => (
        <span
          key={index}
          className="w-[2px] rounded-full bg-[#f47a4a]"
          style={{ height: `${height}px`, animationDelay: `${(index % 6) * 120}ms` }}
        />
      ))}
    </span>
  );
}
