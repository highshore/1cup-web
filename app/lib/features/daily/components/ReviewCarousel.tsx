"use client";

import { useEffect, useRef, useState } from "react";
import { CheckBadgeIcon, StarIcon } from "@heroicons/react/24/solid";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { dailyCopy } from "../copy";
import type { PublicDailyReview } from "../server/reviews";
import { cn } from "./DailyUI";

const AUTO_MS = 4500;

// Under the landing hero: approved 5-star reviews, one card per swipe. Each card shows the
// review's 좋았던 점 (its body), who wrote it (소속 직종 김00 님), level and lessons received,
// and the 14-day reward disclosure (추천·보증 심사지침). Advances on its own every few seconds
// until the reader touches it; never with reduced motion.
export default function ReviewCarousel({ reviews }: { reviews: PublicDailyReview[] }) {
  const copy = dailyCopy.reviews;
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackTitle = (track: string) => dailyCopy.tracks.items.find((item) => item.key === track)?.title ?? "";

  const goTo = (next: number) => {
    const list = trackRef.current;
    if (!list) return;
    const count = reviews.length;
    const target = ((next % count) + count) % count;
    const card = list.children[target] as HTMLElement | undefined;
    if (card) list.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
  };

  // Keep the dots in step with manual swipes.
  useEffect(() => {
    const list = trackRef.current;
    if (!list) return;
    const onScroll = () => {
      // The list is positioned, so offsetLeft is measured from it; 16px is its left padding.
      const cards = Array.from(list.children) as HTMLElement[];
      const left = list.scrollLeft;
      let best = 0;
      cards.forEach((card, i) => {
        if (Math.abs(card.offsetLeft - 16 - left) < Math.abs(cards[best].offsetLeft - 16 - left)) best = i;
      });
      setIndex(best);
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (paused || reviews.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => goTo(index + 1), AUTO_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, reviews.length]);

  return (
    <section aria-label={copy.carouselLabel} className="bg-white px-0 py-10 min-[900px]:py-14">
      <div className="mx-auto w-full max-w-[720px] px-4">
        <p className="flex items-center justify-center gap-1.5 text-[0.95rem] font-black min-[900px]:justify-start">
          <span className="flex gap-0.5" aria-hidden>
            {[1, 2, 3, 4, 5].map((v) => (
              <StarIcon key={v} className="size-4 text-[#f47a4a]" />
            ))}
          </span>
          {copy.carouselTitle}
        </p>
      </div>

      <ul
        ref={trackRef}
        onPointerDown={() => setPaused(true)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        className="relative m-0 mx-auto mt-4 flex w-full max-w-[720px] list-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex w-[85%] shrink-0 snap-start flex-col rounded-[24px] bg-[#f5f5f4] p-5 text-left min-[600px]:w-[calc(50%-6px)]"
          >
            <p className="flex-1 text-[1rem] font-semibold leading-relaxed">“{review.body}”</p>
            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#050505] text-[0.85rem] font-black text-white">
                {(review.displayName ?? copy.anonymous).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.88rem] font-black leading-snug">{review.displayName ?? copy.anonymous}</p>
                <p className="text-[0.72rem] font-semibold text-[#64748b]">
                  {trackTitle(review.track)} · {copy.lessons.replace("{count}", String(review.lessonsReceived))}
                </p>
              </div>
              <CheckBadgeIcon className="size-5 shrink-0 text-[#f47a4a]" aria-label={copy.verified} />
            </div>
            {review.rewarded && <p className="mt-2 text-[0.7rem] font-semibold text-[#94a3b8]">{copy.rewarded}</p>}
          </li>
        ))}
      </ul>

      {reviews.length > 1 && (
        <div className="mx-auto mt-4 flex w-full max-w-[720px] items-center justify-center gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              goTo(index - 1);
            }}
            aria-label={copy.prev}
            className="flex size-8 items-center justify-center rounded-full bg-[#f5f5f4]"
          >
            <ChevronLeftIcon className="size-4" strokeWidth={2.5} />
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {reviews.map((review, i) => (
              <span key={review.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-[#050505]" : "w-1.5 bg-[#d6d3d1]")} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              goTo(index + 1);
            }}
            aria-label={copy.next}
            className="flex size-8 items-center justify-center rounded-full bg-[#f5f5f4]"
          >
            <ChevronRightIcon className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </section>
  );
}
