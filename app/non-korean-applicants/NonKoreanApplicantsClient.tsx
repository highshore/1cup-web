"use client";

import Link from "next/link";
import styled from "styled-components";
import { appLayout } from "../lib/constants/app_layout";
import StatsSection from "../lib/features/home/components/StatsSection";
import { HomeStats } from "../lib/features/home/services/stats_service";
import { useI18n } from "../lib/i18n/I18nProvider";

const Page = styled.main`
  min-height: 100vh;
  overflow: hidden;
  background: transparent;
  color: #050505;
`;

const Container = styled.div`
  width: min(${appLayout.pageMaxWidth}, calc(100% - 3rem));
  margin: 0 auto;

  @media (max-width: 768px) {
    width: calc(100% - 2rem);
  }
`;

const Hero = styled.section`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.75fr);
  gap: clamp(1.5rem, 4vw, 2.5rem);
  align-items: center;
  padding: clamp(3rem, 6vw, 4.75rem) 0 clamp(2.5rem, 5vw, 3.75rem);

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    padding-top: 2.75rem;
    text-align: center;
  }
`;

const Eyebrow = styled.p`
  display: inline-block;
  margin: 0 0 1rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.3rem 0.68rem;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.02em;
`;

const Title = styled.h1`
  max-width: 48rem;
  margin: 0;
  color: #050505;
  font-size: clamp(2rem, 4.4vw, 3.7rem);
  font-weight: 950;
  line-height: 1.05;
  letter-spacing: 0;

  @media (max-width: 860px) {
    max-width: 100%;
  }
`;

const Subtitle = styled.p`
  max-width: 40rem;
  margin: 1rem 0 0;
  color: rgba(5, 5, 5, 0.72);
  font-size: clamp(0.98rem, 1.5vw, 1.08rem);
  font-weight: 590;
  line-height: 1.65;

  @media (max-width: 860px) {
    margin-right: auto;
    margin-left: auto;
  }
`;

const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  align-items: center;
  margin-top: 1.55rem;

  @media (max-width: 860px) {
    justify-content: center;
  }
`;

const PrimaryButton = styled(Link)`
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #050505;
  color: #ffffff;
  padding: 0.66rem 1.05rem;
  font-size: 0.88rem;
  font-weight: 900;
  text-decoration: none;
  box-shadow: 5px 5px 0 #f47a4a;
  transition: transform 180ms ease, box-shadow 180ms ease;

  &:hover {
    color: #ffffff;
    text-decoration: none;
    transform: translate(-1px, -1px);
    box-shadow: 7px 7px 0 #f47a4a;
  }
`;

const SecondaryButton = styled(Link)`
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #fff8dc;
  color: #050505;
  padding: 0.66rem 1.05rem;
  font-size: 0.88rem;
  font-weight: 900;
  text-decoration: none;

  &:hover {
    color: #050505;
    background: #ffffff;
    text-decoration: none;
  }
`;

const HeroCard = styled.aside`
  position: relative;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #f47a4a;
  padding: clamp(1.05rem, 2.5vw, 1.4rem);
  box-shadow: 7px 7px 0 #050505;
  text-align: left;

  @media (max-width: 860px) {
    max-width: 32rem;
    margin: 0 auto;
  }
`;

const HeroCardTitle = styled.h2`
  margin: 0 0 1rem;
  color: #050505;
  font-size: 1rem;
  font-weight: 950;
  line-height: 1.25;
`;

const HeroList = styled.ul`
  display: grid;
  gap: 0.58rem;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const HeroListItem = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
  color: rgba(5, 5, 5, 0.82);
  font-size: 0.9rem;
  font-weight: 690;
  line-height: 1.45;
`;

const Dot = styled.span`
  width: 0.58rem;
  height: 0.58rem;
  margin-top: 0.42rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #fff8dc;
`;

const Section = styled.section`
  padding: clamp(2.75rem, 5vw, 3.75rem) 0;
`;

const SectionHeader = styled.div`
  max-width: 42rem;
  margin-bottom: clamp(1.35rem, 3vw, 2rem);

  @media (max-width: 768px) {
    margin-right: auto;
    margin-left: auto;
    text-align: center;
  }
`;

const SectionTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: clamp(1.65rem, 3vw, 2.35rem);
  font-weight: 950;
  line-height: 1.12;
`;

const SectionDescription = styled.p`
  margin: 0.75rem 0 0;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.96rem;
  font-weight: 590;
  line-height: 1.65;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const InfoCard = styled.article`
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: clamp(1rem, 2.5vw, 1.25rem);
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.92);
`;

const CardNumber = styled.span`
  display: inline-grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  font-size: 0.78rem;
  font-weight: 950;
`;

const CardTitle = styled.h3`
  margin: 0.78rem 0 0.45rem;
  color: #050505;
  font-size: 1rem;
  font-weight: 930;
  line-height: 1.28;
`;

const CardText = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.9rem;
  font-weight: 590;
  line-height: 1.65;
`;

const CountryList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.75rem;
`;

const CountryPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  border: 1px solid rgba(5, 5, 5, 0.18);
  border-radius: 999px;
  background: #fff8dc;
  color: #050505;
  padding: 0.28rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 850;
`;

const BenefitsBand = styled.section`
  margin: clamp(1.25rem, 3vw, 2rem) 0;
  border-top: 2px solid #050505;
  border-bottom: 2px solid #050505;
  background: #f47a4a;
  padding: clamp(2.5rem, 5vw, 3.5rem) 0;
`;

const BenefitList = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const BenefitNote = styled.p`
  margin: 1rem 0 0;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.95rem 1rem;
  color: #050505;
  font-size: 0.9rem;
  font-weight: 820;
  line-height: 1.55;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.92);
`;

const BenefitCard = styled.div`
  border: 2px solid #050505;
  border-radius: 10px;
  background: #fff8dc;
  padding: 0.9rem;
  color: #050505;
  font-size: 0.88rem;
  font-weight: 720;
  line-height: 1.5;
`;

const ProcessList = styled.div`
  display: grid;
  gap: 0.7rem;
`;

const ProcessItem = styled.article`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  align-items: start;
  border: 1px solid rgba(5, 5, 5, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  padding: 0.9rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    text-align: center;
  }
`;

const ProcessNumber = styled.span`
  display: inline-grid;
  width: 2.05rem;
  height: 2.05rem;
  place-items: center;
  border-radius: 8px;
  background: #050505;
  color: #ffffff;
  font-weight: 950;

  @media (max-width: 560px) {
    margin: 0 auto;
  }
`;

const ProcessTitle = styled.h3`
  margin: 0 0 0.3rem;
  color: #050505;
  font-size: 0.94rem;
  font-weight: 900;
`;

const ProcessText = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.66);
  font-size: 0.88rem;
  font-weight: 590;
  line-height: 1.6;
`;

const CtaBox = styled.section`
  margin: clamp(1.5rem, 4vw, 3rem) 0 clamp(3rem, 6vw, 4.5rem);
  border: 2px solid #050505;
  border-radius: 16px;
  background: #050505;
  padding: clamp(1.65rem, 4vw, 2.6rem);
  color: #ffffff;
  text-align: center;
`;

const CtaTitle = styled.h2`
  margin: 0;
  color: #ffffff;
  font-size: clamp(1.55rem, 3.2vw, 2.55rem);
  font-weight: 950;
  line-height: 1.12;
`;

const CtaText = styled.p`
  max-width: 42rem;
  margin: 0.8rem auto 0;
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.94rem;
  font-weight: 590;
  line-height: 1.7;
`;

const CtaActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: center;
  margin-top: 1.3rem;
`;

const InvertedButton = styled(Link)`
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0.66rem 1.05rem;
  font-size: 0.88rem;
  font-weight: 900;
  text-decoration: none;

  &:hover {
    color: #050505;
    background: #fff8dc;
    text-decoration: none;
  }
`;

const GhostButton = styled(Link)`
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  background: transparent;
  color: #ffffff;
  padding: 0.66rem 1.05rem;
  font-size: 0.88rem;
  font-weight: 900;
  text-decoration: none;

  &:hover {
    color: #ffffff;
    border-color: #ffffff;
    text-decoration: none;
  }
`;

interface NonKoreanApplicantsClientProps {
  stats?: HomeStats;
}

export default function NonKoreanApplicantsClient({
  stats,
}: NonKoreanApplicantsClientProps) {
  const { t } = useI18n();
  const page = t.nonKoreanApplicants;

  return (
    <Page>
      <Container>
        <Hero>
          <div>
            <Eyebrow>{page.hero.eyebrow}</Eyebrow>
            <Title>{page.hero.title}</Title>
            <Subtitle>{page.hero.subtitle}</Subtitle>
            <HeroActions>
              <PrimaryButton href="/auth">{page.hero.primaryCta}</PrimaryButton>
              <SecondaryButton href="/meetup">{page.hero.secondaryCta}</SecondaryButton>
            </HeroActions>
          </div>

          <HeroCard aria-label={page.hero.cardTitle}>
            <HeroCardTitle>{page.hero.cardTitle}</HeroCardTitle>
            <HeroList>
              {page.hero.points.map((point) => (
                <HeroListItem key={point}>
                  <Dot aria-hidden="true" />
                  <span>{point}</span>
                </HeroListItem>
              ))}
            </HeroList>
          </HeroCard>
        </Hero>
      </Container>

      <StatsSection stats={stats} />

      <Container>
        <Section>
          <SectionHeader>
            <Eyebrow>{page.eligibility.eyebrow}</Eyebrow>
            <SectionTitle>{page.eligibility.title}</SectionTitle>
            <SectionDescription>{page.eligibility.description}</SectionDescription>
          </SectionHeader>
          <CardGrid>
            {page.eligibility.items.map((item, index) => (
              <InfoCard key={item.title}>
                <CardNumber>{index + 1}</CardNumber>
                <CardTitle>{item.title}</CardTitle>
                <CardText>{item.description}</CardText>
                {item.countries ? (
                  <CountryList>
                    {item.countries.map((country) => (
                      <CountryPill key={country.name}>
                        <span aria-hidden="true">{country.flag}</span>
                        <span>{country.name}</span>
                      </CountryPill>
                    ))}
                  </CountryList>
                ) : null}
              </InfoCard>
            ))}
          </CardGrid>
        </Section>
      </Container>

      <BenefitsBand>
        <Container>
          <SectionHeader>
            <Eyebrow>{page.benefits.eyebrow}</Eyebrow>
            <SectionTitle>{page.benefits.title}</SectionTitle>
          </SectionHeader>
          <BenefitList>
            {page.benefits.items.map((benefit) => (
              <BenefitCard key={benefit}>{benefit}</BenefitCard>
            ))}
          </BenefitList>
          <BenefitNote>{page.benefits.note}</BenefitNote>
        </Container>
      </BenefitsBand>

      <Container>
        <Section>
          <SectionHeader>
            <Eyebrow>{page.process.eyebrow}</Eyebrow>
            <SectionTitle>{page.process.title}</SectionTitle>
            <SectionDescription>{page.process.description}</SectionDescription>
          </SectionHeader>
          <ProcessList>
            {page.process.steps.map((step, index) => (
              <ProcessItem key={step.title}>
                <ProcessNumber>{index + 1}</ProcessNumber>
                <div>
                  <ProcessTitle>{step.title}</ProcessTitle>
                  <ProcessText>{step.description}</ProcessText>
                </div>
              </ProcessItem>
            ))}
          </ProcessList>
        </Section>

        <CtaBox>
          <CtaTitle>{page.cta.title}</CtaTitle>
          <CtaText>{page.cta.description}</CtaText>
          <CtaActions>
            <InvertedButton href="/auth">{page.cta.primary}</InvertedButton>
            <GhostButton href="/meetup">{page.cta.secondary}</GhostButton>
          </CtaActions>
        </CtaBox>
      </Container>
    </Page>
  );
}
