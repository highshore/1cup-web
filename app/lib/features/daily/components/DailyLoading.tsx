"use client";

import { cn } from "./DailyUI";
import "../daily.css";

// Daily's one loader: three orange dots in a small white pill, fixed to the middle of
// the viewport so every page (and every route change, via app/daily/loading.tsx) shows
// it in the same place. It is pure CSS, so it is on screen from the first paint instead
// of waiting for an animation chunk. `label` says what it is waiting for, to screen readers.
export default function DailyLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("pointer-events-none fixed inset-0 z-40 flex items-center justify-center", className)}
    >
      <div className="flex items-center gap-[6px] rounded-full bg-white px-[14px] py-[11px] shadow-[0_6px_24px_rgba(5,5,5,0.12)]">
        <span className="daily-dot" />
        <span className="daily-dot" />
        <span className="daily-dot" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
