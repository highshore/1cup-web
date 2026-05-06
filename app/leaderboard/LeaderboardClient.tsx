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
  padding: clamp(0.75rem, 2vw, 1rem) 0 clamp(2.5rem, 5vw, 3rem);
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

const LeaderboardsGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(0.85rem, 1.8vw, 1.1rem);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const LeaderboardCard = styled.div`
  min-width: 0;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  padding: clamp(0.95rem, 2vw, 1.15rem);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);

  @media (max-width: 768px) {
    border-radius: 16px;
  }
`;

const LeaderboardTitle = styled.h2`
  margin: 0 0 0.35rem;
  color: #111827;
  font-size: clamp(0.95rem, 1.8vw, 1.05rem);
  font-weight: 760;
  line-height: 1.25;
`;

const LeaderboardList = styled.ol`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const LeaderboardItem = styled.li`
  display: grid;
  grid-template-columns: 1.45rem 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  border-bottom: 1px solid #f1f5f9;
  padding: 0.7rem 0;

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
`;

const LeaderboardRank = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  font-weight: 720;
`;

const LeaderboardAvatar = styled.div`
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 50%;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 0.76rem;
  font-weight: 760;
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
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LeaderboardValue = styled.span`
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 680;
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

  const formatMonthlyRate = (rate: number) => {
    const formattedRate = new Intl.NumberFormat(
      locale === "ko" ? "ko-KR" : "en-US",
      {
        maximumFractionDigits: rate >= 10 ? 0 : 1,
      }
    ).format(rate);

    return interpolate(t.meetup.leaderboards.monthlyAverageCount, {
      count: formattedRate,
    });
  };

  const getMaskedDisplayName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return "";

    const characters = Array.from(trimmedName);
    const visibleIndexes = characters
      .map((character, index) => ({ character, index }))
      .filter(({ character }) => character.trim() !== "");

    if (visibleIndexes.length <= 1) return trimmedName;

    const target =
      visibleIndexes.length === 2
        ? visibleIndexes[1]
        : visibleIndexes[Math.floor(visibleIndexes.length / 2)];

    return characters
      .map((character, index) => (index === target.index ? "*" : character))
      .join("");
  };

  const renderLeaderboardCard = (
    title: string,
    entries: MeetupLeaderboardEntry[],
    emptyLabel: string,
    getValueLabel: (entry: MeetupLeaderboardEntry) => string
  ) => {
    return (
      <LeaderboardCard>
        <LeaderboardTitle>{title}</LeaderboardTitle>
        {entries.length > 0 ? (
          <LeaderboardList>
            {entries.map((entry, index) => {
              const maskedName = getMaskedDisplayName(entry.displayName);

              return (
                <LeaderboardItem key={entry.uid}>
                  <LeaderboardRank>{index + 1}</LeaderboardRank>
                  <LeaderboardAvatar>
                    {entry.photoURL ? (
                      <LeaderboardAvatarImage
                        src={entry.photoURL}
                        alt={maskedName}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      maskedName.charAt(0).toUpperCase()
                    )}
                  </LeaderboardAvatar>
                  <LeaderboardName>{maskedName}</LeaderboardName>
                  <LeaderboardValue>{getValueLabel(entry)}</LeaderboardValue>
                </LeaderboardItem>
              );
            })}
          </LeaderboardList>
        ) : (
          <EmptyState>{emptyLabel}</EmptyState>
        )}
      </LeaderboardCard>
    );
  };

  return (
    <PageShell>
      <Content>
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
              t.meetup.leaderboards.monthlyAverageParticipation,
              leaderboards.participationRate,
              t.meetup.leaderboards.noMonthlyAverageParticipation,
              (entry) => formatMonthlyRate(entry.value)
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
