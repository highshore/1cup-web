"use client";

import React, { useCallback, useEffect, useState } from "react";

import {
  MeetupLeaderboardEntry,
  MeetupLeaderboards,
} from "../lib/features/meetup/types/meetup_types";
import { fetchMeetupLeaderboards } from "../lib/features/meetup/services/meetup_service";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
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

const leaderboardTitleClass =
  "m-0 mb-[0.6rem] inline-flex items-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-[0.62rem] py-[0.28rem] text-[clamp(0.82rem,1.6vw,0.92rem)] font-black leading-[1.25] text-[#050505] [word-break:keep-all]";

const emptyStateClass = "py-[0.65rem] text-[0.9rem] text-[rgba(5,5,5,0.48)]";

const celebrationReorderButtonClass =
  "inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border-[1.5px] border-[#050505] bg-white text-[0.78rem] font-black leading-none text-[#050505] hover:enabled:bg-[#f47a4a] disabled:cursor-not-allowed disabled:opacity-35";

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
      <div className="min-w-0 rounded-[14px] border-2 border-[#050505] bg-white p-[clamp(0.95rem,2vw,1.15rem)] shadow-[4px_4px_0_rgba(5,5,5,0.88)] max-[768px]:rounded-xl max-[768px]:shadow-[3px_3px_0_rgba(5,5,5,0.88)]">
        <h2 className={leaderboardTitleClass}>{title}</h2>
        {entries.length > 0 ? (
          <ol className="m-0 flex list-none flex-col p-0">
            {entries.map((entry, index) => {
              const maskedName = getMaskedDisplayName(entry.displayName);

              return (
                <li
                  key={entry.uid}
                  className="grid min-w-0 grid-cols-[1.45rem_32px_minmax(0,1fr)_auto] items-center gap-[0.65rem] border-b border-[rgba(5,5,5,0.08)] py-[0.7rem] last:border-b-0 last:pb-0"
                >
                  <span className="inline-flex items-center justify-center text-[0.82rem] font-[720] tabular-nums text-[rgba(5,5,5,0.52)]">
                    {index + 1}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[#050505] bg-[#f3f3f1] text-[0.76rem] font-[760] text-[#050505]">
                    {entry.photoURL ? (
                      <img
                        className="h-full w-full object-cover"
                        src={entry.photoURL}
                        alt={maskedName}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      maskedName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.94rem] font-[680] text-[#050505]">
                    {maskedName}
                  </span>
                  <span className="whitespace-nowrap text-[0.82rem] font-[680] text-[rgba(5,5,5,0.62)]">
                    {getValueLabel(entry)}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={emptyStateClass}>{emptyLabel}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-transparent pb-[clamp(3rem,6vw,4rem)] text-[#050505]">
      <div className="mx-auto w-full max-w-page px-gutter max-[768px]:px-4">
        {loading && <GlobalLoadingScreen />}
        {error && (
          <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4 font-bold text-[#991b1b]">
            {error}
          </div>
        )}

        {!loading && !error && (celebrations.length > 0 || isAdmin) && (
          <section
            className="mb-[clamp(1.5rem,4vw,2.25rem)]"
            aria-label={t.meetup.leaderboards.celebration.title}
          >
            <div className="mb-[0.3rem] flex items-center justify-between gap-3">
              <h2 className={leaderboardTitleClass}>
                {t.meetup.leaderboards.celebration.title}
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded-full border-2 border-[#050505] bg-white px-[0.85rem] py-[0.34rem] text-[0.82rem] font-[850] text-[#050505] shadow-[3px_3px_0_#f47a4a] transition-[transform,box-shadow] duration-[140ms] ease-[ease] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#f47a4a]"
                  onClick={handleCreateCelebration}
                >
                  + {t.meetup.leaderboards.celebration.addButton}
                </button>
              )}
            </div>
            <p className="m-0 mb-[0.9rem] text-[clamp(0.82rem,1.6vw,0.9rem)] font-semibold text-[rgba(5,5,5,0.6)] [word-break:keep-all]">
              {t.meetup.leaderboards.celebration.subtitle}
            </p>

            {celebrations.length > 0 ? (
              <div className="flex snap-x snap-mandatory gap-[clamp(0.75rem,2vw,1rem)] overflow-x-auto px-[0.25rem] pt-[0.4rem] pb-[1.1rem] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(5,5,5,0.22)]">
                {celebrations.map((celebration, index) => (
                  <article
                    key={celebration.id}
                    className="relative flex w-[clamp(13rem,60vw,15rem)] flex-none snap-start flex-col rounded-[14px] border-2 border-[#050505] bg-white px-4 pt-[1.1rem] pb-4 shadow-[4px_4px_0_rgba(5,5,5,0.88)]"
                  >
                    {isAdmin && (
                      <>
                        <div className="absolute top-[0.55rem] left-[0.55rem] z-[1] flex gap-[0.3rem]">
                          <button
                            type="button"
                            className={celebrationReorderButtonClass}
                            aria-label="앞으로 이동"
                            disabled={index === 0}
                            onClick={() => handleMoveCelebration(index, -1)}
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            className={celebrationReorderButtonClass}
                            aria-label="뒤로 이동"
                            disabled={index === celebrations.length - 1}
                            onClick={() => handleMoveCelebration(index, 1)}
                          >
                            ›
                          </button>
                        </div>
                        <button
                          type="button"
                          className="absolute top-[0.55rem] right-[0.55rem] cursor-pointer rounded-full border-[1.5px] border-[#050505] bg-white px-[0.6rem] py-[0.2rem] text-[0.72rem] font-extrabold text-[#050505] hover:bg-[#f47a4a]"
                          onClick={() => handleEditCelebration(celebration)}
                        >
                          {t.meetup.leaderboards.celebration.edit}
                        </button>
                      </>
                    )}
                    {celebration.logoUrl && (
                      <div className="mb-[0.85rem] w-full rounded-[10px] bg-transparent">
                        <img
                          className="block h-auto w-full object-contain"
                          src={celebration.logoUrl}
                          alt={celebration.headline}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <span className="text-[0.82rem] font-[750] text-[rgba(5,5,5,0.6)]">
                      {celebration.memberName}
                    </span>
                    <strong className="mt-[0.18rem] mb-[0.4rem] block text-[clamp(1rem,2.4vw,1.12rem)] font-[950] leading-[1.3] text-[#050505] [word-break:keep-all]">
                      {celebration.headline}
                    </strong>
                    {celebration.description && (
                      <p className="m-0 text-[0.85rem] font-semibold leading-[1.5] text-[rgba(5,5,5,0.68)] [word-break:keep-all]">
                        {celebration.description}
                      </p>
                    )}
                    {celebration.achievedAt && (
                      <span className="mt-[0.7rem] text-[0.78rem] font-bold tabular-nums text-[rgba(5,5,5,0.48)]">
                        {formatAchievedAt(celebration.achievedAt)}
                      </span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className={emptyStateClass}>
                {t.meetup.leaderboards.celebration.empty}
              </div>
            )}
          </section>
        )}

        {!loading && !error && leaderboards && (
          <section className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-[clamp(0.85rem,1.8vw,1.1rem)] max-[768px]:grid-cols-1">
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
          </section>
        )}
      </div>

      {showCelebrationEditor && (
        <CelebrationEditor
          celebration={editingCelebration}
          onSave={handleSaveCelebration}
          onClose={() => setShowCelebrationEditor(false)}
          onDelete={editingCelebration ? handleDeleteCelebration : undefined}
        />
      )}
    </div>
  );
}
