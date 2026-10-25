"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  CheckBadgeIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import {
  AcademicCapIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  CpuChipIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  PlusIcon,
  PresentationChartBarIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { ShieldCheckIcon as ShieldCheckSolid } from "@heroicons/react/24/solid";
import {
  CupMark,
  Emoji,
  Headline,
  Panel,
  Pill,
  TrialButton,
  cn,
  displayClass,
} from "../lib/features/daily/components/DailyUI";
import { HeroPhoneDemo, IosNotification, IPhone, LessonScreen } from "../lib/features/daily/components/Phone";
import {
  DAILY_MONTHLY_PRICE_KRW,
  DAILY_PASSES,
  DAILY_GUIDE_PATH,
  DAILY_TERMS_PATH,
  formatKrw,
} from "../lib/features/daily/constants";
import { dailyCopy } from "../lib/features/daily/copy";
import type { PublicDailyReview } from "../lib/features/daily/server/reviews";
import { dailyDisplay } from "../lib/features/daily/fonts";
import { useReached, useScrolledPast, useSeen } from "../lib/features/daily/hooks";
import "../lib/features/daily/daily.css";

const price = formatKrw(DAILY_MONTHLY_PRICE_KRW);

const sceneIcons = {
  meeting: PresentationChartBarIcon,
  mail: EnvelopeIcon,
  chat: ChatBubbleLeftRightIcon,
  standup: UserGroupIcon,
} as const;

const credentialIcons = {
  office: BuildingOffice2Icon,
  globe: GlobeAltIcon,
  shield: ShieldCheckIcon,
  school: AcademicCapIcon,
  chip: CpuChipIcon,
} as const;

// Display sizes: mobile from Figma 43:2, desktop ×1.35 (Figma 48:428).
const h2Class = cn(displayClass, "text-[2.25rem] leading-[1.18] min-[900px]:text-[3.05rem]");

// Reviews appear only when at least this many real, approved ones exist.
const MIN_REVIEWS = 3;

export default function DailyClient({ reviews }: { reviews: PublicDailyReview[] }) {
  const copy = dailyCopy;
  const heroRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const pastHero = useScrolledPast(heroRef);
  // The bar repeats the pricing CTA, so it steps aside once pricing is on screen.
  const reachedPricing = useReached(pricingRef);

  return (
    <div className={cn("daily-page bg-white text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      {/* P1: hero */}
      <section className="overflow-hidden bg-[#f47a4a] px-4 pb-16 pt-10 min-[900px]:pb-24 min-[900px]:pt-20">
        <div
          ref={heroRef}
          className="mx-auto grid w-full max-w-[720px] items-center gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_290px] min-[900px]:gap-8"
        >
          <div className="flex flex-col items-center text-center min-[900px]:items-start min-[900px]:text-left">
            <span className="relative mb-4 inline-block text-[2.6rem]">
              <Emoji>☕</Emoji>
            </span>
            <Pill className="bg-[#050505] text-white">
              <ShieldCheckSolid className="size-4 text-[#f47a4a]" aria-hidden />
              {copy.hero.tagline}
            </Pill>
            <h1 className={cn(displayClass, "mt-5 text-[2.9rem] leading-[1.12] min-[900px]:text-[3.3rem]")}>
              <Headline text={copy.hero.title} accent={copy.hero.accent} accentClassName="text-white" />
            </h1>
            <p className="mt-5 max-w-[30rem] text-[1.02rem] font-semibold leading-[1.65] text-[rgba(5,5,5,0.78)] min-[900px]:text-[1.12rem]">
              {copy.hero.lead}
            </p>
            <TrialButton label={copy.hero.cta} className="mt-7 w-full min-[520px]:w-auto" />
            <ul className="m-0 mt-4 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 text-[0.88rem] font-bold min-[900px]:justify-start">
              {copy.hero.trust.map((item) => (
                <li key={item} className="flex items-center gap-1">
                  <CheckIcon className="size-4" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto flex w-full max-w-[520px] justify-center pt-10">
            <div className="daily-phone-in relative">
              <HeroPhoneDemo className="w-[min(320px,calc(100vw-48px))]" />
            </div>
            <IosNotification className="daily-drop absolute left-1/2 top-0 w-[min(300px,calc(100%-8px))] -translate-x-1/2 min-[900px]:w-[280px]" />
          </div>
        </div>
      </section>

      {/* P2: commute photo */}
      <section className="relative isolate overflow-hidden bg-[#050505] text-white">
        <Image
          src="/assets/daily/commute.webp"
          alt={copy.photo.alt}
          fill
          sizes="100vw"
          className="-z-10 object-cover opacity-80"
        />
        <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,5,5,0)_30%,rgba(5,5,5,0.85))] min-[900px]:bg-[linear-gradient(90deg,rgba(5,5,5,0.85),rgba(5,5,5,0.1)_70%)]" />
        <div className="mx-auto flex min-h-[460px] w-full max-w-[752px] flex-col items-center justify-end px-4 py-12 text-center min-[900px]:min-h-[560px] min-[900px]:items-start min-[900px]:justify-center min-[900px]:text-left">
          <Pill className="bg-[#f47a4a] text-[#050505]">{copy.photo.badge}</Pill>
          <h2 className={cn(h2Class, "mt-4 text-white min-[900px]:text-[3.5rem]")}>
            <Headline text={copy.photo.title} />
          </h2>
          <p className="mt-3 max-w-[26rem] text-[1rem] font-semibold leading-[1.6] text-white/80">{copy.photo.body}</p>
        </div>
      </section>

      {/* P3: pain → goal */}
      <Panel className="bg-[#050505] text-white">
        <Emoji className="text-[2.6rem]">😵‍💫</Emoji>
        <h2 className={cn(h2Class, "mt-4")}>
          <Headline text={copy.pain.title} accent={copy.pain.accent} accentClassName="text-[#f47a4a]" />
        </h2>
        <ul className="m-0 mt-8 flex list-none flex-col gap-3 p-0">
          {copy.pain.items.map((item, index) => (
            <li
              key={item}
              className={cn(
                "max-w-[30rem] rounded-[22px] bg-white/10 px-5 py-4 text-left text-[1rem] font-bold leading-snug",
                index % 2 === 1 ? "self-end rounded-br-[6px]" : "rounded-bl-[6px]",
              )}
            >
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-14 flex flex-col items-center text-center">
          <Emoji className="text-[2.4rem]">👇</Emoji>
          <h2 className={cn(h2Class, "mt-3")}>
            <Headline text={copy.pain.goalTitle} accent={copy.pain.goalAccent} accentClassName="text-[#f47a4a]" />
          </h2>
        </div>
        <ul className="m-0 mt-8 flex list-none flex-col gap-3 p-0">
          {copy.pain.goals.map((goal, index) => (
            <li
              key={goal}
              className={cn(
                "max-w-[30rem] rounded-[22px] bg-[#f47a4a] px-5 py-4 text-left text-[1rem] font-black leading-snug text-[#050505]",
                index % 2 === 0 ? "self-end rounded-br-[6px]" : "rounded-bl-[6px]",
              )}
            >
              {goal}
            </li>
          ))}
        </ul>
      </Panel>

      {/* P4: benefits */}
      <Panel>
        <h2 className={h2Class}>
          <Headline text={copy.benefits.title} accent={copy.benefits.accent} accentClassName="text-[#f47a4a]" />
        </h2>
        <ul className="m-0 mt-9 grid list-none grid-cols-2 gap-3 p-0 min-[900px]:gap-4">
          {copy.benefits.items.map((item) => (
            <li key={item.title} className="rounded-[24px] bg-[#f5f5f4] p-5 min-[900px]:p-7">
              <Emoji label={item.label} className="text-[2.2rem] min-[900px]:text-[2.6rem]">
                {item.emoji}
              </Emoji>
              <p className="mt-4 text-[1.12rem] font-black leading-tight min-[900px]:text-[1.3rem]">{item.title}</p>
              <p className="mt-1.5 text-[0.88rem] font-semibold leading-snug text-[#64748b]">{item.detail}</p>
            </li>
          ))}
        </ul>
      </Panel>

      {/* P5: lesson preview */}
      <Panel id="lesson" className="overflow-hidden bg-[#fff8dc]">
        <div className="text-center">
          <Emoji className="text-[2.6rem]">🔔</Emoji>
          <h2 className={cn(h2Class, "mt-4")}>
            <Headline text={copy.lesson.title} accent={copy.lesson.accent} accentClassName="text-[#f47a4a]" />
          </h2>
          <p className="mt-3 text-[1rem] font-semibold text-[#475569]">{copy.lesson.sub}</p>
        </div>
        <div className="relative mx-auto mt-12 w-fit">
          <IPhone className="w-[min(320px,calc(100vw-48px))]" statusClassName="bg-white text-[#050505]">
            <LessonScreen />
          </IPhone>
          <Callout className="left-[-28px] top-[96px] min-[900px]:left-[-150px]" emoji="🔊">
            {copy.lesson.callouts.audio}
          </Callout>
          <Callout className="right-[-30px] top-[190px] min-[900px]:right-[-150px]" emoji="💡">
            {copy.lesson.callouts.nuance}
          </Callout>
          <Callout className="left-[-30px] top-[330px] min-[900px]:left-[-150px]" emoji="🗣️">
            {copy.lesson.callouts.examples}
          </Callout>
          <Callout className="bottom-[70px] right-[-26px] min-[900px]:right-[-150px]" emoji="⚡">
            {copy.lesson.callouts.quiz}
          </Callout>
        </div>
      </Panel>

      {/* P6: real expressions */}
      <Panel>
        <h2 className={cn(h2Class, "text-center")}>
          <Headline text={copy.expressions.title} />
        </h2>
        <ul className="m-0 mt-9 grid list-none gap-3 p-0 min-[900px]:grid-cols-3">
          {copy.expressions.items.map((item) => (
            <ExpressionCard key={item.en} {...item} />
          ))}
        </ul>
      </Panel>

      {/* P7: before / after */}
      <Panel className="bg-[#050505] text-white">
        <h2 className={h2Class}>
          <Headline text={copy.beforeAfter.title} accent={copy.beforeAfter.accent} accentClassName="text-[#f47a4a]" />
        </h2>
        <ul className="m-0 mt-9 flex list-none flex-col gap-4 p-0 text-left">
          {copy.beforeAfter.pairs.map((pair) => (
            <li key={pair.after} className="grid gap-2 min-[900px]:grid-cols-2 min-[900px]:gap-3">
              <div className="rounded-[20px] bg-white/[0.08] px-5 py-4">
                <p className="text-[0.74rem] font-extrabold text-white/50">{copy.beforeAfter.before}</p>
                <p className="mt-1 text-[1rem] font-semibold text-white/60 line-through decoration-white/30">
                  {pair.before}
                </p>
              </div>
              <div className="rounded-[20px] bg-white px-5 py-4 text-[#050505]">
                <p className="text-[0.74rem] font-extrabold text-[#d95f2d]">{copy.beforeAfter.after}</p>
                <p className="mt-1 text-[1.05rem] font-bold">
                  <Highlighted text={pair.after} highlight={pair.highlight} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* P8: scenes */}
      <Panel className="bg-[#f47a4a]">
        <h2 className={h2Class}>
          <Headline text={copy.scenes.title} accent={copy.scenes.accent} accentClassName="text-white" />
        </h2>
        <ul className="m-0 mt-9 grid list-none grid-cols-2 gap-3 p-0 min-[900px]:grid-cols-4">
          {copy.scenes.items.map((scene) => {
            const Icon = sceneIcons[scene.icon as keyof typeof sceneIcons];
            return (
              <li key={scene.title} className="rounded-[24px] bg-white p-5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#050505] text-[#f47a4a] max-[899px]:mx-auto">
                  <Icon className="size-6" aria-hidden />
                </span>
                <p className="mt-4 text-[1.1rem] font-black">{scene.title}</p>
                <p className="mt-1 text-[0.88rem] font-semibold text-[#64748b]">{scene.detail}</p>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* Mastery: progress people can see */}
      <Panel>
        <h2 className={h2Class}>
          <Headline text={copy.mastery.title} accent={copy.mastery.accent} accentClassName="text-[#f47a4a]" />
        </h2>
        <p className="mt-3 text-[1rem] font-semibold text-[#475569]">{copy.mastery.sub}</p>
        <div className="mt-9 grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_280px] min-[900px]:items-center">
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
            {copy.mastery.steps.map((step) => (
              <li key={step.title} className="rounded-[24px] bg-[#f5f5f4] p-5">
                <Emoji label={step.label} className="text-[2.2rem]">
                  {step.emoji}
                </Emoji>
                <p className="mt-3 text-[1.08rem] font-black">{step.title}</p>
                <p className="mt-1 text-[0.86rem] font-semibold leading-snug text-[#64748b]">{step.detail}</p>
              </li>
            ))}
          </ul>
          <ProgressCard />
        </div>
      </Panel>

      {/* P9: tracks */}
      <Panel id="tracks">
        <h2 className={h2Class}>
          <Headline text={copy.tracks.title} accent={copy.tracks.accent} accentClassName="text-[#f47a4a]" />
        </h2>
        <ul className="m-0 mt-9 grid list-none gap-4 p-0 min-[900px]:grid-cols-2">
          {copy.tracks.items.map((track) => (
            <li key={track.key} className="overflow-hidden rounded-[28px] bg-[#f5f5f4]">
              <div className="relative aspect-[16/10]">
                <Image src={track.image} alt={track.alt} fill sizes="(min-width: 900px) 480px, 100vw" className="object-cover" />
                <span className="absolute left-4 top-4 flex size-14 items-center justify-center rounded-2xl bg-white text-[1.9rem] shadow-[0_8px_20px_-8px_rgba(5,5,5,0.4)]">
                  <Emoji label={track.emojiLabel}>{track.emoji}</Emoji>
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-[1.45rem] font-black">{track.title}</h3>
                <p className="mt-1 text-[0.98rem] font-semibold text-[#475569]">{track.tagline}</p>
                <div className="mt-5 flex items-center gap-3 max-[899px]:justify-center">
                  <Pill className="bg-[#f47a4a] text-[#050505]">{copy.tracks.free}</Pill>
                  <span className="text-[0.92rem] font-bold text-[#475569]">
                    {copy.tracks.price.replace("{price}", price)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* P10: founder credentials — no name or photo by design */}
      <Panel id="founder" className="bg-[#fff8dc]">
        <Emoji className="text-[2.6rem]">🗣️</Emoji>
        <div className="mt-4">
          <Pill className="bg-[#050505] text-white">{copy.founder.label}</Pill>
        </div>
        <h2 className={cn(displayClass, "mt-4 text-[1.65rem] leading-[1.3] min-[900px]:text-[2.6rem]")}>
          <Headline text={copy.founder.title} accent={copy.founder.accent} accentClassName="text-[#d95f2d]" />
        </h2>
        <ul className="m-0 mt-8 grid list-none gap-2.5 p-0 text-left min-[900px]:grid-cols-2">
          {copy.founder.credentials.map((credential) => {
            const Icon = credentialIcons[credential.icon as keyof typeof credentialIcons];
            return (
              <li key={credential.title} className="flex items-center gap-3.5 rounded-[20px] bg-white px-4 py-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f47a4a] text-[#050505]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-[1rem] font-extrabold">{credential.title}</span>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* Relatedness: other learners, visible where the lesson happens */}
      <Panel className="bg-[#050505] text-white">
        <h2 className={h2Class}>
          <Headline text={copy.relatedness.title} accent={copy.relatedness.accent} accentClassName="text-[#f47a4a]" />
        </h2>
        <p className="mt-3 text-[1rem] font-semibold text-white/70">{copy.relatedness.sub}</p>
        <div className="mt-9 grid gap-5 min-[900px]:grid-cols-[320px_minmax(0,1fr)] min-[900px]:items-start">
          <SentenceWall />
          <ul className="m-0 grid list-none gap-3 p-0 min-[600px]:grid-cols-2">
            {copy.relatedness.points.map((point) => (
              <li key={point.title} className="rounded-[24px] bg-white/[0.08] p-5">
                <Emoji label={point.label} className="text-[2.1rem]">
                  {point.emoji}
                </Emoji>
                <p className="mt-3 text-[1.02rem] font-black leading-snug">{point.title}</p>
                <p className="mt-1.5 text-[0.84rem] font-semibold leading-relaxed text-white/65">{point.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {reviews.length >= MIN_REVIEWS && <ReviewsSection reviews={reviews} />}

      {/* P11: pricing */}
      <Panel id="pricing" className="bg-[#f47a4a]">
        <div ref={pricingRef}>
          <Emoji className="text-[2.6rem]">🎁</Emoji>
          <h2 className={cn(h2Class, "mt-4")}>
            <Headline text={copy.pricing.title} accent={copy.pricing.accent} accentClassName="text-white" />
          </h2>
          <p className="mt-3 text-[1rem] font-semibold text-[rgba(5,5,5,0.78)]">{copy.pricing.trial}</p>
          <TrialButton label={copy.pricing.cta} className="mt-6 w-full" />
          <a
            href="/daily/subscribe"
            className="mt-2 flex h-[50px] w-full items-center justify-center rounded-2xl bg-white/80 text-[1rem] font-black text-[#050505]"
          >
            {copy.pricing.subscribeNow}
          </a>

          <div className="mt-8 rounded-[28px] bg-white p-6 text-left min-[900px]:p-9">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[1.15rem] font-black">{copy.pricing.subscription.name}</p>
              <Pill className="bg-[#050505] text-white">{copy.pricing.subscription.badge}</Pill>
            </div>
            <div className="mt-5 flex items-center gap-4 rounded-[20px] bg-[#fff8dc] px-5 py-4">
              <Emoji className="text-[2.4rem]">☕</Emoji>
              <div>
                <p className="text-[1.02rem] font-black leading-snug">{copy.pricing.subscription.espresso}</p>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className={cn(displayClass, "text-[2.3rem] leading-none")}>₩{price}</span>
                  <span className="text-[0.9rem] font-bold text-[#475569]">/ {copy.pricing.subscription.period}</span>
                </p>
              </div>
            </div>
            <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
              {copy.pricing.subscription.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-[1rem] font-bold">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#050505] text-[#f47a4a]">
                    <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-[28px] bg-white/90 p-6 text-left min-[900px]:p-9">
            <p className="text-[1rem] font-black">{copy.pricing.passes.title}</p>
            <ul className="m-0 mt-4 grid list-none gap-2 p-0 min-[600px]:grid-cols-3">
              {DAILY_PASSES.map((pass) => (
                <li key={pass.id} className="rounded-[18px] border border-[#e5e7eb] bg-white px-4 py-3.5">
                  <p className="text-[0.92rem] font-bold text-[#475569]">{pass.label}</p>
                  <p className="mt-1 text-[1.3rem] font-black">₩{formatKrw(pass.priceKrw)}</p>
                  <p className="text-[0.8rem] font-semibold text-[#64748b]">
                    {copy.pricing.passes.perMonth.replace("{price}", formatKrw(Math.round((pass.priceKrw * 30) / pass.days)))}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 text-[0.85rem] font-semibold text-[rgba(5,5,5,0.72)]">
            {copy.pricing.note}{" "}
            <a href={DAILY_TERMS_PATH} className="underline underline-offset-2">
              {copy.pricing.terms}
            </a>
          </p>
        </div>
      </Panel>

      {/* P12: FAQ */}
      <Panel id="faq">
        <h2 className={h2Class}>{copy.faq.title}</h2>
        <p className="mt-3 text-center text-[0.95rem] font-semibold text-[#475569] min-[900px]:text-left">
          {copy.faq.more}{" "}
          <a href={DAILY_GUIDE_PATH} className="font-extrabold text-[#050505] underline underline-offset-2">
            {copy.pricing.guide}
          </a>
          {copy.faq.moreSuffix}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {copy.faq.items.map((item) => (
            <details key={item.q} className="daily-faq group rounded-[20px] bg-[#f5f5f4] text-left">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[1.02rem] font-extrabold">
                {item.q}
                <PlusIcon className="daily-faq-icon size-5 shrink-0 transition-transform duration-200" aria-hidden />
              </summary>
              <p className="m-0 px-5 pb-5 text-[0.95rem] leading-[1.7] text-[#475569]">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-10 flex flex-wrap items-center justify-center gap-2 text-[0.85rem] font-semibold text-[#64748b]">
          <CupMark className="h-4 w-3" />
          {copy.operatedBy}
          <a href={DAILY_GUIDE_PATH} className="underline underline-offset-2">
            {copy.pricing.guide}
          </a>
          <a href={DAILY_TERMS_PATH} className="underline underline-offset-2">
            {copy.pricing.terms}
          </a>
        </p>
        <p className="mt-2 text-center text-[0.75rem] font-semibold text-[#94a3b8]">
          <a
            href="https://googlefonts.github.io/noto-emoji-animation/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {copy.emojiCredit}
          </a>
        </p>
      </Panel>

      <StickyBar visible={pastHero && !reachedPricing} />
    </div>
  );
}

// Approved reviews from verified customers, styled as social posts.
function ReviewsSection({ reviews }: { reviews: PublicDailyReview[] }) {
  const copy = dailyCopy.reviews;
  const trackTitle = (track: string) => dailyCopy.tracks.items.find((item) => item.key === track)?.title ?? "";
  return (
    <Panel inner="min-[900px]:max-w-[720px]">
      <h2 className={h2Class}>
        <Headline text={copy.title} accent={copy.accent} accentClassName="text-[#f47a4a]" />
      </h2>
      <ul className="m-0 mt-9 grid list-none gap-3 p-0 text-left min-[900px]:grid-cols-2">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-[24px] bg-[#f5f5f4] p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#050505] text-[0.9rem] font-black text-white">
                {(review.displayName ?? copy.anonymous).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95rem] font-black">{review.displayName ?? copy.anonymous}</p>
                <p className="text-[0.75rem] font-semibold text-[#64748b]">
                  {trackTitle(review.track)} · {copy.lessons.replace("{count}", String(review.lessonsReceived))}
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[0.7rem] font-bold text-[#475569]">
                <CheckBadgeIcon className="size-4 text-[#f47a4a]" aria-hidden />
                {copy.verified}
              </span>
            </div>
            <p className="mt-3 flex gap-0.5" aria-label={`별점 ${review.rating}점`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <StarIcon key={value} className={cn("size-4", value <= review.rating ? "text-[#f47a4a]" : "text-[#d6d3d1]")} aria-hidden />
              ))}
            </p>
            <p className="mt-2 text-[0.98rem] font-semibold leading-relaxed">{review.body}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// An example of the shared sentence wall on the lesson page (labelled as an example:
// the sentences, names and the count are illustrations, not real people's posts).
function SentenceWall() {
  const feed = dailyCopy.relatedness.feed;
  return (
    <div className="relative mx-auto w-full max-w-[340px] rounded-[28px] bg-white p-5 text-left text-[#050505] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)]">
      <span className="absolute right-4 top-4 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[0.7rem] font-bold text-[#64748b]">
        {feed.label}
      </span>
      <p className="text-[0.75rem] font-extrabold text-[#d95f2d]">{feed.heading}</p>
      <p className="text-[1.5rem] font-black leading-tight">{feed.expression}</p>
      <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#fff8dc] px-3 py-2 text-[0.78rem] font-bold text-[#475569]">
        <Emoji className="text-[1rem]">☕</Emoji>
        {feed.together}
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#e5e7eb] px-3 py-2">
        <span className="flex-1 text-[0.8rem] text-[#94a3b8]">{feed.prompt}</span>
        <span className="rounded-lg bg-[#050505] px-2.5 py-1 text-[0.72rem] font-black text-white">{feed.send}</span>
      </div>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {feed.sentences.map((sentence) => (
          <li
            key={sentence.text}
            className={cn("rounded-2xl px-3 py-2.5", sentence.pick ? "bg-[#fff1ea] ring-1 ring-[#f47a4a]/40" : "bg-[#f5f5f4]")}
          >
            <div className="flex items-center gap-2 text-[0.72rem] font-bold text-[#64748b]">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#050505] text-[0.6rem] font-black text-white">
                {sentence.initial}
              </span>
              {sentence.name}
              {sentence.pick && (
                <span className="ml-auto rounded-full bg-[#f47a4a] px-2 py-0.5 text-[0.65rem] font-black text-[#050505]">
                  {feed.pick}
                </span>
              )}
            </div>
            <p className="mt-1 text-[0.86rem] font-bold leading-snug">
              <Highlighted text={sentence.text} highlight={feed.expression} />
            </p>
            <p className="mt-1 text-right text-[0.72rem] font-bold text-[#64748b]">☕ {sentence.cups}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// An example of the progress view (labelled as an example; not anyone's real numbers).
function ProgressCard() {
  const card = dailyCopy.mastery.card;
  return (
    <div className="relative mx-auto w-full max-w-[300px] rounded-[28px] bg-[#050505] p-6 text-left text-white shadow-[0_24px_60px_-28px_rgba(5,5,5,0.6)]">
      <span className="absolute right-5 top-5 rounded-full bg-white/10 px-2.5 py-1 text-[0.7rem] font-bold text-white/70">
        {card.label}
      </span>
      <p className="flex items-center gap-2 text-[1.6rem] font-black">
        <Emoji className="text-[2rem]">🔥</Emoji>
        {card.streak}
      </p>
      <ol className="m-0 mt-4 flex list-none justify-between p-0">
        {card.days.map((day) => (
          <li key={day} className="flex flex-col items-center gap-1.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#f47a4a] text-[#050505]">
              <CheckIcon className="size-4" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-[0.72rem] font-bold text-white/60">{day}</span>
          </li>
        ))}
      </ol>
      <dl className="m-0 mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-4">
        {card.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-[0.9rem]">
            <dt className="font-semibold text-white/70">{row.label}</dt>
            <dd className="m-0 font-black">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Callout({ children, emoji, className }: { children: string; emoji: string; className: string }) {
  return (
    <span
      className={cn(
        "absolute z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#050505] px-3.5 py-2 text-[0.82rem] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(5,5,5,0.6)]",
        className,
      )}
    >
      <Emoji motion="none">{emoji}</Emoji>
      {children}
    </span>
  );
}

function ExpressionCard({ type, en, ko }: { type: string; en: string; ko: string }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useSeen(ref, 0.6);
  return (
    <li ref={ref} className="rounded-[24px] bg-[#f5f5f4] p-6">
      <Pill className="bg-white text-[#475569]">{type}</Pill>
      <p className="mt-5 text-[1.7rem] font-black leading-tight">
        <span className="daily-marker px-0.5" data-seen={seen}>
          {en}
        </span>
      </p>
      <p className="mt-2 text-[0.96rem] font-semibold text-[#475569]">{ko}</p>
    </li>
  );
}

function Highlighted({ text, highlight }: { text: string; highlight: string }) {
  const at = text.indexOf(highlight);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="rounded-md bg-[#f47a4a]/25 px-1 text-[#050505]">{highlight}</span>
      {text.slice(at + highlight.length)}
    </>
  );
}

function StickyBar({ visible }: { visible: boolean }) {
  const copy = dailyCopy.sticky;
  return (
    <div
      inert={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0" : "pointer-events-none translate-y-[120%]",
      )}
    >
      <div className="mx-auto flex max-w-[720px] items-center gap-3 rounded-[22px] bg-[#050505] py-2.5 pl-5 pr-2.5 text-white shadow-[0_18px_40px_-14px_rgba(5,5,5,0.6)]">
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-black">{copy.title}</p>
          <p className="truncate text-[0.78rem] font-semibold text-white/60">{copy.sub.replace("{price}", price)}</p>
        </div>
        <TrialButton label={copy.cta} tone="orange" className="min-h-[46px] shrink-0 px-4 text-[0.95rem]" />
      </div>
    </div>
  );
}
