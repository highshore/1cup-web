"use client";

import { dailyCopy } from "../copy";
import { cn, Emoji } from "./DailyUI";

// Which days the Kakao messages come: weekday lessons, a Saturday review, nothing on
// Sunday. Shown on /daily/guide and on the landing page; copy in dailyCopy.guide.week.
// With heading={false} the caller renders its own title above it.
export default function DailyWeek({ heading = true }: { heading?: boolean }) {
  const week = dailyCopy.guide.week;
  return (
    <div className="rounded-[28px] bg-[#050505] p-5 text-white min-[900px]:p-7">
      {heading && (
        <>
          <p className="text-center text-[1.1rem] font-black min-[900px]:text-left">{week.title}</p>
          <p className="mt-1 text-center text-[0.9rem] font-semibold text-white/65 min-[900px]:text-left">{week.sub}</p>
        </>
      )}
      <ol className={cn("m-0 grid list-none grid-cols-7 gap-1.5 p-0", heading && "mt-5")}>
        {week.days.map(({ day, kind }) => (
          <li
            key={day}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl px-1 py-3",
              kind === "lesson" && "bg-[#f47a4a] text-[#050505]",
              kind === "review" && "bg-[#fff8dc] text-[#050505]",
              kind === "rest" && "bg-white/10 text-white/60",
            )}
          >
            <span className="text-[1rem] font-black">{day}</span>
            <Emoji className="text-[1.5rem]" motion="none">
              {kind === "lesson" ? "☕" : kind === "review" ? "🧠" : "😴"}
            </Emoji>
            <span className="text-center text-[0.68rem] font-extrabold leading-tight min-[420px]:text-[0.75rem]">
              {week.kinds[kind as keyof typeof week.kinds]}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-center text-[0.85rem] font-semibold leading-relaxed text-white/65 min-[900px]:text-left">{week.note}</p>
    </div>
  );
}
