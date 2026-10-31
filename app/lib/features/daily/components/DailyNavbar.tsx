"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAILY_SESSION_EVENT, dailyApi } from "../api";
import { DAILY_ACCOUNT_PATH, DAILY_TRIAL_OPEN, DAILY_TRIAL_PATH } from "../constants";
import { dailyCopy } from "../copy";
import ServiceSwitcher from "../../../components/ServiceSwitcher";
import { cn, dailyColumn } from "./DailyUI";
import "../daily.css";

// Replaces the global NewNavbar on /daily: the 1cup logo with the DAILY wordmark (it
// opens the switch to MEETUP) and one call to action, on Daily's page column (the main
// site's, so the logo sits where it does on /meetup). Signed in, the call to action becomes the account link.
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
        scrolled ? "border-[#e5e7eb]" : "border-transparent",
      )}
    >
      <div className={cn(dailyColumn, "flex h-[60px] items-center justify-between gap-4")}>
        <ServiceSwitcher current="daily" copy={copy.services} />
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
