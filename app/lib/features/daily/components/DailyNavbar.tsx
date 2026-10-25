"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAILY_SESSION_EVENT, dailyApi } from "../api";
import { DAILY_ACCOUNT_PATH, DAILY_TRIAL_OPEN, DAILY_TRIAL_PATH } from "../constants";
import { dailyCopy } from "../copy";
import { dailyWordmark } from "../fonts";
import { cn } from "./DailyUI";
import "../daily.css";

// Replaces the global NewNavbar on /daily: the 1cup logo, the DAILY wordmark and one
// call to action, on the same 720px column as the page content. Signed in, the call to
// action becomes the account link.
export default function DailyNavbar() {
  const copy = dailyCopy.nav;
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const load = () =>
      dailyApi<{ signedIn: boolean }>("session-info")
        .then((data) => setSignedIn(data.signedIn))
        .catch(() => setSignedIn(false));
    void load();
    window.addEventListener(DAILY_SESSION_EVENT, load);
    return () => window.removeEventListener(DAILY_SESSION_EVENT, load);
  }, []);

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
        <Link href="/daily" className="flex shrink-0 items-center gap-2.5" aria-label="One Cup Daily">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logos/1cup_logo_new.svg" alt="" className="h-[22px] w-auto" />
          <span aria-hidden className="h-4 w-px bg-[#cbd5e1]" />
          <span className="text-[1.3rem] font-semibold uppercase leading-none tracking-[0.03em] text-[#050505] [font-family:var(--font-daily-wordmark),sans-serif]">
            {copy.brand}
          </span>
        </Link>
        {signedIn ? (
          <Link
            href={DAILY_ACCOUNT_PATH}
            className="inline-flex h-10 items-center rounded-full bg-[#050505] px-4 text-[0.9rem] font-black text-white"
          >
            {copy.account}
          </Link>
        ) : (
          <Link
            href={DAILY_TRIAL_OPEN ? DAILY_TRIAL_PATH : "/daily#pricing"}
            className="inline-flex h-10 items-center rounded-full bg-[#f47a4a] px-4 text-[0.9rem] font-black text-[#050505]"
          >
            {copy.cta}
          </Link>
        )}
      </div>
    </nav>
  );
}
