"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAILY_TRIAL_OPEN, DAILY_TRIAL_PATH } from "../constants";
import { dailyCopy } from "../copy";
import { dailyWordmark } from "../fonts";
import { cn } from "./DailyUI";
import "../daily.css";

// Replaces the global NewNavbar on /daily: the 1cup logo, the DAILY wordmark and one
// call to action, on the same 720px column as the page content.
export default function DailyNavbar() {
  const copy = dailyCopy.nav;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "daily-nav fixed inset-x-0 top-0 z-50 border-b bg-white/95 backdrop-blur-[14px] transition-colors",
        dailyWordmark.variable,
        scrolled ? "border-[#e5e7eb]" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-[60px] w-full max-w-[752px] items-center justify-between gap-4 px-4">
        {/* DAILY is set in the logo's own face (Noto Sans ExtraCondensed Bold) at its cap
            height: 35.34 of the logo's 54-unit viewBox, i.e. 14.4px at h-22 → 20.16px type.
            The row aligns on baseline, which puts every item's baseline on the logo's bottom
            edge; the logo's lettering sits 2.55px above that edge, so DAILY rises by that
            much and the 16px divider rises 3px to stay centred on the 22px logo. */}
        <Link href="/daily" className="flex h-[22px] shrink-0 items-baseline gap-2.5" aria-label="One Cup Daily">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logos/1cup_logo_new.svg" alt="" className="h-[22px] w-auto" />
          <span aria-hidden className="relative -top-[3px] h-4 w-px bg-[#cbd5e1]" />
          <span className="relative -top-[2.55px] text-[20.16px] font-bold uppercase leading-none tracking-[0.025em] text-[#f47a4a] [font-family:var(--font-daily-wordmark),sans-serif] [font-stretch:62.5%]">
            {copy.brand}
          </span>
        </Link>
        <Link
          href={DAILY_TRIAL_OPEN ? DAILY_TRIAL_PATH : "/daily#pricing"}
          className="inline-flex h-10 items-center rounded-full bg-[#f47a4a] px-4 text-[0.9rem] font-black text-[#050505]"
        >
          {copy.cta}
        </Link>
      </div>
    </nav>
  );
}
