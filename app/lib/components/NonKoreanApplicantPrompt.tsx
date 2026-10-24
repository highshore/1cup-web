"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../i18n/I18nProvider";

const PROMPT_SESSION_KEY = "nonKoreanApplicantPromptSeen";

export default function NonKoreanApplicantPrompt() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isExcludedRoute =
    pathname === "/non-korean-applicants" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/payment");

  useEffect(() => {
    if (locale !== "en" || isExcludedRoute) {
      setOpen(false);
      return;
    }

    if (sessionStorage.getItem(PROMPT_SESSION_KEY)) return;

    const timer = window.setTimeout(() => {
      sessionStorage.setItem(PROMPT_SESSION_KEY, "true");
      setOpen(true);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isExcludedRoute, locale, pathname]);

  if (!open) return null;

  const copy = t.nonKoreanApplicants.popup;
  const dismiss = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-[90] grid [place-items:end_center] bg-[rgba(5,5,5,0.38)] p-4"
      role="presentation"
      onMouseDown={dismiss}
    >
      <section
        className="relative w-full max-w-[28rem] rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] p-5 shadow-[6px_6px_0_#050505]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="non-korean-applicant-prompt-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="absolute top-[0.55rem] right-[0.55rem] grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[1.35rem] leading-none text-[#050505] hover:bg-[rgba(5,5,5,0.08)] focus-visible:bg-[rgba(5,5,5,0.08)]"
          type="button"
          onClick={dismiss}
          aria-label={copy.close}
        >
          ×
        </button>
        <h2
          id="non-korean-applicant-prompt-title"
          className="m-0 max-w-[20rem] text-[1.35rem] font-[950] leading-[1.2] text-[#050505]"
        >
          {copy.title}
        </h2>
        <p className="m-0 mt-[0.7rem] text-[0.9rem] font-[620] leading-[1.55] text-[rgba(5,5,5,0.7)]">
          {copy.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-[0.55rem]">
          <Link
            className="inline-flex min-h-[42px] items-center justify-center rounded-full border-2 border-[#050505] bg-[#050505] px-[0.85rem] py-[0.55rem] text-[0.82rem] font-[900] text-white no-underline hover:text-white hover:no-underline"
            href="/non-korean-applicants"
            onClick={dismiss}
          >
            {copy.primary}
          </Link>
          <button
            className="min-h-[42px] cursor-pointer rounded-full border-2 border-[#050505] bg-transparent px-[0.85rem] py-[0.55rem] text-[0.82rem] font-[850] text-[#050505]"
            type="button"
            onClick={dismiss}
          >
            {copy.dismiss}
          </button>
        </div>
      </section>
    </div>
  );
}
