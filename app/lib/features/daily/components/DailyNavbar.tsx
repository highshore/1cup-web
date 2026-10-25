"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { dailyCopy } from "../copy";
import { dailyWordmark } from "../fonts";
import { cn } from "./DailyUI";
import "../daily.css";

// Replaces the global NewNavbar on /daily: the 1cup logo stays, the rest is Daily's own.
export default function DailyNavbar() {
  const copy = dailyCopy.nav;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <nav
      className={cn(
        "daily-nav fixed inset-x-0 top-0 z-50 border-b bg-white/95 backdrop-blur-[14px] transition-colors",
        dailyWordmark.variable,
        scrolled ? "border-[#e5e7eb]" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-[60px] w-full max-w-[1200px] items-center gap-4 px-4 min-[900px]:px-8">
        <Link href="/daily" onClick={close} className="flex shrink-0 items-center gap-2.5" aria-label="1cup Daily">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logos/1cup_logo_new.svg" alt="" className="h-[22px] w-auto" />
          <span aria-hidden className="h-4 w-px bg-[#cbd5e1]" />
          <span className="text-[1.3rem] font-semibold uppercase leading-none tracking-[0.03em] text-[#050505] [font-family:var(--font-daily-wordmark),sans-serif]">
            {copy.brand}
          </span>
        </Link>

        <ul className="m-0 ml-4 hidden list-none items-center gap-1 p-0 min-[1000px]:flex">
          {copy.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3 py-2 text-[0.88rem] font-bold text-[#334155] transition-colors hover:bg-[#f5f5f5] hover:text-[#050505]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/"
            className="hidden rounded-full px-3 py-2 text-[0.88rem] font-bold text-[#334155] hover:text-[#050505] min-[1000px]:inline-flex"
          >
            {copy.home}
          </Link>
          <a
            href="/daily#pricing"
            onClick={close}
            className="inline-flex h-10 items-center rounded-full bg-[#f47a4a] px-4 text-[0.9rem] font-black text-[#050505]"
          >
            {copy.cta}
          </a>
          <button
            type="button"
            aria-label={copy.menu}
            aria-expanded={open}
            aria-controls="daily-menu"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex size-10 items-center justify-center rounded-full text-[#050505] hover:bg-[#f5f5f5] min-[1000px]:hidden"
          >
            {open ? <XMarkIcon className="size-6" aria-hidden /> : <Bars3Icon className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div id="daily-menu" className="border-t border-[#e5e7eb] bg-white px-4 pb-5 pt-2 min-[1000px]:hidden">
          <ul className="m-0 flex list-none flex-col p-0">
            {copy.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={close}
                  className="block border-b border-[#f1f5f9] py-3.5 text-[1rem] font-bold text-[#050505]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2 text-[0.9rem] font-bold text-[#475569]">
            <Link href="/" onClick={close} className="rounded-full bg-[#f5f5f5] px-4 py-2.5">
              {copy.home}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
