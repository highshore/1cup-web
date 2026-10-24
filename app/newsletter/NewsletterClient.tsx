"use client";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import AuthorSection from "../lib/features/newsletter/components/AuthorSection";
import ExpressionMarquee from "../lib/features/newsletter/components/ExpressionMarquee";
import KakaoDemo from "../lib/features/newsletter/components/KakaoDemo";
import LoopVideo from "../lib/features/newsletter/components/LoopVideo";
import TrackCard from "../lib/features/newsletter/components/TrackCard";
import {
  AccentLines,
  BrandBar,
  ButtonLink,
  cardClass,
  Chip,
  cn,
  Container,
  Description,
  Page,
  Section,
  SectionHeader,
  SectionTitle,
  SmallText,
} from "../lib/features/newsletter/components/NewsletterUI";
import {
  formatKrw,
  NEWSLETTER_LAUNCH_DISCOUNT_ENDS_AT,
  NEWSLETTER_MONTHLY_PRICE_KRW,
  NEWSLETTER_TRACKS,
} from "../lib/features/newsletter/constants";

const memberCtaClass =
  "shrink-0 self-center shadow-[4px_4px_0_#050505] [@media(hover:hover)]:hover:shadow-[6px_6px_0_#050505]";

export default function NewsletterClient() {
  const { t, locale } = useI18n();
  const { currentUser, hasActiveSubscription } = useAuth();
  const copy = t.newsletter.storefront;
  const price = formatKrw(NEWSLETTER_MONTHLY_PRICE_KRW);

  const launchEndsAt = NEWSLETTER_LAUNCH_DISCOUNT_ENDS_AT;
  const showLaunchNotice = launchEndsAt !== null && launchEndsAt.getTime() > Date.now();

  return (
    <Page>
      <BrandBar />

      <section className="border-b-2 border-[#050505] bg-[#fff8dc] py-[clamp(4rem,9vw,6.5rem)] text-[#0f172a]">
        <Container className="grid items-center gap-12 min-[900px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="flex flex-col items-start max-[899px]:items-center max-[899px]:text-center">
            <Chip>{copy.eyebrow}</Chip>
            <h1 className="m-0 font-['Noto_Sans_KR',sans-serif] text-[clamp(2.1rem,5vw,3.1rem)] font-black leading-[1.18] tracking-[0] text-[#0f172a]">
              <AccentLines text={copy.title} />
            </h1>
            <p className="m-0 mt-[1.2rem] max-w-[28rem] text-[clamp(0.98rem,1.5vw,1.08rem)] font-[560] leading-[1.65] text-[#475569]">
              {copy.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-[0.9rem] max-[899px]:flex-col max-[899px]:self-stretch">
              <ButtonLink variant="primary" href="#tracks">
                {copy.chooseTrack}
              </ButtonLink>
              <ButtonLink variant="outline" href="/newsletter/business#sample">
                {copy.viewSample}
              </ButtonLink>
            </div>
          </div>
          <div className="flex justify-center">
            <KakaoDemo />
          </div>
        </Container>
      </section>

      {showLaunchNotice && launchEndsAt && (
        <div className="border-b-2 border-[#050505] bg-[#fff8dc] py-4 max-[768px]:text-center">
          <Container>
            <p className="m-0 mb-1 text-[0.96rem] font-black text-[#050505]">
              {copy.launchNotice.replace(
                "{deadline}",
                launchEndsAt.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Seoul",
                }),
              )}
            </p>
            <SmallText className="text-[#475569]">{copy.launchNoticeDetail}</SmallText>
          </Container>
        </div>
      )}

      <Section>
        <Container className="grid items-center gap-8 min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] min-[900px]:gap-14">
          <div className="aspect-[16/10] overflow-hidden rounded-[14px] border-2 border-[#050505] bg-[#f3f3f1] shadow-[6px_6px_0_#f47a4a]">
            <LoopVideo src="/assets/newsletter/coffee-loop.mp4" poster="/assets/newsletter/coffee-poster.jpg" />
          </div>
          <div className="flex flex-col items-start max-[899px]:items-center max-[899px]:text-center">
            <Chip>{copy.coffeeEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={copy.coffeeTitle} />
            </SectionTitle>
            <Description>{copy.coffeeDescription}</Description>
          </div>
        </Container>
      </Section>

      <Section id="tracks" tone="surface">
        <Container>
          <SectionHeader>
            <Chip>{copy.tracksEyebrow}</Chip>
            <SectionTitle>{copy.tracksTitle}</SectionTitle>
            <Description>{copy.tracksDescription}</Description>
          </SectionHeader>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
            {NEWSLETTER_TRACKS.map((track) => (
              <TrackCard key={track} track={track} />
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="mb-7 flex flex-col items-center text-center">
          <Chip>{copy.marqueeEyebrow}</Chip>
          <SectionTitle>
            <AccentLines text={copy.marqueeTitle} />
          </SectionTitle>
        </Container>
        <ExpressionMarquee />
      </Section>

      <AuthorSection tone="cream" />

      <Section tone="surface">
        <Container>
          <SectionHeader>
            <Chip>{copy.howEyebrow}</Chip>
            <SectionTitle>{copy.howTitle}</SectionTitle>
          </SectionHeader>
          <ol className="m-0 grid list-none gap-5 p-0 min-[769px]:grid-cols-3">
            {copy.howSteps.map((step, index) => (
              <li key={step.title} className={cn(cardClass, "flex flex-col gap-3 p-5")}>
                <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-[#050505] bg-[#f47a4a] text-[0.96rem] font-black text-[#050505]">
                  {index + 1}
                </span>
                <p className="m-0 text-[1.05rem] font-black leading-[1.4] text-[#0f172a]">{step.title}</p>
                <SmallText>{step.description.replace("{price}", price)}</SmallText>
              </li>
            ))}
          </ol>
          <SmallText className="mt-6 max-[768px]:text-center">{copy.howNote}</SmallText>
        </Container>
      </Section>

      <Section>
        <Container>
          {/* Same treatment as the production stats card (orange, ink border, ink shadow). */}
          <div className="flex flex-col gap-5 rounded-[1.2rem] border-2 border-[#050505] bg-[#f47a4a] px-[1.4rem] py-[2.4rem] text-center text-[#050505] shadow-[7px_7px_0_#050505] min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:gap-9 min-[900px]:px-12 min-[900px]:py-11 min-[900px]:text-left">
            <div>
              <p className="m-0 mb-2 text-[0.82rem] font-black">{copy.memberEyebrow}</p>
              <h2 className="m-0 font-['Noto_Sans_KR',sans-serif] text-[clamp(1.45rem,2.4vw,1.85rem)] font-black leading-[1.2] text-[#050505]">
                {copy.memberTitle}
              </h2>
              <p className="m-0 mt-3 max-w-[30rem] text-[0.96rem] font-[650] leading-[1.6] text-[rgba(5,5,5,0.78)]">
                {copy.memberDescription}
              </p>
            </div>
            {!currentUser ? (
              <ButtonLink
                variant="primary"
                className={memberCtaClass}
                href={`/auth?redirect=${encodeURIComponent("/newsletter")}`}
              >
                {copy.memberLogin}
              </ButtonLink>
            ) : hasActiveSubscription ? (
              <p className="m-0 max-w-[16rem] shrink-0 text-[0.96rem] font-black">{copy.memberEligible}</p>
            ) : (
              <ButtonLink variant="primary" className={memberCtaClass} href="/payment">
                {copy.memberJoin}
              </ButtonLink>
            )}
          </div>
        </Container>
      </Section>

      <Section tone="surfaceAlt">
        <Container>
          <SectionHeader>
            <SectionTitle>{copy.reviewsTitle}</SectionTitle>
          </SectionHeader>
          <div className="flex flex-col items-center gap-[0.375rem] rounded-2xl border border-[#e5e7eb] bg-white px-6 py-9 text-center">
            <p className="m-0 text-base font-extrabold text-[#0f172a]">{copy.reviewsEmptyTitle}</p>
            <SmallText>{copy.reviewsEmptyDescription}</SmallText>
          </div>
        </Container>
      </Section>

      {/* Follows the reviews section on the same background, so skip the doubled top padding. */}
      <Section tone="surfaceAlt" className="pt-0">
        <Container>
          <SectionHeader>
            <SectionTitle>{copy.faqTitle}</SectionTitle>
          </SectionHeader>
          {/* Matches the production FAQ (app/new-home/sections/FaqSection.tsx), using <details>. */}
          <div className="flex flex-col gap-[1.2rem]">
            {copy.faq.map((item) => (
              <details
                key={item.q}
                className="nl-faq overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white [transition:border-color_0.2s_ease,box-shadow_0.2s_ease] hover:border-[#050505] hover:shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 text-[1.05rem] font-semibold leading-[1.5] text-[#1f2937] max-[768px]:p-[1.2rem] max-[768px]:text-[0.95rem]">
                  {item.q}
                  <span aria-hidden className="nl-faq-plus shrink-0 text-[1.4rem] font-normal text-[#050505] [transition:transform_0.25s_ease]">
                    +
                  </span>
                </summary>
                <p className="m-0 px-6 pb-6 text-[0.95rem] leading-[1.7] text-[#6b7280] max-[768px]:px-[1.2rem] max-[768px]:pb-[1.2rem] max-[768px]:text-[0.9rem]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
          <SmallText className="mt-8 text-center">{t.newsletter.brand.operatedBy}</SmallText>
        </Container>
      </Section>
    </Page>
  );
}
