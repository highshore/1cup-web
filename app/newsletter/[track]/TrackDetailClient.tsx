"use client";

import { Fragment } from "react";
import styled from "styled-components";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  BrandBar,
  Card,
  Chip,
  Container,
  DarkButton,
  DarkLink,
  Page,
  PrimaryButton,
  PrimaryLink,
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
  newsletterColors as c,
  NewsletterTrack,
  trackCoverTheme,
} from "../../lib/features/newsletter/constants";

const Cover = styled.div<{ $background: string; $foreground: string }>`
  border-bottom: 2px solid ${c.ink};
  background: ${(props) => props.$background};
  color: ${(props) => props.$foreground};
`;

const CoverInner = styled(Container)`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.5rem;
  min-height: 240px;
  padding-top: 2rem;
  padding-bottom: 2rem;

  @media (max-width: 768px) {
    align-items: center;
    text-align: center;
  }
`;

const CoverEyebrow = styled.p<{ $color: string }>`
  margin: 0;
  font-size: 0.82rem;
  font-weight: 900;
  color: ${(props) => props.$color};
`;

const CoverTitle = styled.h1`
  margin: 0;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(2.1rem, 5vw, 2.75rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
  color: inherit;
`;

const CoverTagline = styled.p<{ $color: string }>`
  margin: 0;
  font-size: clamp(0.98rem, 1.5vw, 1.08rem);
  font-weight: 600;
  line-height: 1.6;
  color: ${(props) => props.$color};
`;

const PriceCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.5rem;
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
`;

const Price = styled.span`
  font-size: 1.75rem;
  font-weight: 900;
  color: ${c.ink};
`;

const MemberPrice = styled.span`
  align-self: flex-start;
  border-radius: 999px;
  background: ${c.cream};
  padding: 0.25rem 0.7rem;
  font-size: 0.88rem;
  font-weight: 800;
  color: ${c.orangeText};
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: 4.75rem 1fr;
  gap: 0.75rem;
  margin: 0.75rem 0 0;
  padding-top: 1rem;
  border-top: 1px solid rgba(5, 5, 5, 0.12);
  font-size: 0.88rem;
  line-height: 1.55;

  dt {
    font-weight: 650;
    color: ${c.muted};
  }

  dd {
    margin: 0;
    font-weight: 760;
    color: ${c.ink};
  }
`;

const Points = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    gap: 0.5rem;
    font-size: 0.96rem;
    font-weight: 700;
    line-height: 1.55;
    color: rgba(5, 5, 5, 0.76);
  }

  svg {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 0.12rem;
    color: ${c.ink};
  }
`;

const SampleCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.5rem;
  box-shadow: 5px 5px 0 ${c.orange};
`;

const SampleCounter = styled.p`
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  color: ${c.muted};
`;

const Expression = styled.p`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 900;
  color: ${c.ink};
`;

const Meaning = styled.p`
  margin: 0 0 0.75rem;
  font-size: 0.96rem;
  font-weight: 800;
  color: ${c.orangeText};
`;

const Example = styled.p`
  margin: 0;
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.6;
  color: ${c.heading};
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
`;

// Sticky (not fixed) so it stops above the global footer.
const ActionBar = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 10;
  border-top: 2px solid ${c.ink};
  background: #ffffff;
  padding: 0.85rem 0 calc(0.85rem + env(safe-area-inset-bottom));
`;

const ActionRow = styled(Container)`
  display: flex;
  gap: 0.75rem;

  & > :first-child {
    flex: 0 0 auto;
  }

  & > :last-child {
    flex: 1;
  }
`;

export default function TrackDetailClient({
  track,
}: {
  track: NewsletterTrack;
}) {
  const { t } = useI18n();
  const copy = t.newsletter.detail;
  const trackCopy = t.newsletter.tracks[track];
  const theme = trackCoverTheme[track];
  const price = formatKrw(NEWSLETTER_MONTHLY_PRICE_KRW);

  return (
    <Page>
      <BrandBar />

      <Cover $background={theme.background} $foreground={theme.foreground}>
        <CoverInner $narrow>
          <CoverEyebrow $color={theme.eyebrow}>
            {t.newsletter.storefront.coverEyebrow}
          </CoverEyebrow>
          <CoverTitle>{trackCopy.title}</CoverTitle>
          <CoverTagline $color={theme.tagline}>{trackCopy.tagline}</CoverTagline>
        </CoverInner>
      </Cover>

      <Section>
        <Container $narrow>
          <Stack>
            <PriceCard>
              <SubTitle>
                {trackCopy.title} {copy.pricingSuffix}
              </SubTitle>
              <PriceRow>
                <Price>{t.newsletter.price.amount.replace("{price}", price)}</Price>
                <SmallText>{t.newsletter.price.perMonth}</SmallText>
              </PriceRow>
              <MemberPrice>
                {t.newsletter.price.member.replace(
                  "{price}",
                  formatKrw(NEWSLETTER_MEMBER_PRICE_KRW),
                )}
              </MemberPrice>
              <Facts>
                {copy.facts.map((fact) => (
                  <Fragment key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </Fragment>
                ))}
              </Facts>
            </PriceCard>

            <div>
              <SectionHeader>
                <SectionTitle>{copy.whoTitle}</SectionTitle>
              </SectionHeader>
              <Points>
                {trackCopy.whoFor.map((line) => (
                  <li key={line}>
                    <CheckBadgeIcon aria-hidden />
                    {line}
                  </li>
                ))}
              </Points>
            </div>
          </Stack>
        </Container>
      </Section>

      <Section id="sample" $background={c.surface}>
        <Container $narrow>
          <SectionHeader>
            <Chip>{copy.sampleEyebrow}</Chip>
            <SectionTitle>{copy.sampleTitle}</SectionTitle>
          </SectionHeader>
          <SampleCard>
            <SampleCounter>{copy.sampleCounter}</SampleCounter>
            <Expression lang="en">{trackCopy.sample.expression}</Expression>
            <Meaning>{trackCopy.sample.meaning}</Meaning>
            <Example lang="en">{trackCopy.sample.exampleEn}</Example>
            <SmallText lang="ko">{trackCopy.sample.exampleKo}</SmallText>
          </SampleCard>
        </Container>
      </Section>

      <Section>
        <Container $narrow>
          <SectionHeader>
            <SectionTitle>{copy.reviewsTitle}</SectionTitle>
          </SectionHeader>
          <SmallText>{copy.reviewsEmpty}</SmallText>
        </Container>
      </Section>

      <ActionBar>
        <ActionRow $narrow>
          {NEWSLETTER_SUBSCRIPTIONS_OPEN ? (
            <>
              <PrimaryLink href={`/newsletter/checkout?track=${track}&gift=1`}>
                {copy.gift}
              </PrimaryLink>
              <DarkLink href={`/newsletter/checkout?track=${track}`}>
                {copy.subscribe.replace("{price}", price)}
              </DarkLink>
            </>
          ) : (
            <>
              <PrimaryButton type="button" disabled>
                {copy.gift}
              </PrimaryButton>
              <DarkButton type="button" disabled>
                {copy.comingSoon}
              </DarkButton>
            </>
          )}
        </ActionRow>
      </ActionBar>
    </Page>
  );
}
