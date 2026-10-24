"use client";

import type { CSSProperties } from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { NEWSLETTER_TRACKS, NewsletterTrack } from "../constants";
import { cn } from "./NewsletterUI";

type Entry = { key: string; track: string; en: string; ko: string };

// Two rows in opposite directions; duplicated so the loop is seamless.
export default function ExpressionMarquee({ tracks = NEWSLETTER_TRACKS }: { tracks?: readonly NewsletterTrack[] }) {
  const { t } = useI18n();
  const entries: Entry[] = tracks.flatMap((track) => {
    const copy = t.newsletter.tracks[track];
    return [
      { key: `${track}-lesson`, track: copy.title, en: copy.lesson.expression, ko: copy.lesson.meaning },
      ...copy.notBasic.map((item) => ({ key: `${track}-${item.en}`, track: copy.title, en: item.en, ko: item.ko })),
    ];
  });
  const half = Math.ceil(entries.length / 2);
  const rows = [entries.slice(0, half), entries.slice(half)].filter((row) => row.length);

  return (
    <div className="nl-marquee flex flex-col gap-4 overflow-hidden pt-2 pb-3 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn("nl-marquee-track flex w-max gap-4", rowIndex === 1 && "nl-reverse")}
          style={{ "--nl-marquee-duration": `${Math.max(30, row.length * 9)}s` } as CSSProperties}
        >
          {[...row, ...row].map((entry, index) => (
            <div
              key={`${entry.key}-${index}`}
              aria-hidden={index >= row.length}
              className="flex min-w-[220px] flex-col gap-[0.2rem] rounded-[14px] border-2 border-[#050505] bg-white px-[1.1rem] py-[0.9rem] shadow-[4px_4px_0_rgba(5,5,5,0.88)]"
            >
              <span className="mb-[0.3rem] self-start rounded-full bg-[#fff8dc] px-[0.55rem] py-[0.15rem] text-[0.72rem] font-extrabold text-[#d95f2d]">
                {entry.track}
              </span>
              <span lang="en" className="text-[1.15rem] font-black text-[#050505]">
                {entry.en}
              </span>
              <span className="text-[0.84rem] font-[650] text-[#475569]">{entry.ko}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
