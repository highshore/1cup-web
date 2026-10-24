"use client";

import { ReactNode } from "react";

const Signal = () => (
  <svg width="38" height="12" viewBox="0 0 38 12" fill="#050505" aria-hidden>
    <rect x="0" y="8" width="3" height="4" rx="1" />
    <rect x="5" y="6" width="3" height="6" rx="1" />
    <rect x="10" y="3" width="3" height="9" rx="1" />
    <rect x="15" y="0" width="3" height="12" rx="1" />
    <rect x="23" y="1" width="13" height="10" rx="3" fill="none" stroke="#050505" strokeWidth="1.5" />
    <rect x="25" y="3" width="8" height="6" rx="1.5" />
  </svg>
);

// A plain device frame that renders live product UI instead of screenshots.
export default function PhoneFrame({
  children,
  time,
  background = "#ffffff",
  label,
}: {
  children: ReactNode;
  time: string;
  background?: string;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative aspect-[300/610] w-[min(300px,82vw)] overflow-hidden rounded-[46px] border-[10px] border-[#050505] bg-[#050505] shadow-[8px_8px_0_#f47a4a]"
    >
      <div
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[36px]"
        style={{ background }}
      >
        <div className="relative flex h-10 shrink-0 items-center justify-between px-[22px] text-[0.78rem] font-extrabold text-[#050505] after:absolute after:top-[9px] after:left-1/2 after:h-[22px] after:w-[84px] after:-translate-x-1/2 after:rounded-full after:bg-[#050505] after:content-['']">
          <span>{time}</span>
          <Signal />
        </div>
        {children}
      </div>
    </div>
  );
}
