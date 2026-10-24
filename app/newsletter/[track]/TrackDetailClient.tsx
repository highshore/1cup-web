"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";
import AuthorSection from "../../lib/features/newsletter/components/AuthorSection";
import PhoneFrame from "../../lib/features/newsletter/components/PhoneFrame";
import SpeakButton from "../../lib/features/newsletter/components/SpeakButton";
import TrackVisual from "../../lib/features/newsletter/components/TrackVisual";
import {
  AccentLines,
  BrandBar,
  Button,
  ButtonLink,
  cardClass,
  Chip,
  cn,
  Container,
  Page,
  Section,
  SectionHeader,
  SectionTitle,
  SmallText,
  SubTitle,
} from "../../lib/features/newsletter/components/NewsletterUI";
import {
  formatKrw,
  NEWSLETTER_MEMBER_PRICE_KRW,
  NEWSLETTER_MONTHLY_PRICE_KRW,
  NEWSLETTER_SUBSCRIPTIONS_OPEN,
  NewsletterTrack,
  trackCoverTheme,
} from "../../lib/features/newsletter/constants";
import { useInView, usePrefersReducedMotion, useSpeech } from "../../lib/features/newsletter/hooks";

const pillClass = "inline-flex items-center self-start whitespace-nowrap rounded-full px-[0.7rem] py-1 text-[0.82rem] font-extrabold";
const labelClass = "text-[0.78rem] font-black tracking-[0.02em] text-[#d95f2d]";
const outlineChipClass = "rounded-full border-2 border-[#050505] bg-white px-3 py-[0.3rem] text-[0.85rem] font-extrabold text-[#050505]";

function Highlighted({ text, highlight }: { text: string; highlight: string }) {
  const index = text.indexOf(highlight);
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{highlight}</mark>
      {text.slice(index + highlight.length)}
    </>
  );
}

export default function TrackDetailClient({ track }: { track: NewsletterTrack }) {
  const { t } = useI18n();
  const copy = t.newsletter.detail;
  const demo = t.newsletter.demo;
  const trackCopy = t.newsletter.tracks[track];
  const lesson = trackCopy.lesson;
  const theme = trackCoverTheme[track];
  const price = formatKrw(NEWSLETTER_MONTHLY_PRICE_KRW);
  const speech = useSpeech();
  const reduced = usePrefersReducedMotion();
  const compareRef = useRef<HTMLDivElement>(null);
  const compareInView = useInView(compareRef, 0.6);
  const [showAfter, setShowAfter] = useState(false);
  const [autoFlipped, setAutoFlipped] = useState(false);

  // Flip to "After" once when the comparison first comes into view.
  useEffect(() => {
    if (!compareInView || autoFlipped) return;
    if (reduced) {
      setAutoFlipped(true);
      return;
    }
    const timer = setTimeout(() => {
      setShowAfter(true);
      setAutoFlipped(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [compareInView, autoFlipped, reduced]);

  return (
    <Page>
      <BrandBar />

      <div className="border-b-2 border-[#050505]" style={{ background: theme.background, color: theme.foreground }}>
        <Container className="grid items-center gap-8 pt-10 pb-11 min-[900px]:grid-cols-2 min-[900px]:gap-12 min-[900px]:py-14">
          <div className="flex flex-col gap-2 max-[899px]:items-center max-[899px]:text-center">
            <p className="m-0 text-[0.82rem] font-black" style={{ color: theme.eyebrow }}>
              {t.newsletter.storefront.coverEyebrow}
            </p>
            <h1 className="m-0 font-['Noto_Sans_KR',sans-serif] text-[clamp(2.1rem,5vw,2.75rem)] font-black leading-[1.18] tracking-[0] text-inherit">
              {trackCopy.title}
            </h1>
            <p className="m-0 text-[clamp(0.98rem,1.5vw,1.08rem)] font-semibold leading-[1.6]" style={{ color: theme.tagline }}>
              {trackCopy.tagline}
            </p>
          </div>
          <div className="overflow-hidden rounded-[14px] border-2 border-[#050505] shadow-[6px_6px_0_rgba(5,5,5,0.88)]">
            <TrackVisual track={track} />
          </div>
        </Container>
      </div>

      <Section>
        <Container narrow>
          <div className={cn(cardClass, "flex flex-col gap-2 p-6")}>
            <SubTitle>
              {trackCopy.title} {copy.pricingSuffix}
            </SubTitle>
            <div className="flex items-baseline gap-[0.375rem]">
              <span className="text-[1.75rem] font-black text-[#050505]">
                {t.newsletter.price.amount.replace("{price}", price)}
              </span>
              <SmallText>{t.newsletter.price.perMonth}</SmallText>
            </div>
            <span className={cn(pillClass, "bg-[#fff8dc] text-[#d95f2d]")}>
              {t.newsletter.price.member.replace("{price}", formatKrw(NEWSLETTER_MEMBER_PRICE_KRW))}
            </span>
            <dl className="m-0 mt-3 grid grid-cols-[4.75rem_1fr] gap-3 border-t border-[rgba(5,5,5,0.12)] pt-4 text-[0.88rem] leading-[1.55]">
              {copy.facts.map((fact) => (
                <Fragment key={fact.label}>
                  <dt className="font-[650] text-[#64748b]">{fact.label}</dt>
                  <dd className="m-0 font-[760] text-[#050505]">{fact.value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container narrow>
          <SectionHeader>
            <Chip>{copy.painEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={trackCopy.painTitle} />
            </SectionTitle>
          </SectionHeader>
          <div className="flex flex-col items-start gap-3">
            {trackCopy.pains.map((pain) => (
              <p
                key={pain}
                className="m-0 max-w-[92%] rounded-[18px_18px_18px_4px] border-2 border-[#050505] bg-white px-[1.1rem] py-[0.85rem] text-[0.96rem] font-[650] leading-[1.55] text-[#050505]"
              >
                {pain}
              </p>
            ))}
          </div>
          <div className="mt-8 mb-5 flex justify-center">
            <svg viewBox="0 0 36 36" fill="none" aria-hidden className="size-9">
              <circle cx="18" cy="18" r="16" fill="#f47a4a" stroke="#050505" strokeWidth="2" />
              <path d="M18 10v15m0 0l-6-6m6 6l6-6" stroke="#050505" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <SubTitle className="mb-5 text-center">{copy.gainTitle}</SubTitle>
          <div className="flex flex-col items-end gap-3">
            {trackCopy.gains.map((gain) => (
              <p
                key={gain}
                className="m-0 max-w-[92%] rounded-[18px_18px_4px_18px] border-2 border-[#050505] bg-[#f47a4a] px-[1.1rem] py-[0.85rem] text-[0.96rem] font-[850] leading-[1.55] text-[#050505]"
              >
                {gain}
              </p>
            ))}
          </div>
        </Container>
      </Section>

      <AuthorSection />

      <Section tone="cream">
        <Container>
          <SectionHeader>
            <SectionTitle>
              <AccentLines text={copy.pillsTitle.replace("{track}", trackCopy.title)} />
            </SectionTitle>
          </SectionHeader>
          <ul className="m-0 grid list-none grid-cols-2 gap-[0.9rem] p-0 min-[769px]:grid-cols-4">
            {copy.pills.map((pill) => (
              <li key={pill.title} className={cn(cardClass, "flex flex-col gap-[0.3rem] p-[1.1rem] shadow-[4px_4px_0_#f47a4a]")}>
                <span className="text-[1.02rem] font-black text-[#050505]">{pill.title}</span>
                <SmallText>{pill.detail}</SmallText>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="sample" tone="surface">
        <Container>
          <SectionHeader>
            <Chip>{copy.lessonEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={copy.lessonTitle} />
            </SectionTitle>
          </SectionHeader>
          <div className="grid items-center gap-10 min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:gap-16">
            <div className="flex max-w-[30rem] flex-col gap-3 max-[899px]:mx-auto max-[899px]:text-center">
              <div className="flex flex-col gap-[0.4rem] rounded-2xl border-2 border-[#050505] bg-white px-[1.1rem] py-4 text-left shadow-[5px_5px_0_#f47a4a]">
                <div className="flex items-center gap-2 text-[0.82rem] font-extrabold text-[#050505]">
                  <span className="inline-flex size-7 items-center justify-center rounded-[9px] border-2 border-[#050505] bg-[#f47a4a] text-[0.8rem] font-black">
                    1
                  </span>
                  {t.newsletter.brand.name}
                  <span className={cn(pillClass, "bg-[#FEE500] text-[#050505]")}>{copy.kakaoTag}</span>
                  <span className="ml-auto font-[650] text-[#64748b]">{copy.kakaoTime}</span>
                </div>
                <p className="m-0 text-[0.94rem] font-bold leading-[1.55] text-[#0f172a]">
                  {copy.kakaoNotice}
                  <br />[{trackCopy.title}] {lesson.expression}
                </p>
              </div>
              <p className="m-0 mt-2 text-[1.05rem] font-black text-[#0f172a]">{demo.tapToListen}</p>
              <SmallText>{copy.audioNote}</SmallText>
            </div>
            <div className="flex justify-center">
              <PhoneFrame time="8:01" label={`${trackCopy.title}: ${lesson.expression}`}>
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-[1.1rem] pt-1 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="text-[0.72rem] font-extrabold text-[#64748b]">
                    {t.newsletter.brand.name} · {trackCopy.title}
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p lang="en" className="m-0 text-[1.45rem] font-black leading-[1.2] text-[#050505]">
                      {lesson.expression}
                    </p>
                    {speech.supported && (
                      <SpeakButton
                        active={speech.speakingText === lesson.expression}
                        label={speech.speakingText === lesson.expression ? demo.listening : demo.listen}
                        onClick={() => speech.speak(lesson.expression)}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={labelClass}>{copy.meaningLabel}</span>
                    <p className="m-0 text-[0.95rem] font-extrabold text-[#0f172a]">{lesson.meaning}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={labelClass}>{copy.nuanceLabel}</span>
                    <p className="m-0 rounded-xl bg-[#fff8dc] px-[0.8rem] py-[0.7rem] text-[0.8rem] font-[620] leading-[1.65] text-[#475569]">
                      {lesson.nuance}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={labelClass}>{copy.examplesLabel}</span>
                    <ol className="m-0 flex list-none flex-col gap-[0.85rem] p-0">
                      {lesson.examples.map((example, index) => (
                        <li key={example.en} className="grid grid-cols-[1.6rem_1fr]">
                          <span className="mt-[0.15rem] inline-flex size-[1.3rem] items-center justify-center rounded-full bg-[#050505] text-[0.72rem] font-black text-white">
                            {index + 1}
                          </span>
                          <button
                            type="button"
                            disabled={!speech.supported}
                            onClick={() => speech.speak(example.en)}
                            className={cn(
                              "-mt-[0.35rem] -ml-[0.4rem] flex w-full cursor-pointer flex-col gap-[0.15rem] rounded-[10px] border-0 px-[0.4rem] py-[0.35rem] text-left font-[inherit] [transition:background-color_150ms_ease] focus-visible:outline-3 focus-visible:outline-[rgba(244,122,74,0.45)] disabled:cursor-default",
                              speech.speakingText === example.en ? "bg-[#fff8dc]" : "bg-transparent",
                            )}
                          >
                            <span lang="en" className="text-[0.86rem] font-bold leading-[1.55] text-[#0f172a]">
                              {example.en}
                            </span>
                            <span lang="ko" className="text-[0.82rem] font-[580] leading-[1.6] text-[#64748b]">
                              {example.ko}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={labelClass}>{copy.similarLabel}</span>
                    <div className="flex flex-wrap gap-2">
                      {lesson.similar.map((item) => (
                        <span key={item} lang="en" className={outlineChipClass}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </PhoneFrame>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container narrow>
          <SectionHeader>
            <Chip>{copy.notBasicEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={copy.notBasicTitle} />
            </SectionTitle>
          </SectionHeader>
          <div className="flex flex-col gap-[0.9rem]">
            {trackCopy.notBasic.map((item) => (
              <div key={item.en} className={cn(cardClass, "flex flex-col gap-[0.35rem] px-5 py-[1.1rem] shadow-[4px_4px_0_rgba(5,5,5,0.88)]")}>
                <span className={cn(pillClass, "bg-[#fff8dc] text-[#d95f2d]")}>{item.type}</span>
                <span lang="en" className="text-[1.2rem] font-black text-[#050505]">
                  {item.en}
                </span>
                <SmallText className="text-[#475569]">{item.ko}</SmallText>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container narrow>
          <SectionHeader>
            <Chip>{copy.beforeAfterEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={copy.beforeAfterTitle} />
            </SectionTitle>
          </SectionHeader>
          <div
            ref={compareRef}
            role="group"
            aria-label={copy.beforeAfterEyebrow}
            className="mb-5 flex w-fit rounded-full border-2 border-[#050505] bg-white p-[3px] shadow-[4px_4px_0_#f47a4a] max-[768px]:mx-auto"
          >
            {([false, true] as const).map((after) => (
              <button
                key={String(after)}
                type="button"
                aria-pressed={showAfter === after}
                onClick={() => setShowAfter(after)}
                className={cn(
                  "min-w-24 cursor-pointer rounded-full border-0 px-[1.1rem] py-2 font-[inherit] text-[0.9rem] font-extrabold [transition:background-color_240ms_cubic-bezier(0.23,1,0.32,1),color_240ms_ease] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(244,122,74,0.45)]",
                  showAfter === after ? "bg-[#050505] text-white" : "bg-transparent text-[#475569]",
                )}
              >
                {after ? copy.afterLabel : copy.beforeLabel}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-[0.9rem]">
            {trackCopy.beforeAfter.map((pair) => (
              <div
                key={pair.after}
                className={cn(
                  cardClass,
                  "flex min-h-[76px] items-center px-5 py-[1.1rem] [transition:box-shadow_240ms_ease]",
                  showAfter && "shadow-[5px_5px_0_#f47a4a]",
                )}
              >
                {showAfter ? (
                  <span key="after" lang="en" className="nl-swap nl-mark text-base font-extrabold leading-[1.5] text-[#050505]">
                    <Highlighted text={pair.after} highlight={pair.highlight} />
                  </span>
                ) : (
                  <span key="before" lang="en" className="nl-swap text-[0.94rem] font-semibold leading-[1.5] text-[#64748b]">
                    {pair.before}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container narrow>
          <SectionHeader>
            <SectionTitle>{copy.scenesTitle}</SectionTitle>
          </SectionHeader>
          <div className="flex flex-wrap gap-2 max-[768px]:justify-center">
            {trackCopy.scenes.map((scene) => (
              <span key={scene} className={outlineChipClass}>
                {scene}
              </span>
            ))}
          </div>

          <div className="mt-10">
            <SectionHeader>
              <SectionTitle>{copy.whoTitle}</SectionTitle>
            </SectionHeader>
            <ul className="m-0 flex list-none flex-col gap-[0.55rem] p-0">
              {trackCopy.whoFor.map((line) => (
                <li key={line} className="flex gap-2 text-[0.96rem] font-bold leading-[1.55] text-[rgba(5,5,5,0.76)]">
                  <CheckBadgeIcon aria-hidden className="mt-[0.12rem] size-5 shrink-0 text-[#050505]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10">
            <SectionHeader>
              <SectionTitle>{copy.reviewsTitle}</SectionTitle>
            </SectionHeader>
            <SmallText className="max-[768px]:text-center">{copy.reviewsEmpty}</SmallText>
          </div>
        </Container>
      </Section>

      {/* Sticky (not fixed) so it stops above the global footer. */}
      <div className="sticky bottom-0 z-10 border-t-2 border-[#050505] bg-white pt-[0.85rem] pb-[calc(0.85rem+env(safe-area-inset-bottom))]">
        <Container narrow className="flex gap-3">
          {NEWSLETTER_SUBSCRIPTIONS_OPEN ? (
            <>
              <ButtonLink variant="outline" className="flex-none" href={`/newsletter/checkout?track=${track}&gift=1`}>
                {copy.gift}
              </ButtonLink>
              <ButtonLink variant="orange" className="flex-1" href={`/newsletter/checkout?track=${track}`}>
                {copy.subscribe.replace("{price}", price)}
              </ButtonLink>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-none" type="button" disabled>
                {copy.gift}
              </Button>
              <Button variant="orange" className="flex-1" type="button" disabled>
                {copy.comingSoon}
              </Button>
            </>
          )}
        </Container>
      </div>
    </Page>
  );
}
