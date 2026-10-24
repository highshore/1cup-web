"use client";

import Link from "next/link";
import { useI18n } from "./lib/i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[960px] items-center justify-center px-4 py-16 max-[768px]:px-5">
      <section className="w-full max-w-[680px] rounded-[20px] border-2 border-[#050505] bg-white p-10 text-center shadow-[7px_7px_0_#f47a4a] max-[768px]:rounded-[16px] max-[768px]:p-7 max-[768px]:shadow-[5px_5px_0_#f47a4a]">
        <p className="m-0 text-[clamp(4.5rem,14vw,8rem)] font-black leading-none tracking-[-0.06em] text-[#f47a4a]">
          404
        </p>
        <h1 className="mt-5 mb-3 text-[clamp(1.7rem,5vw,2.5rem)] font-black tracking-[-0.03em] text-[#050505]">
          {t.notFound.title}
        </h1>
        <p className="mx-auto mb-8 max-w-[520px] text-[1rem] leading-7 text-[rgba(5,5,5,0.65)]">
          {t.notFound.description}
        </p>

        <nav
          className="flex flex-wrap items-center justify-center gap-3"
          aria-label={t.notFound.navigationLabel}
        >
          <Link
            href="/"
            className="rounded-full border-2 border-[#050505] bg-[#f47a4a] px-6 py-3 text-sm font-black text-[#050505] shadow-[3px_3px_0_#050505] transition-transform hover:-translate-y-0.5"
          >
            {t.notFound.home}
          </Link>
          <Link
            href="/meetup"
            className="rounded-full border-2 border-[#050505] bg-white px-6 py-3 text-sm font-black text-[#050505] shadow-[3px_3px_0_#050505] transition-transform hover:-translate-y-0.5"
          >
            {t.notFound.meetup}
          </Link>
          <Link
            href="/blog"
            className="rounded-full border-2 border-[#050505] bg-white px-6 py-3 text-sm font-black text-[#050505] shadow-[3px_3px_0_#050505] transition-transform hover:-translate-y-0.5"
          >
            {t.notFound.blog}
          </Link>
        </nav>
      </section>
    </main>
  );
}
