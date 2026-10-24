"use client";

import { Fragment } from "react";
import styled from "styled-components";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";
import AuthorSection from "../../lib/features/newsletter/components/AuthorSection";
import {
  AccentLines,
  BrandBar,
  Card,
  cardStyles,
  Chip,
  Container,
  OrangeButton,
  OrangeLink,
  OutlineButton,
  OutlineLink,
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
  newsletterColors as c,
  NewsletterTrack,
  trackCoverTheme,
} from "../../lib/features/newsletter/constants";

const KAKAO_YELLOW = "#FEE500";

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

const Pill = styled.span<{ $background?: string; $color?: string }>`
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  border-radius: 999px;
  background: ${(props) => props.$background ?? c.cream};
  padding: 0.25rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 800;
  color: ${(props) => props.$color ?? c.orangeText};
  white-space: nowrap;
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

const Bubbles = styled.div<{ $align: "start" | "end" }>`
  display: flex;
  flex-direction: column;
  align-items: ${(props) => (props.$align === "end" ? "flex-end" : "flex-start")};
  gap: 0.75rem;
`;

const Bubble = styled.p<{ $tone: "pain" | "gain" }>`
  max-width: 92%;
  margin: 0;
  border: 2px solid ${c.ink};
  border-radius: ${(props) =>
    props.$tone === "gain" ? "18px 18px 4px 18px" : "18px 18px 18px 4px"};
  background: ${(props) => (props.$tone === "gain" ? c.orange : "#ffffff")};
  padding: 0.85rem 1.1rem;
  font-size: 0.96rem;
  font-weight: ${(props) => (props.$tone === "gain" ? 850 : 650)};
  line-height: 1.55;
  color: ${c.ink};
`;

const Arrow = styled.div`
  display: flex;
  justify-content: center;
  margin: 2rem 0 1.25rem;

  svg {
    width: 36px;
    height: 36px;
  }
`;

const GainTitle = styled(SubTitle)`
  margin-bottom: 1.25rem;
  text-align: center;
`;

const PillGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.9rem;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (min-width: 769px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const PillCard = styled.li`
  ${cardStyles}
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 1.1rem;
  box-shadow: 4px 4px 0 ${c.orange};
`;

const PillTitle = styled.span`
  font-size: 1.02rem;
  font-weight: 900;
  color: ${c.ink};
`;

const KakaoCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
  border: 2px solid ${c.ink};
  border-radius: 16px;
  background: #ffffff;
  padding: 1rem 1.1rem;
`;

const KakaoHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 800;
  color: ${c.ink};
`;

const KakaoAvatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 2px solid ${c.ink};
  border-radius: 9px;
  background: ${c.orange};
  font-size: 0.8rem;
  font-weight: 900;
`;

const KakaoTime = styled.span`
  margin-left: auto;
  font-weight: 650;
  color: ${c.muted};
`;

const KakaoBody = styled.p`
  margin: 0;
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.55;
  color: ${c.heading};
`;

const LessonCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  box-shadow: 5px 5px 0 ${c.orange};
`;

const Expression = styled.p`
  margin: 0;
  font-size: 1.75rem;
  font-weight: 900;
  line-height: 1.2;
  color: ${c.ink};
`;

const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.span`
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: ${c.orangeText};
`;

const Meaning = styled.p`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: ${c.heading};
`;

const Nuance = styled.p`
  margin: 0;
  border-radius: 12px;
  background: ${c.cream};
  padding: 0.85rem 1rem;
  font-size: 0.92rem;
  font-weight: 620;
  line-height: 1.65;
  color: ${c.body};
`;

const Examples = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: example;

  li {
    display: grid;
    grid-template-columns: 1.6rem 1fr;
    counter-increment: example;
  }

  li::before {
    content: counter(example);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.3rem;
    height: 1.3rem;
    margin-top: 0.15rem;
    border-radius: 50%;
    background: ${c.ink};
    color: #ffffff;
    font-size: 0.72rem;
    font-weight: 900;
  }
`;

const ExampleEn = styled.p`
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.55;
  color: ${c.heading};
`;

const ChipRow = styled.div<{ $center?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  @media (max-width: 768px) {
    justify-content: ${(props) => (props.$center ? "center" : "flex-start")};
  }
`;

const CenteredNote = styled(SmallText)`
  @media (max-width: 768px) {
    text-align: center;
  }
`;

const OutlineChip = styled.span`
  border: 2px solid ${c.ink};
  border-radius: 999px;
  background: #ffffff;
  padding: 0.35rem 0.85rem;
  font-size: 0.9rem;
  font-weight: 800;
  color: ${c.ink};
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
`;

const ExpressionRow = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1.1rem 1.25rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.88);
`;

const RowExpression = styled.span`
  font-size: 1.2rem;
  font-weight: 900;
  color: ${c.ink};
`;

const Compare = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem 1.25rem;
`;

const CompareLine = styled.div`
  display: grid;
  grid-template-columns: 4.25rem 1fr;
  align-items: baseline;
  gap: 0.5rem;
`;

const BeforeText = styled.span`
  font-size: 0.94rem;
  font-weight: 600;
  line-height: 1.5;
  color: ${c.muted};
`;

const AfterText = styled.span`
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.5;
  color: ${c.ink};

  mark {
    background: linear-gradient(transparent 62%, rgba(244, 122, 74, 0.45) 62%);
    color: inherit;
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

const SubSection = styled.div`
  margin-top: 2.5rem;
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

const DownArrow = () => (
  <svg viewBox="0 0 36 36" fill="none" aria-hidden>
    <circle cx="18" cy="18" r="16" fill={c.orange} stroke={c.ink} strokeWidth="2" />
    <path
      d="M18 10v15m0 0l-6-6m6 6l6-6"
      stroke={c.ink}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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

export default function TrackDetailClient({
  track,
}: {
  track: NewsletterTrack;
}) {
  const { t } = useI18n();
  const copy = t.newsletter.detail;
  const trackCopy = t.newsletter.tracks[track];
  const lesson = trackCopy.lesson;
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
          <PriceCard>
            <SubTitle>
              {trackCopy.title} {copy.pricingSuffix}
            </SubTitle>
            <PriceRow>
              <Price>{t.newsletter.price.amount.replace("{price}", price)}</Price>
              <SmallText>{t.newsletter.price.perMonth}</SmallText>
            </PriceRow>
            <Pill>
              {t.newsletter.price.member.replace(
                "{price}",
                formatKrw(NEWSLETTER_MEMBER_PRICE_KRW),
              )}
            </Pill>
            <Facts>
              {copy.facts.map((fact) => (
                <Fragment key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </Fragment>
              ))}
            </Facts>
          </PriceCard>
        </Container>
      </Section>

      <Section $background={c.surface}>
        <Container $narrow>
          <SectionHeader>
            <Chip>{copy.painEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={trackCopy.painTitle} />
            </SectionTitle>
          </SectionHeader>
          <Bubbles $align="start">
            {trackCopy.pains.map((pain) => (
              <Bubble key={pain} $tone="pain">
                {pain}
              </Bubble>
            ))}
          </Bubbles>
          <Arrow>
            <DownArrow />
          </Arrow>
          <GainTitle>{copy.gainTitle}</GainTitle>
          <Bubbles $align="end">
            {trackCopy.gains.map((gain) => (
              <Bubble key={gain} $tone="gain">
                {gain}
              </Bubble>
            ))}
          </Bubbles>
        </Container>
      </Section>

      <AuthorSection />

      <Section $background={c.cream}>
        <Container>
          <SectionHeader>
            <SectionTitle>
              <AccentLines
                text={copy.pillsTitle.replace("{track}", trackCopy.title)}
              />
            </SectionTitle>
          </SectionHeader>
          <PillGrid>
            {copy.pills.map((pill) => (
              <PillCard key={pill.title}>
                <PillTitle>{pill.title}</PillTitle>
                <SmallText>{pill.detail}</SmallText>
              </PillCard>
            ))}
          </PillGrid>
        </Container>
      </Section>

      <Section id="sample" $background={c.surface}>
        <Container $narrow>
          <SectionHeader>
            <Chip>{copy.lessonEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={copy.lessonTitle} />
            </SectionTitle>
          </SectionHeader>

          <KakaoCard>
            <KakaoHead>
              <KakaoAvatar>1</KakaoAvatar>
              {t.newsletter.brand.name}
              <Pill $background={KAKAO_YELLOW} $color={c.ink}>
                {copy.kakaoTag}
              </Pill>
              <KakaoTime>{copy.kakaoTime}</KakaoTime>
            </KakaoHead>
            <KakaoBody>
              {copy.kakaoNotice}
              <br />[{trackCopy.title}] {lesson.expression}
            </KakaoBody>
          </KakaoCard>

          <LessonCard>
            <Expression lang="en">{lesson.expression}</Expression>
            <Block>
              <Label>{copy.meaningLabel}</Label>
              <Meaning>{lesson.meaning}</Meaning>
            </Block>
            <Block>
              <Label>{copy.nuanceLabel}</Label>
              <Nuance>{lesson.nuance}</Nuance>
            </Block>
            <Block>
              <Label>{copy.examplesLabel}</Label>
              <Examples>
                {lesson.examples.map((example) => (
                  <li key={example.en}>
                    <span>
                      <ExampleEn lang="en">{example.en}</ExampleEn>
                      <SmallText lang="ko">{example.ko}</SmallText>
                    </span>
                  </li>
                ))}
              </Examples>
            </Block>
            <Block>
              <Label>{copy.similarLabel}</Label>
              <ChipRow>
                {lesson.similar.map((item) => (
                  <OutlineChip key={item} lang="en">
                    {item}
                  </OutlineChip>
                ))}
              </ChipRow>
            </Block>
            <SmallText>{copy.audioNote}</SmallText>
          </LessonCard>
        </Container>
      </Section>

      <Section>
        <Container $narrow>
          <SectionHeader>
            <Chip>{copy.notBasicEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={copy.notBasicTitle} />
            </SectionTitle>
          </SectionHeader>
          <Rows>
            {trackCopy.notBasic.map((item) => (
              <ExpressionRow key={item.en}>
                <Pill>{item.type}</Pill>
                <RowExpression lang="en">{item.en}</RowExpression>
                <SmallText $color={c.body}>{item.ko}</SmallText>
              </ExpressionRow>
            ))}
          </Rows>
        </Container>
      </Section>

      <Section $background={c.surface}>
        <Container $narrow>
          <SectionHeader>
            <Chip>{copy.beforeAfterEyebrow}</Chip>
            <SectionTitle>
              <AccentLines text={copy.beforeAfterTitle} />
            </SectionTitle>
          </SectionHeader>
          <Rows>
            {trackCopy.beforeAfter.map((pair) => (
              <Compare key={pair.after}>
                <CompareLine>
                  <Pill $background={c.line} $color={c.body}>
                    {copy.beforeLabel}
                  </Pill>
                  <BeforeText lang="en">{pair.before}</BeforeText>
                </CompareLine>
                <CompareLine>
                  <Pill $background={c.orange} $color={c.ink}>
                    {copy.afterLabel}
                  </Pill>
                  <AfterText lang="en">
                    <Highlighted text={pair.after} highlight={pair.highlight} />
                  </AfterText>
                </CompareLine>
              </Compare>
            ))}
          </Rows>
        </Container>
      </Section>

      <Section>
        <Container $narrow>
          <SectionHeader>
            <SectionTitle>{copy.scenesTitle}</SectionTitle>
          </SectionHeader>
          <ChipRow $center>
            {trackCopy.scenes.map((scene) => (
              <OutlineChip key={scene}>{scene}</OutlineChip>
            ))}
          </ChipRow>

          <SubSection>
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
          </SubSection>

          <SubSection>
            <SectionHeader>
              <SectionTitle>{copy.reviewsTitle}</SectionTitle>
            </SectionHeader>
            <CenteredNote>{copy.reviewsEmpty}</CenteredNote>
          </SubSection>
        </Container>
      </Section>

      <ActionBar>
        <ActionRow $narrow>
          {NEWSLETTER_SUBSCRIPTIONS_OPEN ? (
            <>
              <OutlineLink href={`/newsletter/checkout?track=${track}&gift=1`}>
                {copy.gift}
              </OutlineLink>
              <OrangeLink href={`/newsletter/checkout?track=${track}`}>
                {copy.subscribe.replace("{price}", price)}
              </OrangeLink>
            </>
          ) : (
            <>
              <OutlineButton type="button" disabled>
                {copy.gift}
              </OutlineButton>
              <OrangeButton type="button" disabled>
                {copy.comingSoon}
              </OrangeButton>
            </>
          )}
        </ActionRow>
      </ActionBar>
    </Page>
  );
}
