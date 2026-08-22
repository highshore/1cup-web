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

type StudyPreview = {
  dueAt: string;
  intervalSeconds: number;
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
  previews: Record<StudyRating, StudyPreview>;
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
  counts: {
    new: number;
    learning: number;
    review: number;
    due: number;
    total: number;
  };
  cards: StudyCard[];
};

const copyByLocale = {
  ko: {
    back: "단어장으로",
    studying: "STUDY",
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
    settingsHint: "스케줄러를 바꿔도 각 알고리즘의 학습 기록은 따로 보존됩니다.",
    algorithm: "스케줄러",
    fsrs: "FSRS",
    fsrsDesc: "현재 Anki 방식에 가장 가까운 기억 모델. 기본 추천.",
    legacy: "Anki Legacy",
    legacyDesc: "기존 Voca Drink의 1분/10분 학습 단계와 ease 기반 스케줄러.",
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
    emptyDeck: "이 덱에는 아직 학습할 카드가 없습니다.",
    done: "오늘 이 덱의 학습을 마쳤어요!",
    doneHint: "지금 복습할 카드는 모두 처리했습니다.",
    checkAgain: "복습 카드 다시 확인",
    reviewed: "개 학습",
    nextReview: "다음 예정",
    noDefinition: "아직 뜻 정보가 준비되지 않았습니다.",
    schedulerChanged: "스케줄러가 변경되어 학습 큐를 새로 불러옵니다.",
    reviewError: "복습 결과를 저장하지 못했습니다.",
    progress: "진행률",
    stateNew: "NEW",
    stateLearning: "LEARNING",
    stateReview: "REVIEW",
    stateRelearning: "RELEARNING",
  },
  en: {
    back: "Back to vocabulary",
    studying: "STUDY",
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
    emptyDeck: "This deck does not have any study cards yet.",
    done: "You're done with this deck for now!",
    doneHint: "You have cleared the cards that are ready to study.",
    checkAgain: "Check due cards again",
    reviewed: "reviewed",
    nextReview: "Next due",
    noDefinition: "A definition is not available yet.",
    schedulerChanged: "The scheduler changed, so the study queue will be refreshed.",
    reviewError: "We could not save that review.",
    progress: "Progress",
    stateNew: "NEW",
    stateLearning: "LEARNING",
    stateReview: "REVIEW",
    stateRelearning: "RELEARNING",
  },
} as const;

const Page = styled.main`
  width: 100%;
  min-height: 100vh;
  background: #faf8f4;
  padding: 1.2rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 768px) {
    padding: 0.8rem ${appLayout.pageGutterMobile} 3rem;
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
  margin-bottom: 1rem;
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
  &:hover { text-decoration: underline; }
`;

const IconButton = styled.button`
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 50%;
  background: #ffffff;
  color: #050505;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;

  svg { width: 19px; height: 19px; }
`;

const HeaderCard = styled.section`
  border: 2px solid #050505;
  border-radius: 18px;
  background: #fff0e8;
  padding: 1rem 1.1rem;
  box-shadow: 4px 4px 0 #050505;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.68rem;
  font-weight: 950;
  letter-spacing: 0.08em;
`;

const DeckTitle = styled.h1`
  margin: 0.35rem 0 0;
  color: #050505;
  font-size: clamp(1.45rem, 4vw, 2rem);
  font-weight: 950;
  line-height: 1.15;
`;

const AlgorithmBadge = styled.span`
  flex: 0 0 auto;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.32rem 0.55rem;
  color: #050505;
  font-size: 0.68rem;
  font-weight: 900;
`;

const CountRow = styled.div`
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-top: 0.85rem;
`;

const CountPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.32rem 0.58rem;
  color: #050505;
  font-size: 0.7rem;
  font-weight: 850;

  strong { font-weight: 950; }
`;

const ProgressWrap = styled.div`
  margin: 1rem 0 1.2rem;
`;

const ProgressMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.7rem;
  font-weight: 850;
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 11px;
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
  padding: clamp(1.2rem, 4vw, 2rem);
  box-shadow: 6px 6px 0 #050505;
`;

const CardState = styled.span`
  display: inline-flex;
  width: fit-content;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #faf8f4;
  padding: 0.28rem 0.5rem;
  font-size: 0.62rem;
  font-weight: 950;
  letter-spacing: 0.05em;
`;

const Term = styled.h2`
  margin: 1.45rem 0 0;
  color: #050505;
  font-size: clamp(2.1rem, 8vw, 4rem);
  font-weight: 950;
  line-height: 1.04;
  text-align: center;
  overflow-wrap: anywhere;
`;

const Badges = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.8rem;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #fff7f2;
  padding: 0.25rem 0.48rem;
  color: #050505;
  font-size: 0.67rem;
  font-weight: 850;
`;

const Prompt = styled.p`
  margin: 1rem auto 0;
  max-width: 520px;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.82rem;
  line-height: 1.55;
  text-align: center;
`;

const Answer = styled.div`
  margin-top: 1.35rem;
  padding-top: 1.15rem;
  border-top: 1.5px solid rgba(5, 5, 5, 0.18);
`;

const Definition = styled.p`
  margin: 0;
  color: #050505;
  font-size: 1.05rem;
  line-height: 1.62;
  text-align: center;
  font-weight: 650;
`;

const KoreanDefinition = styled.p`
  margin: 0.55rem 0 0;
  color: rgba(5, 5, 5, 0.66);
  font-size: 0.92rem;
  line-height: 1.55;
  text-align: center;
`;

const PrimaryButton = styled.button`
  min-height: 3rem;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #f47a4a;
  color: #050505;
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { width: 18px; height: 18px; }
`;

const RatingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const RatingButton = styled.button<{ $rating: StudyRating }>`
  min-height: 4.2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border: 2px solid #050505;
  border-radius: 14px;
  background: ${(p) =>
    p.$rating === "again"
      ? "#fff0ee"
      : p.$rating === "hard"
        ? "#fff7e8"
        : p.$rating === "good"
          ? "#eef8ef"
          : "#eef5ff"};
  color: #050505;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const RatingName = styled.span`
  font-size: 0.82rem;
  font-weight: 950;
`;

const Interval = styled.span`
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.68rem;
  font-weight: 800;
`;

const Key = styled.span`
  margin-top: 0.05rem;
  color: rgba(5, 5, 5, 0.42);
  font-size: 0.6rem;
  font-weight: 850;
`;

const KeyboardHint = styled.p`
  margin: 0.8rem 0 0;
  color: rgba(5, 5, 5, 0.5);
  font-size: 0.68rem;
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

  svg { width: 42px; height: 42px; color: #050505; }
  strong { display: block; margin-top: 0.7rem; color: #050505; font-size: 1.05rem; }
  p { margin: 0.35rem auto 0; max-width: 480px; line-height: 1.5; }
`;

const DoneMeta = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;
`;

const MetaPill = styled.span`
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #fff7f2;
  padding: 0.35rem 0.6rem;
  color: #050505;
  font-size: 0.72rem;
  font-weight: 850;
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
  background: #faf8f4;
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
  font-size: 1.25rem;
  font-weight: 950;
`;

const ModalHint = styled.p`
  margin: 0.25rem 0 0;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.78rem;
  line-height: 1.45;
`;

const Field = styled.label`
  display: block;
  margin-top: 1rem;
  color: #050505;
  font-size: 0.76rem;
  font-weight: 950;
`;

const ChoiceGrid = styled.div`
  display: grid;
  gap: 0.55rem;
  margin-top: 0.45rem;
`;

const AlgorithmChoice = styled.button<{ $active: boolean }>`
  width: 100%;
  border: 2px solid #050505;
  border-radius: 14px;
  background: ${(p) => (p.$active ? "#fff0e8" : "#ffffff")};
  padding: 0.75rem;
  color: #050505;
  text-align: left;
  cursor: pointer;

  strong { display: block; font-size: 0.82rem; font-weight: 950; }
  span { display: block; margin-top: 0.2rem; color: rgba(5,5,5,0.6); font-size: 0.72rem; line-height: 1.4; }
`;

const Select = styled.select`
  width: 100%;
  margin-top: 0.4rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.7rem;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 850;
`;

const NumberInput = styled.input`
  width: 100%;
  margin-top: 0.4rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.7rem;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 800;
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.7rem;
  color: #050505;
  font-size: 0.76rem;
  font-weight: 850;

  input { width: 18px; height: 18px; accent-color: #f47a4a; }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  margin-top: 1rem;
`;

const SecondaryButton = styled.button`
  min-height: 2.55rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  color: #050505;
  padding: 0.55rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 900;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { width: 16px; height: 16px; }
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
  const [savingSettings, setSavingSettings] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState<StudyPreferences | null>(null);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [cardStartedAt, setCardStartedAt] = useState(() => Date.now());
  const [nextDueAt, setNextDueAt] = useState<string | null>(null);

  const loadQueue = useCallback(async (resetSession = true) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/vocabulary/study/queue?deckId=${encodeURIComponent(deckId)}`,
        { cache: "no-store" },
      );
      if (response.status === 401) {
        router.replace(`/auth?redirect=${encodeURIComponent(`/vocabulary/study/${deckId}`)}`);
        return;
      }
      if (!response.ok) throw new Error(`Queue request failed (${response.status})`);
      const payload = (await response.json()) as QueueResponse;
      setData(payload);
      setCards(payload.cards);
      setDraftPreferences(payload.preferences);
      setRevealed(false);
      setCardStartedAt(Date.now());
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

  const currentCard = cards[0] ?? null;
  const progress = sessionTotal > 0
    ? Math.round((sessionReviewed / sessionTotal) * 100)
    : cards.length === 0 && sessionReviewed > 0
      ? 100
      : 0;

  const stateLabel = useCallback((state: StudyState) => {
    if (state === "learning") return copy.stateLearning;
    if (state === "review") return copy.stateReview;
    if (state === "relearning") return copy.stateRelearning;
    return copy.stateNew;
  }, [copy]);

  const submitRating = useCallback(async (rating: StudyRating) => {
    if (!currentCard || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/vocabulary/study/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyCardId: currentCard.id,
          expectedVersion: currentCard.version,
          rating,
          responseTimeMs: Date.now() - cardStartedAt,
        }),
      });

      if (response.status === 409) {
        window.alert(copy.schedulerChanged);
        await loadQueue(true);
        return;
      }
      if (!response.ok) throw new Error(`Review failed (${response.status})`);
      const payload = (await response.json()) as {
        next?: { dueAt?: string; intervalSeconds?: number };
      };
      const due = payload.next?.dueAt;
      if (due) {
        setNextDueAt((current) => {
          if (!current) return due;
          return new Date(due).getTime() < new Date(current).getTime() ? due : current;
        });
      }
      setCards((current) => current.slice(1));
      setSessionReviewed((value) => value + 1);
      setRevealed(false);
      setCardStartedAt(Date.now());
    } catch (reviewFailure) {
      console.error("Unable to save vocabulary review:", reviewFailure);
      window.alert(copy.reviewError);
    } finally {
      setSubmitting(false);
    }
  }, [cardStartedAt, copy.reviewError, copy.schedulerChanged, currentCard, loadQueue, submitting]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || submitting || !currentCard) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed) return;
      const ratingMap: Record<string, StudyRating> = {
        "1": "again",
        "2": "hard",
        "3": "good",
        "4": "easy",
      };
      const rating = ratingMap[event.key];
      if (rating) {
        event.preventDefault();
        void submitRating(rating);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentCard, revealed, settingsOpen, submitRating, submitting]);

  const openSettings = () => {
    if (!data) return;
    setDraftPreferences({ ...data.preferences });
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (!draftPreferences) return;
    setSavingSettings(true);
    try {
      const response = await fetch("/api/vocabulary/study/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, ...draftPreferences }),
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
      <Page>
        <Shell>
          <StateBox>
            <strong>{error || copy.loadError}</strong>
            <SecondaryButton style={{ marginTop: "0.8rem" }} onClick={() => void loadQueue(true)}>
              <ArrowPathIcon />{copy.retry}
            </SecondaryButton>
          </StateBox>
        </Shell>
      </Page>
    );
  }

  return (
    <Page>
      <Shell>
        <TopRow>
          <BackLink href="/vocabulary"><ArrowLeftIcon />{copy.back}</BackLink>
          <IconButton type="button" onClick={openSettings} aria-label={copy.settings}>
            <Cog6ToothIcon />
          </IconButton>
        </TopRow>

        <HeaderCard>
          <HeaderTop>
            <div>
              <Eyebrow>{data.deck.icon} {copy.studying}</Eyebrow>
              <DeckTitle>{data.deck.name}</DeckTitle>
            </div>
            <AlgorithmBadge>{algorithmLabel(data.preferences.algorithm)}</AlgorithmBadge>
          </HeaderTop>
          <CountRow>
            <CountPill>{copy.new} <strong>{data.counts.new}</strong></CountPill>
            <CountPill>{copy.learning} <strong>{data.counts.learning}</strong></CountPill>
            <CountPill>{copy.review} <strong>{data.counts.review}</strong></CountPill>
          </CountRow>
        </HeaderCard>

        <ProgressWrap>
          <ProgressMeta>
            <span>{copy.progress}</span>
            <span>{sessionReviewed}/{Math.max(sessionTotal, sessionReviewed)}</span>
          </ProgressMeta>
          <ProgressTrack><ProgressFill $value={progress} /></ProgressTrack>
        </ProgressWrap>

        {currentCard ? (
          <>
            <FlashCard>
              <div>
                <CardState>{stateLabel(currentCard.state)}</CardState>
                <Term>{currentCard.term}</Term>
                <Badges>
                  <Badge>{currentCard.entryType}</Badge>
                  {currentCard.grammarType && <Badge>{currentCard.grammarType}</Badge>}
                  {currentCard.pronunciationIpa && <Badge>{currentCard.pronunciationIpa}</Badge>}
                </Badges>
                {!revealed ? (
                  <Prompt><LightBulbIcon style={{ width: 16, verticalAlign: "middle", marginRight: 4 }} />{copy.thinkFirst}</Prompt>
                ) : (
                  <Answer>
                    <Definition>{currentCard.definitionEn || copy.noDefinition}</Definition>
                    {currentCard.definitionKo && <KoreanDefinition>{currentCard.definitionKo}</KoreanDefinition>}
                  </Answer>
                )}
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                {!revealed ? (
                  <PrimaryButton type="button" onClick={() => setRevealed(true)}>{copy.showAnswer}</PrimaryButton>
                ) : (
                  <RatingGrid>
                    {(["again", "hard", "good", "easy"] as StudyRating[]).map((rating, index) => (
                      <RatingButton
                        key={rating}
                        type="button"
                        $rating={rating}
                        disabled={submitting}
                        onClick={() => void submitRating(rating)}
                      >
                        <RatingName>{copy[rating]}</RatingName>
                        <Interval>{formatInterval(currentCard.previews[rating].intervalSeconds, locale)}</Interval>
                        <Key>{index + 1}</Key>
                      </RatingButton>
                    ))}
                  </RatingGrid>
                )}
              </div>
            </FlashCard>
            <KeyboardHint>{revealed ? copy.keyboardAfter : copy.keyboardBefore}</KeyboardHint>
          </>
        ) : data.counts.total === 0 ? (
          <StateBox>
            <LightBulbIcon />
            <strong>{copy.emptyDeck}</strong>
          </StateBox>
        ) : (
          <StateBox>
            <CheckCircleIcon />
            <strong>{copy.done}</strong>
            <p>{copy.doneHint}</p>
            <DoneMeta>
              <MetaPill>{sessionReviewed} {copy.reviewed}</MetaPill>
              {nextDueLabel && <MetaPill>{copy.nextReview}: {nextDueLabel}</MetaPill>}
            </DoneMeta>
            <SecondaryButton style={{ marginTop: "1rem" }} onClick={() => void loadQueue(true)}>
              <ArrowPathIcon />{copy.checkAgain}
            </SecondaryButton>
          </StateBox>
        )}
      </Shell>

      {settingsOpen && draftPreferences && (
        <ModalBackdrop onClick={() => !savingSettings && setSettingsOpen(false)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <div><ModalTitle>{copy.settings}</ModalTitle><ModalHint>{copy.settingsHint}</ModalHint></div>
              <IconButton type="button" onClick={() => setSettingsOpen(false)}><XMarkIcon /></IconButton>
            </ModalHeader>

            <Field>{copy.algorithm}</Field>
            <ChoiceGrid>
              <AlgorithmChoice type="button" $active={draftPreferences.algorithm === "fsrs"} onClick={() => setDraftPreferences((current) => current ? { ...current, algorithm: "fsrs", queueStrategy: "due_first" } : current)}>
                <strong>{copy.fsrs}</strong><span>{copy.fsrsDesc}</span>
              </AlgorithmChoice>
              <AlgorithmChoice type="button" $active={draftPreferences.algorithm === "anki_legacy"} onClick={() => setDraftPreferences((current) => current ? { ...current, algorithm: "anki_legacy", queueStrategy: "due_first" } : current)}>
                <strong>{copy.legacy}</strong><span>{copy.legacyDesc}</span>
              </AlgorithmChoice>
              <AlgorithmChoice type="button" $active={draftPreferences.algorithm === "leitner"} onClick={() => setDraftPreferences((current) => current ? { ...current, algorithm: "leitner" } : current)}>
                <strong>{copy.leitner}</strong><span>{copy.leitnerDesc}</span>
              </AlgorithmChoice>
            </ChoiceGrid>

            <Field>{copy.queue}
              <Select
                value={draftPreferences.algorithm === "leitner" ? draftPreferences.queueStrategy : "due_first"}
                disabled={draftPreferences.algorithm !== "leitner"}
                onChange={(event) => setDraftPreferences((current) => current ? { ...current, queueStrategy: event.target.value as QueueStrategy } : current)}
              >
                <option value="due_first">{copy.dueFirst}</option>
                <option value="frequency">{copy.frequency}</option>
              </Select>
            </Field>

            {draftPreferences.algorithm === "fsrs" && (
              <Field>{copy.retention}
                <NumberInput
                  type="number"
                  min="0.70"
                  max="0.99"
                  step="0.01"
                  value={draftPreferences.desiredRetention}
                  onChange={(event) => setDraftPreferences((current) => current ? { ...current, desiredRetention: Number(event.target.value) } : current)}
                />
                <ModalHint>{copy.retentionHint}</ModalHint>
              </Field>
            )}

            <Field>{copy.newLimit}
              <NumberInput
                type="number"
                min="0"
                max="500"
                value={draftPreferences.dailyNewLimit}
                onChange={(event) => setDraftPreferences((current) => current ? { ...current, dailyNewLimit: Number(event.target.value) } : current)}
              />
            </Field>
            <Field>{copy.reviewLimit}
              <NumberInput
                type="number"
                min="1"
                max="2000"
                value={draftPreferences.dailyReviewLimit}
                onChange={(event) => setDraftPreferences((current) => current ? { ...current, dailyReviewLimit: Number(event.target.value) } : current)}
              />
            </Field>

            {draftPreferences.algorithm === "fsrs" && (
              <ToggleRow>{copy.fuzz}
                <input
                  type="checkbox"
                  checked={draftPreferences.enableFuzz}
                  onChange={(event) => setDraftPreferences((current) => current ? { ...current, enableFuzz: event.target.checked } : current)}
                />
              </ToggleRow>
            )}

            <ModalActions>
              <SecondaryButton type="button" onClick={() => setSettingsOpen(false)}>{copy.cancel}</SecondaryButton>
              <PrimaryButton style={{ width: "auto", minHeight: "2.55rem" }} disabled={savingSettings} onClick={() => void saveSettings()}>{copy.saveSettings}</PrimaryButton>
            </ModalActions>
          </Modal>
        </ModalBackdrop>
      )}
    </Page>
  );
}
