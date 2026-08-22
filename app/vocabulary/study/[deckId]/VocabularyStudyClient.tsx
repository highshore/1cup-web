"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  LightBulbIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { appLayout } from "../../../lib/constants/app_layout";
import { useI18n } from "../../../lib/i18n/I18nProvider";

type StudyAlgorithm = "fsrs" | "anki_legacy" | "leitner";
type QueueStrategy = "due_first" | "frequency";
type StudyRating = "again" | "hard" | "good" | "easy";
type StudyState = "new" | "learning" | "review" | "relearning";

type StudyPreferences = {
  algorithm: StudyAlgorithm;
  queueStrategy: QueueStrategy;
  desiredRetention: number;
  dailyNewLimit: number;
  dailyReviewLimit: number;
  maximumIntervalDays: number;
  enableFuzz: boolean;
  learningSteps: string[];
  relearningSteps: string[];
};

type StudyCard = {
  id: string;
  version: number;
  entryId: string;
  meaningId: string | null;
  term: string;
  entryType: "word" | "expression";
  grammarType: string | null;
  pronunciationIpa: string | null;
  definitionEn: string;
  definitionKo: string | null;
  state: StudyState;
  dueAt: string;
  reviewCount: number;
  lapseCount: number;
  previews: Record<StudyRating, { dueAt: string; intervalSeconds: number }>;
};

type QueueResponse = {
  deck: {
    id: string;
    name: string;
    description: string;
    icon: string;
    theme: string;
    visibility: string;
    is_official: boolean;
    item_count: number;
  };
  preferences: StudyPreferences;
  counts: { new: number; learning: number; review: number; due: number; total: number };
  cards: StudyCard[];
};

const copyByLocale = {
  ko: {
    back: "모음집으로",
    showAnswer: "정답 보기",
    thinkFirst: "뜻을 먼저 떠올린 뒤 정답을 확인해 보세요.",
    keyboardBefore: "Space / Enter로 정답 보기",
    keyboardAfter: "키보드 1–4로 평가할 수 있어요.",
    again: "다시",
    hard: "어려움",
    good: "좋음",
    easy: "쉬움",
    new: "새 카드",
    learning: "학습 중",
    review: "복습",
    settings: "학습 설정",
    settingsHint: "스케줄러를 바꿔도 알고리즘별 학습 기록은 따로 보존됩니다.",
    algorithm: "스케줄러",
    fsrs: "FSRS",
    fsrsDesc: "현재 Anki 방식에 가장 가까운 기억 모델. 기본 추천.",
    legacy: "Anki Legacy",
    legacyDesc: "기존 Voca Drink의 1분/10분 학습 단계와 ease 기반 방식.",
    leitner: "Leitner",
    leitnerDesc: "기존 Voca Drink의 3-box 방식. 1일 / 3일 / 5일 간격.",
    queue: "카드 선택 방식",
    dueFirst: "복습일 우선",
    frequency: "Fibonacci Mix 13:8:5",
    retention: "목표 기억률",
    retentionHint: "높을수록 더 자주 복습합니다. FSRS 기본값은 90%입니다.",
    newLimit: "세션당 새 카드",
    reviewLimit: "세션당 복습 카드",
    fuzz: "간격에 작은 랜덤 편차 적용",
    saveSettings: "설정 저장",
    cancel: "취소",
    loading: "학습 카드를 준비하고 있어요...",
    loadError: "학습 카드를 불러오지 못했습니다.",
    retry: "다시 시도",
    empty: "이 모음집에는 아직 학습할 카드가 없습니다.",
    done: "이 모음집의 현재 학습을 마쳤어요!",
    doneHint: "지금 복습할 카드는 모두 처리했습니다.",
    checkAgain: "복습 카드 다시 확인",
    reviewed: "개 학습",
    nextReview: "다음 예정",
    noDefinition: "아직 뜻 정보가 준비되지 않았습니다.",
    schedulerChanged: "스케줄러가 변경되어 학습 큐를 새로 불러옵니다.",
    reviewError: "복습 결과를 저장하지 못했습니다.",
    progress: "진행률",
  },
  en: {
    back: "Back to deck",
    showAnswer: "Show answer",
    thinkFirst: "Recall the meaning first, then reveal the answer.",
    keyboardBefore: "Space / Enter to show answer",
    keyboardAfter: "Use keys 1–4 to grade your recall.",
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
    new: "New",
    learning: "Learning",
    review: "Review",
    settings: "Study settings",
    settingsHint: "Each scheduler keeps its own progress, so switching algorithms does not erase another scheduler's history.",
    algorithm: "Scheduler",
    fsrs: "FSRS",
    fsrsDesc: "Modern memory model closest to current Anki. Recommended default.",
    legacy: "Anki Legacy",
    legacyDesc: "The original Voca Drink 1m/10m learning steps and ease-based scheduler.",
    leitner: "Leitner",
    leitnerDesc: "The original Voca Drink 3-box scheduler with 1d / 3d / 5d intervals.",
    queue: "Queue strategy",
    dueFirst: "Due first",
    frequency: "Fibonacci Mix 13:8:5",
    retention: "Desired retention",
    retentionHint: "Higher retention means more reviews. FSRS defaults to 90%.",
    newLimit: "New cards per session",
    reviewLimit: "Review cards per session",
    fuzz: "Apply small interval fuzz",
    saveSettings: "Save settings",
    cancel: "Cancel",
    loading: "Preparing your study cards...",
    loadError: "We could not load the study queue.",
    retry: "Try again",
    empty: "This deck does not have any study cards yet.",
    done: "You're done with this deck for now!",
    doneHint: "You have cleared the cards that are ready to study.",
    checkAgain: "Check due cards again",
    reviewed: "reviewed",
    nextReview: "Next due",
    noDefinition: "A definition is not available yet.",
    schedulerChanged: "The scheduler changed, so the study queue will be refreshed.",
    reviewError: "We could not save that review.",
    progress: "Progress",
  },
} as const;

const Page = styled.main`
  width: 100%;
  min-height: 100vh;
  background: transparent;
  padding: 1rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 768px) {
    padding: 0.75rem ${appLayout.pageGutterMobile} 3rem;
  }
`;

const Shell = styled.div`
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.8rem;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 850;
  text-decoration: none;
  svg { width: 17px; height: 17px; }
`;

const IconButton = styled.button`
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 50%;
  background: #ffffff;
  color: #050505;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  svg { width: 18px; height: 18px; }
`;

const Header = styled.section`
  border: 2px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  padding: 0.95rem 1rem;
  box-shadow: 3px 3px 0 #050505;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
`;

const DeckTitle = styled.h1`
  margin: 0;
  color: #050505;
  font-size: clamp(1.35rem, 4vw, 1.8rem);
  font-weight: 950;
`;

const AlgorithmBadge = styled.span`
  flex: 0 0 auto;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.28rem 0.5rem;
  color: #050505;
  font-size: 0.66rem;
  font-weight: 900;
`;

const CountRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
`;

const Count = styled.span`
  border: 1px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.25rem 0.48rem;
  color: rgba(5,5,5,0.68);
  font-size: 0.67rem;
  font-weight: 850;
  strong { color: #050505; font-weight: 950; }
`;

const ProgressWrap = styled.div`
  margin: 0.95rem 0 1rem;
`;

const ProgressMeta = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.3rem;
  color: rgba(5, 5, 5, 0.55);
  font-size: 0.68rem;
  font-weight: 800;
`;

const ProgressTrack = styled.div`
  height: 10px;
  overflow: hidden;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
`;

const ProgressFill = styled.div<{ $value: number }>`
  width: ${(p) => `${Math.max(0, Math.min(100, p.$value))}%`};
  height: 100%;
  background: #f47a4a;
  transition: width 180ms ease;
`;

const FlashCard = styled.section`
  min-height: 390px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 2px solid #050505;
  border-radius: 20px;
  background: #ffffff;
  padding: clamp(1.15rem, 4vw, 1.9rem);
  box-shadow: 5px 5px 0 #050505;
`;

const StateBadge = styled.span`
  display: inline-flex;
  border: 1px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.22rem 0.45rem;
  color: #050505;
  font-size: 0.6rem;
  font-weight: 950;
`;

const Term = styled.h2`
  margin: 1.35rem 0 0;
  color: #050505;
  font-size: clamp(2.1rem, 8vw, 4rem);
  line-height: 1.04;
  text-align: center;
  font-weight: 950;
  overflow-wrap: anywhere;
`;

const Badges = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.75rem;
`;

const Badge = styled.span`
  border: 1px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.22rem 0.43rem;
  color: #050505;
  font-size: 0.64rem;
  font-weight: 850;
`;

const Prompt = styled.p`
  margin: 1rem auto 0;
  max-width: 520px;
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.8rem;
  line-height: 1.55;
  text-align: center;
`;

const Answer = styled.div`
  margin-top: 1.25rem;
  padding-top: 1.05rem;
  border-top: 1px solid rgba(5, 5, 5, 0.18);
`;

const Definition = styled.p`
  margin: 0;
  color: #050505;
  font-size: 1.02rem;
  line-height: 1.62;
  text-align: center;
  font-weight: 650;
`;

const KoreanDefinition = styled.p`
  margin: 0.5rem 0 0;
  color: rgba(5, 5, 5, 0.64);
  font-size: 0.9rem;
  line-height: 1.55;
  text-align: center;
`;

const PrimaryButton = styled.button`
  min-height: 3rem;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #f47a4a;
  color: #050505;
  padding: 0.65rem 1rem;
  font-size: 0.88rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const RatingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  @media (max-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

const RatingButton = styled.button`
  min-height: 4.1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.16rem;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #ffffff;
  color: #050505;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const RatingName = styled.span`
  font-size: 0.8rem;
  font-weight: 950;
`;

const Interval = styled.span`
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.66rem;
  font-weight: 800;
`;

const KeyboardHint = styled.p`
  margin: 0.75rem 0 0;
  color: rgba(5, 5, 5, 0.48);
  font-size: 0.66rem;
  font-weight: 750;
  text-align: center;
`;

const StateBox = styled.div`
  margin-top: 1rem;
  padding: 3rem 1rem;
  border: 2px dashed #050505;
  border-radius: 18px;
  background: #ffffff;
  text-align: center;
  color: rgba(5, 5, 5, 0.62);
  svg { width: 40px; height: 40px; color: #050505; }
  strong { display: block; margin-top: 0.65rem; color: #050505; font-size: 1rem; }
  p { margin: 0.3rem auto 0; max-width: 480px; line-height: 1.5; }
`;

const SecondaryButton = styled.button`
  min-height: 2.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0.48rem 0.7rem;
  font-size: 0.74rem;
  font-weight: 900;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { width: 15px; height: 15px; }
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 1rem;
`;

const Modal = styled.div`
  width: min(620px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  border: 2px solid #050505;
  border-radius: 18px;
  background: #ffffff;
  padding: 1.1rem;
  box-shadow: 7px 7px 0 #050505;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1.2rem;
  font-weight: 950;
`;

const ModalHint = styled.p`
  margin: 0.25rem 0 0;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.76rem;
  line-height: 1.45;
`;

const Field = styled.label`
  display: block;
  margin-top: 0.9rem;
  color: #050505;
  font-size: 0.76rem;
  font-weight: 950;
`;

const ChoiceGrid = styled.div`
  display: grid;
  gap: 0.5rem;
  margin-top: 0.4rem;
`;

const Choice = styled.button<{ $active: boolean }>`
  width: 100%;
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${(p) => (p.$active ? "#f5f5f5" : "#ffffff")};
  padding: 0.7rem;
  color: #050505;
  text-align: left;
  cursor: pointer;
  strong { display: block; font-size: 0.8rem; font-weight: 950; }
  span { display: block; margin-top: 0.18rem; color: rgba(5,5,5,0.6); font-size: 0.7rem; line-height: 1.4; }
`;

const Select = styled.select`
  width: 100%;
  margin-top: 0.35rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.65rem;
  color: #050505;
  font-size: 0.8rem;
  font-weight: 850;
`;

const NumberInput = styled.input`
  width: 100%;
  margin-top: 0.35rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.65rem;
  color: #050505;
  font-size: 0.8rem;
  font-weight: 800;
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.9rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.65rem;
  color: #050505;
  font-size: 0.74rem;
  font-weight: 850;
  input { width: 18px; height: 18px; accent-color: #f47a4a; }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
`;

function formatInterval(seconds: number, locale: "ko" | "en") {
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return locale === "ko" ? `${Math.max(1, value)}초` : `${Math.max(1, value)}s`;
  const minutes = Math.round(value / 60);
  if (minutes < 60) return locale === "ko" ? `${minutes}분` : `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale === "ko" ? `${hours}시간` : `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return locale === "ko" ? `${days}일` : `${days}d`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return locale === "ko" ? `${months}개월` : `${months}mo`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return locale === "ko" ? `${years}년` : `${years}y`;
}

function algorithmLabel(algorithm: StudyAlgorithm) {
  if (algorithm === "anki_legacy") return "Anki Legacy";
  if (algorithm === "leitner") return "Leitner";
  return "FSRS";
}

function stateLabel(state: StudyState, locale: "ko" | "en") {
  if (locale === "en") return state.toUpperCase();
  if (state === "learning") return "학습 중";
  if (state === "review") return "복습";
  if (state === "relearning") return "재학습";
  return "새 카드";
}

export default function VocabularyStudyClient({ deckId }: { deckId: string }) {
  const router = useRouter();
  const { locale } = useI18n();
  const copy = copyByLocale[locale];
  const [data, setData] = useState<QueueResponse | null>(null);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<StudyPreferences | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [nextDueAt, setNextDueAt] = useState<string | null>(null);

  const loadQueue = useCallback(async (resetSession = true) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vocabulary/study/queue?deckId=${encodeURIComponent(deckId)}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace(`/auth?redirect=${encodeURIComponent(`/vocabulary/study/${deckId}`)}`);
        return;
      }
      if (!response.ok) throw new Error(`Queue request failed (${response.status})`);
      const payload = (await response.json()) as QueueResponse;
      setData(payload);
      setCards(payload.cards);
      setDraft(payload.preferences);
      setRevealed(false);
      setStartedAt(Date.now());
      if (resetSession) {
        setSessionReviewed(0);
        setSessionTotal(payload.cards.length);
        setNextDueAt(null);
      }
    } catch (loadFailure) {
      console.error("Unable to load vocabulary study queue:", loadFailure);
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, deckId, router]);

  useEffect(() => {
    void loadQueue(true);
  }, [loadQueue]);

  const current = cards[0] ?? null;
  const progress = sessionTotal > 0 ? Math.round((sessionReviewed / sessionTotal) * 100) : cards.length === 0 && sessionReviewed > 0 ? 100 : 0;

  const submitRating = useCallback(async (rating: StudyRating) => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/vocabulary/study/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyCardId: current.id,
          expectedVersion: current.version,
          rating,
          responseTimeMs: Date.now() - startedAt,
        }),
      });
      if (response.status === 409) {
        window.alert(copy.schedulerChanged);
        await loadQueue(true);
        return;
      }
      if (!response.ok) throw new Error(`Review failed (${response.status})`);
      const payload = (await response.json()) as { next?: { dueAt?: string } };
      const due = payload.next?.dueAt;
      if (due) {
        setNextDueAt((existing) => {
          if (!existing) return due;
          return new Date(due).getTime() < new Date(existing).getTime() ? due : existing;
        });
      }
      setCards((existing) => existing.slice(1));
      setSessionReviewed((value) => value + 1);
      setRevealed(false);
      setStartedAt(Date.now());
    } catch (reviewFailure) {
      console.error("Unable to save vocabulary review:", reviewFailure);
      window.alert(copy.reviewError);
    } finally {
      setSubmitting(false);
    }
  }, [copy.reviewError, copy.schedulerChanged, current, loadQueue, startedAt, submitting]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || submitting || !current) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed) return;
      const map: Record<string, StudyRating> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      const rating = map[event.key];
      if (rating) {
        event.preventDefault();
        void submitRating(rating);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, revealed, settingsOpen, submitRating, submitting]);

  const saveSettings = async () => {
    if (!draft) return;
    setSavingSettings(true);
    try {
      const response = await fetch("/api/vocabulary/study/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, ...draft }),
      });
      if (!response.ok) throw new Error(`Preference update failed (${response.status})`);
      setSettingsOpen(false);
      await loadQueue(true);
    } catch (saveFailure) {
      console.error("Unable to save study preferences:", saveFailure);
      window.alert(copy.loadError);
    } finally {
      setSavingSettings(false);
    }
  };

  const nextDueLabel = useMemo(() => {
    if (!nextDueAt) return null;
    const seconds = Math.max(0, Math.round((new Date(nextDueAt).getTime() - Date.now()) / 1000));
    return formatInterval(seconds, locale);
  }, [locale, nextDueAt, sessionReviewed]);

  if (loading && !data) {
    return <Page><Shell><StateBox>{copy.loading}</StateBox></Shell></Page>;
  }

  if (error || !data) {
    return (
      <Page><Shell>
        <StateBox>
          <strong>{error || copy.loadError}</strong>
          <SecondaryButton style={{ marginTop: "0.8rem" }} onClick={() => void loadQueue(true)}>
            <ArrowPathIcon />{copy.retry}
          </SecondaryButton>
        </StateBox>
      </Shell></Page>
    );
  }

  return (
    <Page>
      <Shell>
        <TopRow>
          <BackLink href={`/vocabulary/decks/${deckId}`}><ArrowLeftIcon />{copy.back}</BackLink>
          <IconButton type="button" onClick={() => { setDraft({ ...data.preferences }); setSettingsOpen(true); }} aria-label={copy.settings}>
            <Cog6ToothIcon />
          </IconButton>
        </TopRow>

        <Header>
          <HeaderTop>
            <DeckTitle>{data.deck.icon} {data.deck.name}</DeckTitle>
            <AlgorithmBadge>{algorithmLabel(data.preferences.algorithm)}</AlgorithmBadge>
          </HeaderTop>
          <CountRow>
            <Count>{copy.new} <strong>{data.counts.new}</strong></Count>
            <Count>{copy.learning} <strong>{data.counts.learning}</strong></Count>
            <Count>{copy.review} <strong>{data.counts.review}</strong></Count>
          </CountRow>
        </Header>

        <ProgressWrap>
          <ProgressMeta><span>{copy.progress}</span><span>{sessionReviewed}/{Math.max(sessionTotal, sessionReviewed)}</span></ProgressMeta>
          <ProgressTrack><ProgressFill $value={progress} /></ProgressTrack>
        </ProgressWrap>

        {current ? (
          <>
            <FlashCard>
              <div>
                <StateBadge>{stateLabel(current.state, locale)}</StateBadge>
                <Term>{current.term}</Term>
                <Badges>
                  <Badge>{current.entryType}</Badge>
                  {current.grammarType && <Badge>{current.grammarType}</Badge>}
                  {current.pronunciationIpa && <Badge>{current.pronunciationIpa}</Badge>}
                </Badges>
                {!revealed ? (
                  <Prompt><LightBulbIcon style={{ width: 16, verticalAlign: "middle", marginRight: 4 }} />{copy.thinkFirst}</Prompt>
                ) : (
                  <Answer>
                    <Definition>{current.definitionEn || copy.noDefinition}</Definition>
                    {current.definitionKo && <KoreanDefinition>{current.definitionKo}</KoreanDefinition>}
                  </Answer>
                )}
              </div>

              <div style={{ marginTop: "1.4rem" }}>
                {!revealed ? (
                  <PrimaryButton type="button" onClick={() => setRevealed(true)}>{copy.showAnswer}</PrimaryButton>
                ) : (
                  <RatingGrid>
                    {(["again", "hard", "good", "easy"] as StudyRating[]).map((rating, index) => (
                      <RatingButton key={rating} type="button" disabled={submitting} onClick={() => void submitRating(rating)}>
                        <RatingName>{copy[rating]}</RatingName>
                        <Interval>{formatInterval(current.previews[rating].intervalSeconds, locale)} · {index + 1}</Interval>
                      </RatingButton>
                    ))}
                  </RatingGrid>
                )}
              </div>
            </FlashCard>
            <KeyboardHint>{revealed ? copy.keyboardAfter : copy.keyboardBefore}</KeyboardHint>
          </>
        ) : data.counts.total === 0 ? (
          <StateBox><LightBulbIcon /><strong>{copy.empty}</strong></StateBox>
        ) : (
          <StateBox>
            <CheckCircleIcon />
            <strong>{copy.done}</strong>
            <p>{copy.doneHint}</p>
            <p>{sessionReviewed} {copy.reviewed}{nextDueLabel ? ` · ${copy.nextReview}: ${nextDueLabel}` : ""}</p>
            <SecondaryButton style={{ marginTop: "0.9rem" }} onClick={() => void loadQueue(true)}><ArrowPathIcon />{copy.checkAgain}</SecondaryButton>
          </StateBox>
        )}
      </Shell>

      {settingsOpen && draft && (
        <ModalBackdrop onClick={() => !savingSettings && setSettingsOpen(false)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <div><ModalTitle>{copy.settings}</ModalTitle><ModalHint>{copy.settingsHint}</ModalHint></div>
              <IconButton type="button" onClick={() => setSettingsOpen(false)}><XMarkIcon /></IconButton>
            </ModalHeader>

            <Field>{copy.algorithm}</Field>
            <ChoiceGrid>
              <Choice type="button" $active={draft.algorithm === "fsrs"} onClick={() => setDraft({ ...draft, algorithm: "fsrs", queueStrategy: "due_first" })}>
                <strong>{copy.fsrs}</strong><span>{copy.fsrsDesc}</span>
              </Choice>
              <Choice type="button" $active={draft.algorithm === "anki_legacy"} onClick={() => setDraft({ ...draft, algorithm: "anki_legacy", queueStrategy: "due_first" })}>
                <strong>{copy.legacy}</strong><span>{copy.legacyDesc}</span>
              </Choice>
              <Choice type="button" $active={draft.algorithm === "leitner"} onClick={() => setDraft({ ...draft, algorithm: "leitner" })}>
                <strong>{copy.leitner}</strong><span>{copy.leitnerDesc}</span>
              </Choice>
            </ChoiceGrid>

            <Field>{copy.queue}
              <Select
                value={draft.algorithm === "leitner" ? draft.queueStrategy : "due_first"}
                disabled={draft.algorithm !== "leitner"}
                onChange={(event) => setDraft({ ...draft, queueStrategy: event.target.value as QueueStrategy })}
              >
                <option value="due_first">{copy.dueFirst}</option>
                <option value="frequency">{copy.frequency}</option>
              </Select>
            </Field>

            {draft.algorithm === "fsrs" && (
              <Field>{copy.retention}
                <NumberInput type="number" min="0.70" max="0.99" step="0.01" value={draft.desiredRetention} onChange={(event) => setDraft({ ...draft, desiredRetention: Number(event.target.value) })} />
                <ModalHint>{copy.retentionHint}</ModalHint>
              </Field>
            )}

            <Field>{copy.newLimit}
              <NumberInput type="number" min="0" max="500" value={draft.dailyNewLimit} onChange={(event) => setDraft({ ...draft, dailyNewLimit: Number(event.target.value) })} />
            </Field>
            <Field>{copy.reviewLimit}
              <NumberInput type="number" min="1" max="2000" value={draft.dailyReviewLimit} onChange={(event) => setDraft({ ...draft, dailyReviewLimit: Number(event.target.value) })} />
            </Field>

            {draft.algorithm === "fsrs" && (
              <ToggleRow>{copy.fuzz}
                <input type="checkbox" checked={draft.enableFuzz} onChange={(event) => setDraft({ ...draft, enableFuzz: event.target.checked })} />
              </ToggleRow>
            )}

            <ModalActions>
              <SecondaryButton type="button" onClick={() => setSettingsOpen(false)}>{copy.cancel}</SecondaryButton>
              <PrimaryButton style={{ width: "auto", minHeight: "2.45rem" }} disabled={savingSettings} onClick={() => void saveSettings()}>{copy.saveSettings}</PrimaryButton>
            </ModalActions>
          </Modal>
        </ModalBackdrop>
      )}
    </Page>
  );
}
