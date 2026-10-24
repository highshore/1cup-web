"use client";

import styled from "styled-components";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import TrackCard from "../lib/features/newsletter/components/TrackCard";
import {
  BrandBar,
  cardStyles,
  Chip,
  Container,
  Description,
  GhostLink,
  Page,
  PrimaryLink,
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
  newsletterColors as c,
} from "../lib/features/newsletter/constants";

const Hero = styled.section`
  background: #000000;
  color: #ffffff;
  padding: clamp(4rem, 9vw, 6.5rem) 0;
`;

const HeroInner = styled(Container)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  @media (max-width: 768px) {
    align-items: center;
    text-align: center;
  }
`;

const HeroTitle = styled.h1`
  margin: 0;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(2.1rem, 5vw, 3.1rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
  color: #ffffff;
`;

const HeroAccent = styled.span`
  color: ${c.orange};
`;

const HeroDescription = styled.p`
  max-width: 28rem;
  margin: 1.2rem 0 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: clamp(0.98rem, 1.5vw, 1.08rem);
  font-weight: 560;
  line-height: 1.65;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 2rem;

  @media (max-width: 768px) {
    flex-direction: column;
    align-self: stretch;
  }
`;

const Notice = styled.div`
  border-bottom: 2px solid ${c.ink};
  background: ${c.cream};
  padding: 1rem 0;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const NoticeTitle = styled.p`
  margin: 0 0 0.25rem;
  font-size: 0.96rem;
  font-weight: 900;
  color: ${c.ink};
`;

const TrackGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
`;

const Steps = styled.ol`
  display: grid;
  gap: 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (min-width: 769px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Step = styled.li`
  ${cardStyles}
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
`;

const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 2px solid ${c.ink};
  border-radius: 50%;
  background: ${c.orange};
  color: ${c.ink};
  font-size: 0.96rem;
  font-weight: 900;
`;

const StepTitle = styled.p`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1.4;
  color: ${c.heading};
`;

const StepNote = styled(SmallText)`
  margin-top: 1.5rem;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

// Same treatment as the production stats card (orange, ink border, ink shadow).
const MemberCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  border: 2px solid ${c.ink};
  border-radius: 1.2rem;
  background: ${c.orange};
  color: ${c.ink};
  padding: 2.4rem 1.4rem;
  box-shadow: 7px 7px 0 ${c.ink};
  text-align: center;

  @media (min-width: 900px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 2.25rem;
    padding: 2.75rem 3rem;
    text-align: left;
  }
`;

const MemberEyebrow = styled.p`
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  font-weight: 900;
`;

const MemberTitle = styled.h2`
  margin: 0;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(1.45rem, 2.4vw, 1.85rem);
  font-weight: 900;
  line-height: 1.2;
  color: ${c.ink};
`;

const MemberDescription = styled.p`
  max-width: 30rem;
  margin: 0.75rem 0 0;
  font-size: 0.96rem;
  font-weight: 650;
  line-height: 1.6;
  color: rgba(5, 5, 5, 0.78);
`;

const MemberCta = styled(PrimaryLink)`
  flex-shrink: 0;
  align-self: center;
  box-shadow: 4px 4px 0 ${c.ink};

  @media (hover: hover) {
    &:hover:not(:disabled) {
      box-shadow: 6px 6px 0 ${c.ink};
    }
  }
`;

const MemberEligible = styled.p`
  flex-shrink: 0;
  margin: 0;
  max-width: 16rem;
  font-size: 0.96rem;
  font-weight: 900;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 2.25rem 1.5rem;
  border: 1px solid ${c.line};
  border-radius: 16px;
  background: #ffffff;
  text-align: center;
`;

const EmptyTitle = styled.p`
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: ${c.heading};
`;

// Follows the reviews section on the same background, so skip the doubled top padding.
const FaqSection = styled(Section)`
  padding-top: 0;
`;

const FaqList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

// Matches the production FAQ (app/new-home/sections/FaqSection.tsx), using <details>.
const FaqItem = styled.details`
  overflow: hidden;
  border: 1px solid ${c.line};
  border-radius: 16px;
  background: #ffffff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: ${c.ink};
    box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.5rem;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.5;
    color: #1f2937;
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary span {
    flex-shrink: 0;
    font-size: 1.4rem;
    font-weight: 400;
    color: ${c.ink};
    transition: transform 0.25s ease;
  }

  &[open] summary span {
    transform: rotate(45deg);
  }

  p {
    margin: 0;
    padding: 0 1.5rem 1.5rem;
    font-size: 0.95rem;
    line-height: 1.7;
    color: #6b7280;
  }

  @media (max-width: 768px) {
    summary {
      padding: 1.2rem;
      font-size: 0.95rem;
    }

    p {
      padding: 0 1.2rem 1.2rem;
      font-size: 0.9rem;
    }
  }
`;

const OperatedBy = styled(SmallText)`
  margin-top: 2rem;
  text-align: center;
`;

export default function NewsletterClient() {
  const { t, locale } = useI18n();
  const { currentUser, hasActiveSubscription } = useAuth();
  const copy = t.newsletter.storefront;
  const price = formatKrw(NEWSLETTER_MONTHLY_PRICE_KRW);
  const titleLines = copy.title.split("\n");

  const launchEndsAt = NEWSLETTER_LAUNCH_DISCOUNT_ENDS_AT;
  const showLaunchNotice =
    launchEndsAt !== null && launchEndsAt.getTime() > Date.now();

  return (
    <Page>
      <BrandBar />

      <Hero>
        <HeroInner>
          <Chip>{copy.eyebrow}</Chip>
          <HeroTitle>
            {titleLines.map((line, index) =>
              index === titleLines.length - 1 ? (
                <HeroAccent key={line}>{line}</HeroAccent>
              ) : (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ),
            )}
          </HeroTitle>
          <HeroDescription>{copy.description}</HeroDescription>
          <Actions>
            <PrimaryLink href="#tracks">{copy.chooseTrack}</PrimaryLink>
            <GhostLink href="/newsletter/business#sample">
              {copy.viewSample}
            </GhostLink>
          </Actions>
        </HeroInner>
      </Hero>

      {showLaunchNotice && launchEndsAt && (
        <Notice>
          <Container>
            <NoticeTitle>
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
            </NoticeTitle>
            <SmallText $color={c.body}>{copy.launchNoticeDetail}</SmallText>
          </Container>
        </Notice>
      )}

      <Section id="tracks">
        <Container>
          <SectionHeader>
            <Chip>{copy.tracksEyebrow}</Chip>
            <SectionTitle>{copy.tracksTitle}</SectionTitle>
            <Description>{copy.tracksDescription}</Description>
          </SectionHeader>
          <TrackGrid>
            {NEWSLETTER_TRACKS.map((track) => (
              <TrackCard key={track} track={track} />
            ))}
          </TrackGrid>
        </Container>
      </Section>

      <Section $background={c.surface}>
        <Container>
          <SectionHeader>
            <Chip>{copy.howEyebrow}</Chip>
            <SectionTitle>{copy.howTitle}</SectionTitle>
          </SectionHeader>
          <Steps>
            {copy.howSteps.map((step, index) => (
              <Step key={step.title}>
                <StepNumber>{index + 1}</StepNumber>
                <StepTitle>{step.title}</StepTitle>
                <SmallText>{step.description.replace("{price}", price)}</SmallText>
              </Step>
            ))}
          </Steps>
          <StepNote>{copy.howNote}</StepNote>
        </Container>
      </Section>

      <Section>
        <Container>
          <MemberCard>
            <div>
              <MemberEyebrow>{copy.memberEyebrow}</MemberEyebrow>
              <MemberTitle>{copy.memberTitle}</MemberTitle>
              <MemberDescription>{copy.memberDescription}</MemberDescription>
            </div>
            {!currentUser ? (
              <MemberCta
                href={`/auth?redirect=${encodeURIComponent("/newsletter")}`}
              >
                {copy.memberLogin}
              </MemberCta>
            ) : hasActiveSubscription ? (
              <MemberEligible>{copy.memberEligible}</MemberEligible>
            ) : (
              <MemberCta href="/payment">{copy.memberJoin}</MemberCta>
            )}
          </MemberCard>
        </Container>
      </Section>

      <Section $background={c.surfaceAlt}>
        <Container>
          <SectionHeader>
            <SectionTitle>{copy.reviewsTitle}</SectionTitle>
          </SectionHeader>
          <EmptyState>
            <EmptyTitle>{copy.reviewsEmptyTitle}</EmptyTitle>
            <SmallText>{copy.reviewsEmptyDescription}</SmallText>
          </EmptyState>
        </Container>
      </Section>

      <FaqSection $background={c.surfaceAlt}>
        <Container>
          <SectionHeader>
            <SectionTitle>{copy.faqTitle}</SectionTitle>
          </SectionHeader>
          <FaqList>
            {copy.faq.map((item) => (
              <FaqItem key={item.q}>
                <summary>
                  {item.q}
                  <span aria-hidden>+</span>
                </summary>
                <p>{item.a}</p>
              </FaqItem>
            ))}
          </FaqList>
          <OperatedBy>{t.newsletter.brand.operatedBy}</OperatedBy>
        </Container>
      </FaqSection>
    </Page>
  );
}
