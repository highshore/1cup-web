"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import { dailyWordmark } from "../features/daily/fonts";

export type OneCupService = "daily" | "meetup";

export type ServiceSwitcherCopy = {
  label: string;
  daily: string;
  meetup: string;
};

const SERVICES: { service: OneCupService; wordmark: string; href: string }[] = [
  { service: "daily", wordmark: "DAILY", href: "/daily" },
  { service: "meetup", wordmark: "MEETUP", href: "/" },
];

// The service name next to the 1cup logo, set in the logo's own face (Noto Sans
// ExtraCondensed Bold) at its cap height: 35.34 of the logo's 54-unit viewBox, i.e.
// 14.4px at h-22 → 20.16px type. The row aligns on baseline, which puts every item's
// baseline on the logo's bottom edge; the logo's lettering sits 2.55px above that edge,
// so the wordmark rises by that much and the 16px divider rises 3px to stay centred.
const wordmarkClass =
  "uppercase leading-none tracking-[0.025em] [font-family:var(--font-daily-wordmark),sans-serif] [font-stretch:62.5%] font-bold";

// "ONE CUP | DAILY" / "ONE CUP | MEETUP": the logo of each 1cupenglish.com service.
// Clicking it opens a small menu that switches between the two services.
export default function ServiceSwitcher({
  current,
  copy,
  tone = "light",
}: {
  current: OneCupService;
  copy: ServiceSwitcherCopy;
  // "dark" while the navbar is transparent over the home page's dark hero.
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const active = SERVICES.find((item) => item.service === current) ?? SERVICES[0];
  const dark = tone === "dark";

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${dailyWordmark.variable}`}>
      <button
        ref={button}
        type="button"
        aria-label={`One Cup ${active.wordmark}, ${copy.label}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-[38px] shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent p-0 [font-family:inherit]"
      >
        <span className="flex h-[22px] items-baseline gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dark ? "/images/logos/1cup_logo_new_white.svg" : "/images/logos/1cup_logo_new.svg"}
            alt=""
            className="h-[22px] w-auto"
          />
          <span
            aria-hidden
            className={`relative -top-[3px] h-4 w-px ${dark ? "bg-white/45" : "bg-[#cbd5e1]"}`}
          />
          <span className={`relative -top-[2.55px] text-[20.16px] text-[#f47a4a] ${wordmarkClass}`}>
            {active.wordmark}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={`ml-1 size-4 shrink-0 transition-[transform,color] duration-150 ease-out ${
            open ? "rotate-180" : ""
          } ${dark ? "text-white/70 group-hover:text-white" : "text-[#94a3b8] group-hover:text-[#050505]"}`}
        />
      </button>

      <div
        id={menuId}
        className={`absolute left-0 top-[calc(100%+10px)] z-10 w-[272px] origin-top-left rounded-[14px] border border-[#e5e7eb] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] transition-[opacity,transform,visibility] duration-150 ease-out ${
          open ? "visible scale-100 opacity-100" : "invisible scale-[0.97] opacity-0"
        }`}
      >
        <p className="px-3 pb-1 pt-2 text-[0.75rem] font-bold text-[#94a3b8]">{copy.label}</p>
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {SERVICES.map((item) => {
            const selected = item.service === current;
            return (
              <li key={item.service}>
                <Link
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 no-underline transition-colors hover:bg-[#f5f5f4] ${
                    selected ? "bg-[#fafaf9]" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[18px] ${wordmarkClass} ${selected ? "text-[#f47a4a]" : "text-[#050505]"}`}
                    >
                      {item.wordmark}
                    </span>
                    <span className="mt-1 block text-[0.8rem] font-medium leading-snug text-[#64748b] [word-break:keep-all]">
                      {copy[item.service]}
                    </span>
                  </span>
                  {selected && <CheckIcon aria-hidden className="size-[18px] shrink-0 text-[#f47a4a]" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
