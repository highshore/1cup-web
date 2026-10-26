"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/solid";
import {
  DAILY_MONTHLY_PRICE_KRW,
  DAILY_PASSES,
  DAILY_TERMS_PATH,
  DAILY_TRIAL_OPEN,
  DAILY_TRIAL_PATH,
  formatKrw,
} from "../constants";
import { dailyCopy } from "../copy";
import { dailyDisplay } from "../fonts";
import { DAILY_BUSINESS } from "./DailyLegal";
import { cn, displayClass, Emoji } from "./DailyUI";
import "../daily.css";

// /daily/guide: how to use Daily, from signup to refunds. Copy in dailyCopy.guide.
const copy = dailyCopy.guide;

const CONTENTS = [
  copy.start,
  copy.receive,
  copy.lesson,
  copy.signin,
  copy.subscribe,
  copy.manage,
  copy.refund,
  copy.review,
  copy.soon,
  copy.help,
].map(({ id, title }) => ({ id, title }));

// Fixed 60px navbar plus breathing room, so anchored headings are not hidden under it.
const ANCHOR = "scroll-mt-[84px]";

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn(ANCHOR, "border-t border-[#e7e5e4] pt-12 first:border-t-0")}>
      <h2 className={cn(displayClass, "text-center text-[1.75rem] leading-tight min-[900px]:text-left min-[900px]:text-[2rem]")}>
        {title}
      </h2>
      {sub && (
        <p className="mt-2 text-center text-[0.98rem] font-semibold text-[#57534e] min-[900px]:text-left">{sub}</p>
      )}
      <div className="mt-7">{children}</div>
    </section>
  );
}

// Real sequences only: the signup and the checkout are steps people take in order.
function Steps({ items }: { items: ReadonlyArray<{ title: string; detail?: string }> }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-0 p-0">
      {items.map((item, index) => (
        <li key={item.title} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 && <span aria-hidden className="absolute left-[17px] top-10 h-[calc(100%-2.75rem)] w-0.5 bg-[#fde2d4]" />}
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#050505] text-[0.95rem] font-black text-white">
            {index + 1}
          </span>
          <span className="min-w-0 pt-1.5">
            <span className="block text-[1.05rem] font-black">{item.title}</span>
            {item.detail && <span className="mt-1 block text-[0.95rem] font-semibold leading-[1.65] text-[#57534e]">{item.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Pairs({ items }: { items: ReadonlyArray<{ title: string; detail: string }> }) {
  return (
    <dl className="m-0 grid gap-x-8 gap-y-5 min-[600px]:grid-cols-[minmax(0,15rem)_1fr]">
      {items.map((item) => (
        <div key={item.title} className="contents">
          <dt className="text-[1rem] font-black">{item.title}</dt>
          <dd className="m-0 -mt-3 text-[0.95rem] font-semibold leading-[1.65] text-[#57534e] min-[600px]:mt-0">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function Week() {
  const { week } = copy;
  return (
    <div className="rounded-[28px] bg-[#050505] p-5 text-white min-[900px]:p-7">
      <p className="text-center text-[1.1rem] font-black min-[900px]:text-left">{week.title}</p>
      <p className="mt-1 text-center text-[0.9rem] font-semibold text-white/65 min-[900px]:text-left">{week.sub}</p>
      <ol className="m-0 mt-5 grid list-none grid-cols-7 gap-1.5 p-0">
        {week.days.map(({ day, kind }) => (
          <li
            key={day}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl px-1 py-3",
              kind === "lesson" && "bg-[#f47a4a] text-[#050505]",
              kind === "review" && "bg-[#fff8dc] text-[#050505]",
              kind === "rest" && "bg-white/10 text-white/60",
            )}
          >
            <span className="text-[1rem] font-black">{day}</span>
            <Emoji className="text-[1.5rem]" motion="none">
              {kind === "lesson" ? "☕" : kind === "review" ? "🧠" : "😴"}
            </Emoji>
            <span className="text-center text-[0.68rem] font-extrabold leading-tight min-[420px]:text-[0.75rem]">
              {week.kinds[kind as keyof typeof week.kinds]}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-center text-[0.85rem] font-semibold leading-relaxed text-white/65 min-[900px]:text-left">{week.note}</p>
    </div>
  );
}

const primaryButton =
  "inline-flex h-[54px] w-full items-center justify-center rounded-2xl px-6 text-[1rem] font-black min-[600px]:w-auto";

export default function DailyGuide() {
  const monthly = formatKrw(DAILY_MONTHLY_PRICE_KRW);
  const { start, receive, lesson, signin, subscribe, manage, refund, review, soon, help, contact } = copy;

  return (
    <div className={cn("daily-page bg-white text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <header className="bg-[#fff8dc] px-4 pb-12 pt-12 min-[900px]:pt-16">
        <div className="mx-auto w-full max-w-[720px] text-center min-[900px]:text-left">
          <Emoji className="text-[2.8rem]">📖</Emoji>
          <h1 className={cn(displayClass, "mt-3 text-[2.5rem] leading-[1.1] min-[900px]:text-[3rem]")}>{copy.title}</h1>
          <p className="mx-auto mt-3 max-w-[34rem] text-[1.02rem] font-semibold leading-relaxed text-[#57534e] min-[900px]:mx-0">
            {copy.lead}
          </p>

          <nav aria-label={copy.contents} className="mt-8 rounded-[24px] bg-white p-5 text-left">
            <p className="text-[0.85rem] font-extrabold text-[#78716c]">{copy.contents}</p>
            <ul className="m-0 mt-3 grid list-none gap-x-6 gap-y-1 p-0 min-[600px]:grid-cols-2">
              {CONTENTS.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="block py-1.5 text-[0.98rem] font-bold text-[#050505] underline-offset-4 hover:underline">
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[752px] flex-col gap-12 px-4 pb-24 pt-10">
        <Week />

        <Section id={start.id} title={start.title} sub={start.sub}>
          <Steps items={start.steps} />
          <ul className="m-0 mt-7 flex list-none flex-col gap-2 p-0">
            {start.rules.map((rule) => (
              <li key={rule} className="rounded-2xl bg-[#f5f5f4] px-4 py-3 text-[0.92rem] font-semibold leading-relaxed text-[#44403c]">
                {rule}
              </li>
            ))}
          </ul>
          {DAILY_TRIAL_OPEN && (
            <Link href={DAILY_TRIAL_PATH} className={cn(primaryButton, "mt-6 bg-[#f47a4a] text-[#050505]")}>
              {start.cta}
            </Link>
          )}
        </Section>

        <Section id={receive.id} title={receive.title}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {receive.items.map((item) => (
              <li key={item.title} className="flex gap-4 rounded-[22px] bg-[#f5f5f4] p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[1.6rem]">
                  <Emoji label={item.label} motion="none">{item.emoji}</Emoji>
                </span>
                <span className="min-w-0">
                  <span className="block text-[1.02rem] font-black">{item.title}</span>
                  <span className="mt-0.5 block text-[0.92rem] font-semibold leading-[1.6] text-[#57534e]">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id={lesson.id} title={lesson.title} sub={lesson.sub}>
          <ol className="m-0 grid list-none gap-3 p-0 min-[600px]:grid-cols-2">
            {lesson.parts.map((part) => (
              <li key={part.title} className="rounded-[22px] border border-[#e7e5e4] p-4">
                <span className="flex items-center gap-2 text-[1.02rem] font-black">
                  <Emoji label={part.label} motion="none" className="text-[1.3rem]">{part.emoji}</Emoji>
                  {part.title}
                </span>
                <span className="mt-1.5 block text-[0.92rem] font-semibold leading-[1.6] text-[#57534e]">{part.detail}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[0.88rem] font-semibold text-[#78716c]">{lesson.tip}</p>
        </Section>

        <Section id={signin.id} title={signin.title}>
          <Pairs items={signin.items} />
        </Section>

        <Section id={subscribe.id} title={subscribe.title} sub={subscribe.sub}>
          <div className="overflow-hidden rounded-[22px] border border-[#e7e5e4]">
            <table className="w-full border-collapse text-left text-[0.92rem]">
              <thead className="bg-[#f5f5f4] text-[0.8rem] font-extrabold text-[#78716c]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-extrabold">{subscribe.planHeader.name}</th>
                  <th scope="col" className="px-4 py-2.5 font-extrabold">{subscribe.planHeader.price}</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-extrabold min-[600px]:table-cell">{subscribe.planHeader.how}</th>
                </tr>
              </thead>
              <tbody className="font-semibold">
                <tr className="border-t border-[#e7e5e4] bg-[#fff8dc]">
                  <th scope="row" className="px-4 py-3 font-black">
                    {subscribe.subscription.name}
                    <span className="block text-[0.8rem] font-semibold text-[#78716c] min-[600px]:hidden">{subscribe.subscription.how}</span>
                  </th>
                  <td className="px-4 py-3 font-black">₩{monthly}</td>
                  <td className="hidden px-4 py-3 text-[#57534e] min-[600px]:table-cell">{subscribe.subscription.how}</td>
                </tr>
                {DAILY_PASSES.map((pass) => (
                  <tr key={pass.id} className="border-t border-[#e7e5e4]">
                    <th scope="row" className="px-4 py-3 font-black">
                      {pass.label}
                      <span className="block text-[0.8rem] font-semibold text-[#78716c] min-[600px]:hidden">{subscribe.passHow}</span>
                    </th>
                    <td className="px-4 py-3 font-black">₩{formatKrw(pass.priceKrw)}</td>
                    <td className="hidden px-4 py-3 text-[#57534e] min-[600px]:table-cell">{subscribe.passHow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <Steps items={subscribe.steps.map((title) => ({ title }))} />
          </div>
          <ul className="m-0 mt-7 flex list-none flex-col gap-2 p-0">
            {subscribe.notes.map((note) => (
              <li key={note} className="rounded-2xl bg-[#f5f5f4] px-4 py-3 text-[0.92rem] font-semibold leading-relaxed text-[#44403c]">
                {note}
              </li>
            ))}
          </ul>
          <Link href="/daily/subscribe" className={cn(primaryButton, "mt-6 bg-[#050505] text-white")}>
            {subscribe.cta}
          </Link>
        </Section>

        <Section id={manage.id} title={manage.title}>
          <Pairs items={manage.items} />
        </Section>

        <Section id={refund.id} title={refund.title}>
          <Pairs items={refund.rules} />
          <div className="mt-6 rounded-[22px] bg-[#fff8dc] p-5">
            <p className="text-[0.85rem] font-extrabold text-[#78716c]">{refund.exampleTitle}</p>
            <p className="mt-1 text-[1rem] font-bold leading-relaxed">{refund.example}</p>
          </div>
          <p className="mt-5 text-[0.95rem] font-semibold leading-[1.65] text-[#57534e]">{refund.how}</p>
          <Link href={DAILY_TERMS_PATH} className="mt-3 inline-block text-[0.92rem] font-bold underline underline-offset-4">
            {refund.terms}
          </Link>
        </Section>

        <Section id={review.id} title={review.title}>
          <p className="m-0 text-[0.98rem] font-semibold leading-[1.7] text-[#44403c]">{review.detail}</p>
        </Section>

        <Section id={soon.id} title={soon.title} sub={soon.sub}>
          <ul className="m-0 grid list-none gap-x-8 gap-y-2.5 rounded-[22px] bg-[#f5f5f4] p-5 min-[600px]:grid-cols-2">
            {soon.items.map((item) => (
              <li key={item} className="text-[0.95rem] font-bold text-[#57534e]">
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section id={help.id} title={help.title}>
          <div className="flex flex-col gap-3">
            {help.items.map((item) => (
              <details key={item.q} className="daily-faq group rounded-[20px] bg-[#f5f5f4] text-left">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[1.02rem] font-extrabold">
                  {item.q}
                  <PlusIcon className="daily-faq-icon size-5 shrink-0 transition-transform duration-200" aria-hidden />
                </summary>
                <p className="m-0 px-5 pb-5 text-[0.95rem] leading-[1.7] text-[#57534e]">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] bg-[#050505] p-6 text-white">
            <p className="text-[1.1rem] font-black">{contact.title}</p>
            <p className="mt-1 text-[0.92rem] font-semibold text-white/70">{contact.detail}</p>
            <p className="mt-4 flex flex-col gap-1 text-[1rem] font-bold min-[600px]:flex-row min-[600px]:gap-6">
              <a href={`mailto:${DAILY_BUSINESS.email}`} className="underline underline-offset-4">
                {DAILY_BUSINESS.email}
              </a>
              <a href={`tel:${DAILY_BUSINESS.phone.replace(/-/g, "")}`} className="underline underline-offset-4">
                {DAILY_BUSINESS.phone}
              </a>
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
