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
import { useAuth } from "../lib/contexts/auth_context";
import { Celebration } from "../lib/features/celebration/types/celebration_types";
import {
  fetchCelebrations,
  createCelebration,
  updateCelebration,
  deleteCelebration,
  reorderCelebrations,
} from "../lib/features/celebration/services/celebration_service";
import CelebrationEditor from "../lib/features/celebration/components/CelebrationEditor";

const PageShell = styled.div`
  width: 100%;
  min-height: 100vh;
  padding: clamp(2rem, 5vw, 3rem) 0 clamp(3rem, 6vw, 4rem);
  background: transparent;
  color: #050505;
`;

const Content = styled.div`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
  padding: 0 ${appLayout.pageGutterDesktop};

  @media (max-width: 768px) {
    padding: 0 1rem;
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
  border: 2px solid #050505;
  border-radius: 14px;
  background: #ffffff;
  padding: clamp(0.95rem, 2vw, 1.15rem);
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.88);

  @media (max-width: 768px) {
    border-radius: 12px;
    box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.88);
  }
`;

const LeaderboardTitle = styled.h2`
  display: inline-flex;
  align-items: center;
  margin: 0 0 0.6rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.28rem 0.62rem;
  font-size: clamp(0.82rem, 1.6vw, 0.92rem);
  font-weight: 900;
  line-height: 1.25;
  word-break: keep-all;
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
  border-bottom: 1px solid rgba(5, 5, 5, 0.08);
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
  color: rgba(5, 5, 5, 0.52);
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
  border: 1.5px solid #050505;
  border-radius: 50%;
  background: #f3f3f1;
  color: #050505;
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
  color: #050505;
  font-size: 0.94rem;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LeaderboardValue = styled.span`
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.82rem;
  font-weight: 680;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  padding: 0.65rem 0;
  color: rgba(5, 5, 5, 0.48);
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

const CelebrationSection = styled.section`
  margin-bottom: clamp(1.5rem, 4vw, 2.25rem);
`;

const CelebrationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.3rem;
`;

const CelebrationSubtitle = styled.p`
  margin: 0 0 0.9rem;
  color: rgba(5, 5, 5, 0.6);
  font-size: clamp(0.82rem, 1.6vw, 0.9rem);
  font-weight: 600;
  word-break: keep-all;
`;

const AddCelebrationButton = styled.button`
  flex-shrink: 0;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0.34rem 0.85rem;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 850;
  cursor: pointer;
  box-shadow: 3px 3px 0 #f47a4a;
  transition: transform 140ms ease, box-shadow 140ms ease;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #f47a4a;
  }
`;

const CelebrationScroller = styled.div`
  display: flex;
  gap: clamp(0.75rem, 2vw, 1rem);
  overflow-x: auto;
  padding: 0.4rem 0.25rem 1.1rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 8px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(5, 5, 5, 0.22);
  }
`;

const CelebrationCard = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  width: clamp(13rem, 60vw, 15rem);
  flex: 0 0 auto;
  scroll-snap-align: start;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #ffffff;
  padding: 1.1rem 1rem 1rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.88);
`;

const CelebrationLogo = styled.div`
  width: 100%;
  margin-bottom: 0.85rem;
  border-radius: 10px;
  background: transparent;

  img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
  }
`;

const CelebrationMember = styled.span`
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.82rem;
  font-weight: 750;
`;

const CelebrationHeadline = styled.strong`
  display: block;
  margin: 0.18rem 0 0.4rem;
  color: #050505;
  font-size: clamp(1rem, 2.4vw, 1.12rem);
  font-weight: 950;
  line-height: 1.3;
  word-break: keep-all;
`;

const CelebrationDesc = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.5;
  word-break: keep-all;
`;

const CelebrationDate = styled.span`
  margin-top: 0.7rem;
  color: rgba(5, 5, 5, 0.48);
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const CelebrationEditButton = styled.button`
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0.2rem 0.6rem;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;

  &:hover {
    background: #f47a4a;
  }
`;

const CelebrationReorder = styled.div`
  position: absolute;
  top: 0.55rem;
  left: 0.55rem;
  display: flex;
  gap: 0.3rem;
  z-index: 1;
`;

const CelebrationReorderButton = styled.button`
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #f47a4a;
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

export default function LeaderboardClient() {
  const { locale, t } = useI18n();
  const { accountStatus } = useAuth();
  const isAdmin = accountStatus === "admin";

  const [leaderboards, setLeaderboards] = useState<MeetupLeaderboards | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [editingCelebration, setEditingCelebration] =
    useState<Celebration | null>(null);
  const [showCelebrationEditor, setShowCelebrationEditor] = useState(false);

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

  const loadCelebrations = useCallback(async () => {
    try {
      const data = await fetchCelebrations();
      setCelebrations(data);
    } catch {
      // Non-fatal: the rest of the leaderboard still renders.
      setCelebrations([]);
    }
  }, []);

  useEffect(() => {
    loadCelebrations();
  }, [loadCelebrations]);

  const handleCreateCelebration = () => {
    setEditingCelebration(null);
    setShowCelebrationEditor(true);
  };

  const handleEditCelebration = (celebration: Celebration) => {
    setEditingCelebration(celebration);
    setShowCelebrationEditor(true);
  };

  const handleSaveCelebration = async (data: Partial<Celebration>) => {
    if (editingCelebration) {
      await updateCelebration(editingCelebration.id, data);
    } else {
      await createCelebration(data);
    }
    await loadCelebrations();
  };

  const handleDeleteCelebration = async (id: string) => {
    await deleteCelebration(id);
    await loadCelebrations();
  };

  // Move a celebration one slot earlier (-1) or later (+1) and persist.
  const handleMoveCelebration = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= celebrations.length) return;

    const reordered = [...celebrations];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];

    setCelebrations(reordered); // optimistic
    try {
      await reorderCelebrations(reordered.map((c) => c.id));
    } catch {
      await loadCelebrations(); // revert to server truth on failure
    }
  };

  const formatAchievedAt = (achievedAt?: string | null) => {
    if (!achievedAt) return "";
    const date = new Date(achievedAt);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "long",
    }).format(date);
  };

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
        {loading && <GlobalLoadingScreen />}
        {error && <ErrorState>{error}</ErrorState>}

        {!loading && !error && (celebrations.length > 0 || isAdmin) && (
          <CelebrationSection aria-label={t.meetup.leaderboards.celebration.title}>
            <CelebrationHeader>
              <LeaderboardTitle as="h2">
                {t.meetup.leaderboards.celebration.title}
              </LeaderboardTitle>
              {isAdmin && (
                <AddCelebrationButton
                  type="button"
                  onClick={handleCreateCelebration}
                >
                  + {t.meetup.leaderboards.celebration.addButton}
                </AddCelebrationButton>
              )}
            </CelebrationHeader>
            <CelebrationSubtitle>
              {t.meetup.leaderboards.celebration.subtitle}
            </CelebrationSubtitle>

            {celebrations.length > 0 ? (
              <CelebrationScroller>
                {celebrations.map((celebration, index) => (
                  <CelebrationCard key={celebration.id}>
                    {isAdmin && (
                      <>
                        <CelebrationReorder>
                          <CelebrationReorderButton
                            type="button"
                            aria-label="앞으로 이동"
                            disabled={index === 0}
                            onClick={() => handleMoveCelebration(index, -1)}
                          >
                            ‹
                          </CelebrationReorderButton>
                          <CelebrationReorderButton
                            type="button"
                            aria-label="뒤로 이동"
                            disabled={index === celebrations.length - 1}
                            onClick={() => handleMoveCelebration(index, 1)}
                          >
                            ›
                          </CelebrationReorderButton>
                        </CelebrationReorder>
                        <CelebrationEditButton
                          type="button"
                          onClick={() => handleEditCelebration(celebration)}
                        >
                          {t.meetup.leaderboards.celebration.edit}
                        </CelebrationEditButton>
                      </>
                    )}
                    {celebration.logoUrl && (
                      <CelebrationLogo>
                        <img
                          src={celebration.logoUrl}
                          alt={celebration.headline}
                          referrerPolicy="no-referrer"
                        />
                      </CelebrationLogo>
                    )}
                    <CelebrationMember>
                      {celebration.memberName}
                    </CelebrationMember>
                    <CelebrationHeadline>
                      {celebration.headline}
                    </CelebrationHeadline>
                    {celebration.description && (
                      <CelebrationDesc>
                        {celebration.description}
                      </CelebrationDesc>
                    )}
                    {celebration.achievedAt && (
                      <CelebrationDate>
                        {formatAchievedAt(celebration.achievedAt)}
                      </CelebrationDate>
                    )}
                  </CelebrationCard>
                ))}
              </CelebrationScroller>
            ) : (
              <EmptyState>{t.meetup.leaderboards.celebration.empty}</EmptyState>
            )}
          </CelebrationSection>
        )}

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

      {showCelebrationEditor && (
        <CelebrationEditor
          celebration={editingCelebration}
          onSave={handleSaveCelebration}
          onClose={() => setShowCelebrationEditor(false)}
          onDelete={editingCelebration ? handleDeleteCelebration : undefined}
        />
      )}
    </PageShell>
  );
}
