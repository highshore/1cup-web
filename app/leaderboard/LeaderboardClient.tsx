"use client";

import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";

import {
  MeetupLeaderboardEntry,
  MeetupLeaderboards,
} from "../lib/features/meetup/types/meetup_types";
import { fetchMeetupLeaderboards } from "../lib/features/meetup/services/meetup_service";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { appLayout } from "../lib/constants/app_layout";
import { useI18n } from "../lib/i18n/I18nProvider";

const PageShell = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: 1.75rem 0 clamp(2.5rem, 5vw, 3rem);
  color: #111827;
`;

const Content = styled.div`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
  padding: 0 ${appLayout.pageGutterDesktop};

  @media (max-width: 768px) {
    padding: 0;
  }
`;

const Header = styled.header`
  margin-bottom: 1.25rem;
`;

const Title = styled.h1`
  margin: 0;
  color: #111827;
  font-size: clamp(1.65rem, 4vw, 2.4rem);
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1.15;
`;

const Subtitle = styled.p`
  max-width: 680px;
  margin: 0.65rem 0 0;
  color: #64748b;
  font-size: 0.98rem;
  line-height: 1.6;
`;

const LeaderboardsGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const LeaderboardCard = styled.div`
  min-width: 0;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #ffffff;
  padding: 1.15rem;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);

  @media (max-width: 768px) {
    border-radius: 16px;
  }
`;

const LeaderboardTitle = styled.h2`
  margin: 0 0 0.95rem;
  color: #111827;
  font-size: 1rem;
  font-weight: 850;
  line-height: 1.25;
`;

const LeaderboardList = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const LeaderboardItem = styled.li`
  display: grid;
  grid-template-columns: 1.5rem 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
`;

const LeaderboardRank = styled.span`
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 850;
  text-align: right;
`;

const LeaderboardAvatar = styled.div`
  display: flex;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 0.82rem;
  font-weight: 850;
`;

const LeaderboardAvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const LeaderboardName = styled.span`
  overflow: hidden;
  color: #1f2937;
  font-size: 0.94rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LeaderboardValue = styled.span`
  color: #64748b;
  font-size: 0.83rem;
  font-weight: 750;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  padding: 0.65rem 0;
  color: #94a3b8;
  font-size: 0.9rem;
`;

const ErrorState = styled.div`
  border: 1px solid #fecaca;
  border-radius: 16px;
  background: #fef2f2;
  padding: 1rem;
  color: #991b1b;
  font-weight: 700;
`;

export default function LeaderboardClient() {
  const { locale, t } = useI18n();
  const [leaderboards, setLeaderboards] = useState<MeetupLeaderboards | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const interpolate = (template: string, values: Record<string, string>) => {
    return Object.entries(values).reduce(
      (result, [key, value]) => result.replace(`{${key}}`, value),
      template
    );
  };

  const monthLabel = new Intl.DateTimeFormat(
    locale === "ko" ? "ko-KR" : "en-US",
    { month: "long" }
  ).format(new Date());

  const loadLeaderboards = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMeetupLeaderboards();
      setLeaderboards(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    loadLeaderboards();
  }, [loadLeaderboards]);

  const formatMeetupCount = (count: number) => {
    if (count === 1) return t.meetup.leaderboards.meetupCountSingular;
    return interpolate(t.meetup.leaderboards.meetupCount, {
      count: String(count),
    });
  };

  const formatJoinedAt = (joinedAt?: string) => {
    if (!joinedAt) return "";
    const date = new Date(joinedAt);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const renderLeaderboardCard = (
    title: string,
    entries: MeetupLeaderboardEntry[],
    emptyLabel: string,
    getValueLabel: (entry: MeetupLeaderboardEntry) => string
  ) => (
    <LeaderboardCard>
      <LeaderboardTitle>{title}</LeaderboardTitle>
      {entries.length > 0 ? (
        <LeaderboardList>
          {entries.map((entry, index) => (
            <LeaderboardItem key={entry.uid}>
              <LeaderboardRank>{index + 1}</LeaderboardRank>
              <LeaderboardAvatar>
                {entry.photoURL ? (
                  <LeaderboardAvatarImage
                    src={entry.photoURL}
                    alt={entry.displayName}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  entry.displayName.charAt(0).toUpperCase()
                )}
              </LeaderboardAvatar>
              <LeaderboardName>{entry.displayName}</LeaderboardName>
              <LeaderboardValue>{getValueLabel(entry)}</LeaderboardValue>
            </LeaderboardItem>
          ))}
        </LeaderboardList>
      ) : (
        <EmptyState>{emptyLabel}</EmptyState>
      )}
    </LeaderboardCard>
  );

  return (
    <PageShell>
      <Content>
        <Header>
          <Title>{t.meetup.leaderboards.title}</Title>
          <Subtitle>{t.meetup.leaderboards.subtitle}</Subtitle>
        </Header>

        {loading && <GlobalLoadingScreen size="large" />}
        {error && <ErrorState>{error}</ErrorState>}

        {!loading && !error && leaderboards && (
          <LeaderboardsGrid>
            {renderLeaderboardCard(
              t.meetup.leaderboards.totalParticipation,
              leaderboards.totalParticipation,
              t.meetup.leaderboards.noParticipation,
              (entry) => formatMeetupCount(entry.value)
            )}
            {renderLeaderboardCard(
              interpolate(t.meetup.leaderboards.monthlyParticipation, {
                month: monthLabel,
              }),
              leaderboards.monthlyParticipation,
              t.meetup.leaderboards.noMonthlyParticipation,
              (entry) => formatMeetupCount(entry.value)
            )}
            {renderLeaderboardCard(
              t.meetup.leaderboards.newMembers,
              leaderboards.newMembers,
              t.meetup.leaderboards.noNewMembers,
              (entry) => formatJoinedAt(entry.joinedAt)
            )}
          </LeaderboardsGrid>
        )}
      </Content>
    </PageShell>
  );
}
