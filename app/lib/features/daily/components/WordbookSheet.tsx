"use client";

import { LockClosedIcon } from "@heroicons/react/24/solid";
import { dailyCopy } from "../copy";
import { cn } from "./DailyUI";

// The interpreter's word list as a spreadsheet window: the file's real header and real
// rows (copy.wordbook.sheet), then rows that stay locked, since subscribers get the list
// one entry a day. Drawn in code rather than as a screenshot, so it stays sharp and the
// rows stay in sync with the copy. No spreadsheet vendor's branding.

const sheet = dailyCopy.wordbook.sheet;
const COLUMNS = ["A", "B", "C", "D", "E"];

// The rows that follow, blurred: real rows with their real row numbers, opened later.
const LOCKED = [
  { n: 7021, en: "zany", ko: "어릿광대 같은", syn: "wacky, eccentric, clownish", ex: "The comedian's zany antics had the audience in stitches throughout the entire show." },
  { n: 7022, en: "zen", ko: "평온한", syn: "serenity, tranquility, calmness", ex: "After a long day of work, she sat in her garden, surrounded by the tranquil beauty of nature." },
  { n: 7023, en: "zero in on", ko: "주의를 집중하다, 조준하다", syn: "focus on, target, hone in on", ex: "The detective was able to zero in on the suspect's hiding place after carefully analyzing the evidence." },
  { n: 7024, en: "zero-tolerance policy", ko: "무관용 정책", syn: "strict policy, no-tolerance policy, inflexible policy", ex: "The school has implemented a zero-tolerance policy towards bullying." },
];

const cell = "border-b border-r border-[#e2e8f0] px-2.5 py-2 text-left align-top";
const clip = "block overflow-hidden text-ellipsis whitespace-nowrap";

function Row({
  row,
  locked = false,
  selected = false,
}: {
  row: { n: number; en: string; ko: string; syn: string; ex: string };
  locked?: boolean;
  selected?: boolean;
}) {
  return (
    <tr className={cn(locked && "select-none")} aria-hidden={locked || undefined}>
      <th scope="row" className="sticky left-0 border-b border-r border-[#e2e8f0] bg-[#f8fafc] px-2 py-2 text-center text-[0.68rem] font-semibold text-[#94a3b8]">
        {row.n}
      </th>
      <td className={cn(cell, "w-[44px] text-center")}>
        <span className="inline-block size-3.5 rounded-[3px] border border-[#94a3b8] align-middle" />
      </td>
      <td className={cn(cell, "w-[170px] font-bold text-[#050505]", locked && "blur-[5px]", selected && "outline outline-2 -outline-offset-2 outline-[#f47a4a]")}>
        <span lang="en" className={clip}>
          {row.en}
        </span>
      </td>
      <td className={cn(cell, "w-[170px] text-[#334155]", locked && "blur-[5px]")}>
        <span className={clip}>{row.ko}</span>
      </td>
      <td className={cn(cell, "w-[190px] text-[#475569]", locked && "blur-[5px]")}>
        <span lang="en" className={clip}>
          {row.syn}
        </span>
      </td>
      <td className={cn(cell, "w-[300px] text-[#475569]", locked && "blur-[5px]")}>
        <span lang="en" className={clip}>
          {row.ex}
        </span>
      </td>
    </tr>
  );
}

export default function WordbookSheet() {
  const first = sheet.rows[0];
  return (
    <figure className="m-0 overflow-hidden rounded-[22px] bg-white text-left shadow-[0_30px_60px_-30px_rgba(5,5,5,0.45)] ring-1 ring-[#e2e8f0]">
      {/* Title bar */}
      <div className="flex items-center gap-2.5 border-b border-[#e2e8f0] bg-white px-4 py-3">
        <span aria-hidden className="grid size-7 shrink-0 grid-cols-3 gap-[2px] rounded-[5px] bg-[#050505] p-[5px]">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="rounded-[1px] bg-white/80" />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.95rem] font-bold">{sheet.file}</span>
        <span className="shrink-0 rounded-full bg-[#fff8dc] px-2.5 py-1 text-[0.72rem] font-black text-[#b45309]">{sheet.label}</span>
      </div>
      {/* Formula bar */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-[0.78rem]">
        <span className="rounded border border-[#e2e8f0] bg-white px-2 py-0.5 font-semibold text-[#64748b]">B{first.n}</span>
        <span className="font-serif italic text-[#94a3b8]">fx</span>
        <span lang="en" className="truncate font-semibold text-[#334155]">
          {first.en}
        </span>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-[0.78rem]">
          <caption className="sr-only">{`${sheet.file} · ${sheet.tab}`}</caption>
          <thead>
            <tr aria-hidden>
              <th className="sticky left-0 w-[44px] border-b border-r border-[#e2e8f0] bg-[#f1f5f9]" />
              {COLUMNS.map((letter) => (
                <th key={letter} className="border-b border-r border-[#e2e8f0] bg-[#f1f5f9] py-1 text-center text-[0.68rem] font-semibold text-[#64748b]">
                  {letter}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="row" className="sticky left-0 border-b-2 border-r border-b-[#cbd5e1] border-r-[#e2e8f0] bg-[#f8fafc] px-2 py-2 text-center text-[0.68rem] font-semibold text-[#94a3b8]">
                1
              </th>
              {["Check", ...sheet.columns].map((name) => (
                <th key={name} scope="col" className="border-b-2 border-r border-b-[#cbd5e1] border-r-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2 text-left font-black text-[#050505]">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, index) => (
              <Row key={row.n} row={row} selected={index === 0} />
            ))}
            {LOCKED.map((row) => (
              <Row key={row.n} row={row} locked />
            ))}
          </tbody>
        </table>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[170px] items-end justify-center bg-gradient-to-t from-white via-white/85 to-transparent pb-5">
          <p className="flex items-center gap-2 rounded-full bg-[#050505] px-4 py-2.5 text-[0.86rem] font-black text-white shadow-lg">
            <LockClosedIcon className="size-4 text-[#f47a4a]" aria-hidden />
            {sheet.locked}
          </p>
        </div>
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center gap-1 border-t border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-[0.75rem]">
        <span className="rounded-t-md border-b-2 border-[#f47a4a] bg-white px-3 py-1 font-bold">{sheet.tab}</span>
        <span className="ml-auto font-semibold text-[#94a3b8]">{sheet.count}</span>
      </div>
    </figure>
  );
}
