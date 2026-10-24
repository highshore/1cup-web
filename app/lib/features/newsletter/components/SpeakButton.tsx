"use client";

import { cn } from "./NewsletterUI";

export default function SpeakButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-[0.35rem] rounded-full border-2 border-[#050505] py-1 pr-[0.65rem] pl-2 font-[inherit] text-[0.75rem] font-extrabold text-[#050505] [transition:background-color_150ms_ease] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(244,122,74,0.45)]",
        active ? "bg-[#f47a4a]" : "bg-white",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex h-3 items-center gap-[2px] [&_i]:block [&_i]:h-3 [&_i]:w-[2.5px] [&_i]:scale-y-[0.45] [&_i]:rounded-[2px] [&_i]:bg-[#050505] [&_i:nth-child(2)]:scale-y-[0.8]",
          active && "nl-bars-active",
        )}
      >
        <i />
        <i />
        <i />
      </span>
      {label}
    </button>
  );
}
