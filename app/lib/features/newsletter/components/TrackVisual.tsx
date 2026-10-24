"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { NewsletterTrack } from "../constants";
import { usePrefersReducedMotion } from "../hooks";
import LoopVideo from "./LoopVideo";
import { cn } from "./NewsletterUI";

function highlight(text: string, word: string) {
  const index = text.toLowerCase().indexOf(word.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + word.length)}</mark>
      {text.slice(index + word.length)}
    </>
  );
}

// Per-track media tile: real footage for business, product-style mocks for drama and tech.
export default function TrackVisual({
  track,
  compact = false,
}: {
  track: NewsletterTrack;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const copy = t.newsletter.tracks[track];
  const demo = t.newsletter.demo;
  const example = copy.lesson.examples[0];
  const [showKo, setShowKo] = useState(false);

  useEffect(() => {
    if (track !== "drama" || reduced) return;
    const timer = setInterval(() => setShowKo((value) => !value), 2600);
    return () => clearInterval(timer);
  }, [track, reduced]);

  const tile = cn("relative overflow-hidden", compact ? "aspect-[16/10]" : "aspect-[4/3]");

  if (track === "business") {
    return (
      <div className={cn(tile, "bg-[#f3f3f1]")}>
        <LoopVideo src="/assets/newsletter/city-loop.mp4" poster="/assets/newsletter/city-poster.jpg" />
        <div
          className={cn(
            "absolute flex flex-col gap-[0.15rem] rounded-xl border-2 border-[#050505] bg-white",
            compact ? "inset-x-3 bottom-3 px-3 py-[0.55rem]" : "inset-x-4 bottom-4 px-4 py-[0.8rem]",
          )}
        >
          <span className="text-[0.7rem] font-extrabold text-[#d95f2d]">{t.newsletter.detail.coverCaption}</span>
          <span lang="en" className={cn("font-extrabold leading-[1.4] text-[#050505]", compact ? "text-[0.86rem]" : "text-base")}>
            {example.en}
          </span>
        </div>
      </div>
    );
  }

  if (track === "drama") {
    return (
      <div className={cn(tile, "bg-[#f47a4a]")}>
        <div className="absolute inset-0 flex flex-col justify-between bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.55),transparent_45%),linear-gradient(135deg,#f47a4a_0%,#f9b48f_55%,#fff8dc_100%)] p-[0.85rem]">
          <div className="flex justify-between text-[0.7rem] font-extrabold text-[#050505]">
            <span>{showKo ? demo.subtitlesKo : demo.subtitlesEn}</span>
            <span className="rounded-md border-2 border-[#050505] bg-white px-[0.35rem] py-[0.05rem]">CC</span>
          </div>
          <span className="inline-flex size-[54px] items-center justify-center self-center rounded-full border-2 border-[#050505] bg-white shadow-[3px_3px_0_#050505]">
            <svg viewBox="0 0 24 24" fill="#050505" aria-hidden className="ml-[3px] size-[22px]">
              <path d="M7 4.5v15l12-7.5L7 4.5z" />
            </svg>
          </span>
          <div>
            <p
              key={String(showKo)}
              lang={showKo ? "ko" : "en"}
              className={cn(
                "m-0 mx-auto max-w-[92%] rounded-lg bg-[rgba(5,5,5,0.82)] px-[0.7rem] py-[0.35rem] text-center text-[0.84rem] font-bold leading-[1.45] text-white",
                !reduced && "nl-fade",
              )}
            >
              {showKo ? example.ko : example.en}
            </p>
            <div className="mt-[0.6rem] h-1 rounded-full bg-[rgba(5,5,5,0.18)]">
              <span className="block h-full w-[38%] rounded-[inherit] bg-[#050505]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(tile, "bg-[#f3f3f1]")}>
      <div
        className={cn(
          "absolute flex flex-col justify-center gap-2 rounded-xl border-2 border-[#050505] bg-white",
          compact ? "inset-3 p-[0.85rem]" : "inset-[1.1rem] p-5",
        )}
      >
        <span className="text-[0.7rem] font-extrabold text-[#64748b]">{demo.newsSource}</span>
        <p lang="en" className={cn("nl-sweep m-0 font-black leading-[1.3] text-[#050505]", compact ? "text-[1.02rem]" : "text-[1.3rem]")}>
          {highlight(example.en, copy.lesson.expression)}
        </p>
        <p lang="ko" className="m-0 text-[0.8rem] font-semibold text-[#475569]">
          {example.ko}
        </p>
      </div>
    </div>
  );
}
