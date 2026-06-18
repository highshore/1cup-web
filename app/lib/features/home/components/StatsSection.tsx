"use client";

import styled from "styled-components";
import { TrophyIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../../i18n/I18nProvider";
import { HomeStats } from "../services/stats_service";

interface StatsSectionProps {
  stats?: HomeStats;
}

const MOBILE_NAV_GUTTER = "1rem";

const SectionContainer = styled.section`
  position: relative;
  z-index: 2;
  padding: 1.5rem 0 clamp(4.5rem, 8vw, 6rem);
  background: transparent;
`;

const Container = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const StatsCard = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1.25rem;
  border: 2px solid #050505;
  border-radius: 1.2rem;
  background-color: #f47a4a;
  color: #050505;
  padding: 2.4rem 1.4rem;
  text-align: center;
  box-shadow: 7px 7px 0 #050505;

  @media (min-width: 900px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 2.25rem;
    padding: 2.75rem 3rem;
    text-align: left;
  }
`;

const StatIconWrap = styled.div`
  display: flex;
  width: 100%;
  max-width: fit-content;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
`;

const StatContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
`;

const CardTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
`;

const MetricsContainer = styled.div`
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: clamp(1rem, 3vw, 2rem);
  margin-top: 0.5rem;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    text-align: center;
  }
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.34rem;
  min-width: 0;

  @media (max-width: 860px) {
    align-items: center;
  }
`;

const MetricValue = styled.span`
  color: #050505;
  font-size: clamp(2rem, 4vw, 2.5rem);
  font-weight: 800;
  line-height: 1;
`;

const MetricLabel = styled.span`
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.25;
`;

const ButtonWrap = styled.div`
  margin-top: 1rem;
`;

const Button = styled.button`
  border: 2px solid #050505;
  border-radius: 9999px;
  background-color: #fff8dc;
  color: #050505;
  padding: 0.75rem 1.5rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.92);
  transition: background-color 0.2s, box-shadow 0.2s, transform 0.2s;

  &:hover {
    background-color: #ffffff;
    box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.92);
    transform: translate(-1px, -1px);
  }

  @media (max-width: 768px) {
    width: 100%;
    margin-top: 1rem;
  }
`;

export default function StatsSection({ stats }: StatsSectionProps) {
  const { t } = useI18n();
  const meetupCount = stats?.totalMeetups || 30;
  const memberCount = stats?.totalMembers || 50;

  return (
    <SectionContainer>
      <Container>
        <StatsCard>
          <StatIconWrap>
            <TrophyIcon width={48} color="#050505" />
          </StatIconWrap>
          <StatContent>
            <CardTitle>{t.home.stats.growth.title}</CardTitle>
            <MetricsContainer>
              <MetricItem>
                <MetricValue>
                  {meetupCount}
                  {t.home.stats.growth.valueSuffixes.meetups}
                </MetricValue>
                <MetricLabel>{t.home.stats.growth.metrics.meetups}</MetricLabel>
              </MetricItem>
              <MetricItem>
                <MetricValue>
                  {memberCount}
                  {t.home.stats.growth.valueSuffixes.members}
                </MetricValue>
                <MetricLabel>{t.home.stats.growth.metrics.members}</MetricLabel>
              </MetricItem>
              <MetricItem>
                <MetricValue>90%+</MetricValue>
                <MetricLabel>{t.home.stats.growth.metrics.retention}</MetricLabel>
              </MetricItem>
            </MetricsContainer>
          </StatContent>
          <ButtonWrap>
            <Button>{t.home.stats.growth.cta}</Button>
          </ButtonWrap>
        </StatsCard>
      </Container>
    </SectionContainer>
  );
}
