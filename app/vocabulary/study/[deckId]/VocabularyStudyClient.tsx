"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  LightBulbIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

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

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="w-full min-h-screen bg-transparent pt-4 px-gutter pb-16 max-[768px]:pt-3 max-[768px]:px-gutter-mobile max-[768px]:pb-12">
      {children}
    </main>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[860px] mx-auto">{children}</div>;
}

function IconButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="w-[38px] h-[38px] inline-flex items-center justify-center border-2 border-[#050505] rounded-full bg-white text-[#050505] cursor-pointer shadow-[2px_2px_0_#050505] [&_svg]:w-[18px] [&_svg]:h-[18px]"
      {...rest}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: ReactNode }) {
  return (
    <span className="border border-[#050505] rounded-full bg-white py-1 px-[0.48rem] text-[rgba(5,5,5,0.68)] text-[0.67rem] font-[850] [&_strong]:text-[#050505] [&_strong]:font-[950]">
      {children}
    </span>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="border border-[#050505] rounded-full bg-white py-[0.22rem] px-[0.43rem] text-[#050505] text-[0.64rem] font-[850]">
      {children}
    </span>
  );
}

function PrimaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="min-h-12 w-full inline-flex items-center justify-center border-2 border-[#050505] rounded-[14px] bg-[#f47a4a] text-[#050505] py-[0.65rem] px-4 text-[0.88rem] font-[950] cursor-pointer shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed"
      {...rest}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="min-h-[2.45rem] inline-flex items-center justify-center gap-[0.35rem] border-[1.5px] border-[#050505] rounded-full bg-white text-[#050505] py-[0.48rem] px-[0.7rem] text-[0.74rem] font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:w-[15px] [&_svg]:h-[15px]"
      {...rest}
    >
      {children}
    </button>
  );
}

function StateBox({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="mt-4 py-12 px-4 border-2 border-dashed border-[#050505] rounded-[18px] bg-white text-center text-[rgba(5,5,5,0.62)] [&_svg]:w-10 [&_svg]:h-10 [&_svg]:text-[#050505] [&_strong]:block [&_strong]:mt-[0.65rem] [&_strong]:text-[#050505] [&_strong]:text-[1rem] [&_p]:mt-[0.3rem] [&_p]:mb-0 [&_p]:mx-auto [&_p]:max-w-[480px] [&_p]:leading-[1.5]"
      {...rest}
    >
      {children}
    </div>
  );
}

function ModalHint({ children }: { children: ReactNode }) {
  return <p className="mt-[0.25rem] mb-0 text-[rgba(5,5,5,0.58)] text-[0.76rem] leading-[1.45]">{children}</p>;
}

function Field({ children }: { children: ReactNode }) {
  return <label className="block mt-[0.9rem] text-[#050505] text-[0.76rem] font-[950]">{children}</label>;
}

function Choice({
  $active,
  children,
  ...rest
}: { $active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full border-2 border-[#050505] rounded-xl ${$active ? "bg-[#f5f5f5]" : "bg-white"} p-[0.7rem] text-[#050505] text-left cursor-pointer [&_strong]:block [&_strong]:text-[0.8rem] [&_strong]:font-[950] [&_span]:block [&_span]:mt-[0.18rem] [&_span]:text-[rgba(5,5,5,0.6)] [&_span]:text-[0.7rem] [&_span]:leading-[1.4]`}
      {...rest}
    >
      {children}
    </button>
  );
}

function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full mt-[0.35rem] border-2 border-[#050505] rounded-xl bg-white p-[0.65rem] text-[#050505] text-[0.8rem] font-extrabold"
      {...props}
    />
  );
}

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
        <div className="flex items-center justify-between gap-3 mb-[0.8rem]">
          <Link
            href={`/vocabulary/decks/${deckId}`}
            className="inline-flex items-center gap-[0.35rem] text-[#050505] text-[0.82rem] font-[850] no-underline [&_svg]:w-[17px] [&_svg]:h-[17px]"
          ><ArrowLeftIcon />{copy.back}</Link>
          <IconButton type="button" onClick={() => { setDraft({ ...data.preferences }); setSettingsOpen(true); }} aria-label={copy.settings}>
            <Cog6ToothIcon />
          </IconButton>
        </div>

        <section className="border-2 border-[#050505] rounded-2xl bg-white py-[0.95rem] px-4 shadow-[3px_3px_0_#050505]">
          <div className="flex items-start justify-between gap-[0.8rem]">
            <h1 className="m-0 text-[#050505] text-[clamp(1.35rem,4vw,1.8rem)] font-[950]">{data.deck.icon} {data.deck.name}</h1>
            <span className="flex-none border-[1.5px] border-[#050505] rounded-full bg-white py-[0.28rem] px-2 text-[#050505] text-[0.66rem] font-black">{algorithmLabel(data.preferences.algorithm)}</span>
          </div>
          <div className="flex flex-wrap gap-[0.4rem] mt-[0.7rem]">
            <Count>{copy.new} <strong>{data.counts.new}</strong></Count>
            <Count>{copy.learning} <strong>{data.counts.learning}</strong></Count>
            <Count>{copy.review} <strong>{data.counts.review}</strong></Count>
          </div>
        </section>

        <div className="mt-[0.95rem] mb-4">
          <div className="flex justify-between mb-[0.3rem] text-[rgba(5,5,5,0.55)] text-[0.68rem] font-extrabold"><span>{copy.progress}</span><span>{sessionReviewed}/{Math.max(sessionTotal, sessionReviewed)}</span></div>
          <div className="h-[10px] overflow-hidden border-[1.5px] border-[#050505] rounded-full bg-white">
            <div
              className="h-full bg-[#f47a4a] [transition:width_180ms_ease]"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>

        {current ? (
          <>
            <section className="min-h-[390px] flex flex-col justify-between border-2 border-[#050505] rounded-[20px] bg-white p-[clamp(1.15rem,4vw,1.9rem)] shadow-[5px_5px_0_#050505]">
              <div>
                <span className="inline-flex border border-[#050505] rounded-full bg-white py-[0.22rem] px-[0.45rem] text-[#050505] text-[0.6rem] font-[950]">{stateLabel(current.state, locale)}</span>
                <h2 className="mt-[1.35rem] mb-0 text-[#050505] text-[clamp(2.1rem,8vw,4rem)] leading-[1.04] text-center font-[950] [overflow-wrap:anywhere]">{current.term}</h2>
                <div className="flex justify-center flex-wrap gap-[0.35rem] mt-3">
                  <Badge>{current.entryType}</Badge>
                  {current.grammarType && <Badge>{current.grammarType}</Badge>}
                  {current.pronunciationIpa && <Badge>{current.pronunciationIpa}</Badge>}
                </div>
                {!revealed ? (
                  <p className="mt-4 mb-0 mx-auto max-w-[520px] text-[rgba(5,5,5,0.56)] text-[0.8rem] leading-[1.55] text-center"><LightBulbIcon style={{ width: 16, verticalAlign: "middle", marginRight: 4 }} />{copy.thinkFirst}</p>
                ) : (
                  <div className="mt-5 pt-[1.05rem] border-t border-t-[rgba(5,5,5,0.18)]">
                    <p className="m-0 text-[#050505] text-[1.02rem] leading-[1.62] text-center font-[650]">{current.definitionEn || copy.noDefinition}</p>
                    {current.definitionKo && <p className="mt-2 mb-0 text-[rgba(5,5,5,0.64)] text-[0.9rem] leading-[1.55] text-center">{current.definitionKo}</p>}
                  </div>
                )}
              </div>

              <div style={{ marginTop: "1.4rem" }}>
                {!revealed ? (
                  <PrimaryButton type="button" onClick={() => setRevealed(true)}>{copy.showAnswer}</PrimaryButton>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-[640px]:grid-cols-2">
                    {(["again", "hard", "good", "easy"] as StudyRating[]).map((rating, index) => (
                      <button
                        key={rating}
                        type="button"
                        className="min-h-[4.1rem] flex flex-col items-center justify-center gap-[0.16rem] border-2 border-[#050505] rounded-[14px] bg-white text-[#050505] cursor-pointer shadow-[2px_2px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={submitting}
                        onClick={() => void submitRating(rating)}
                      >
                        <span className="text-[0.8rem] font-[950]">{copy[rating]}</span>
                        <span className="text-[rgba(5,5,5,0.58)] text-[0.66rem] font-extrabold">{formatInterval(current.previews[rating].intervalSeconds, locale)} · {index + 1}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <p className="mt-3 mb-0 text-[rgba(5,5,5,0.48)] text-[0.66rem] font-[750] text-center">{revealed ? copy.keyboardAfter : copy.keyboardBefore}</p>
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
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.55)] p-4"
          onClick={() => !savingSettings && setSettingsOpen(false)}
        >
          <div
            className="w-[min(620px,100%)] max-h-[90vh] overflow-y-auto border-2 border-[#050505] rounded-[18px] bg-white p-[1.1rem] shadow-[7px_7px_0_#050505]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="m-0 text-[#050505] text-[1.2rem] font-[950]">{copy.settings}</h2><ModalHint>{copy.settingsHint}</ModalHint></div>
              <IconButton type="button" onClick={() => setSettingsOpen(false)}><XMarkIcon /></IconButton>
            </div>

            <Field>{copy.algorithm}</Field>
            <div className="grid gap-2 mt-[0.4rem]">
              <Choice type="button" $active={draft.algorithm === "fsrs"} onClick={() => setDraft({ ...draft, algorithm: "fsrs", queueStrategy: "due_first" })}>
                <strong>{copy.fsrs}</strong><span>{copy.fsrsDesc}</span>
              </Choice>
              <Choice type="button" $active={draft.algorithm === "anki_legacy"} onClick={() => setDraft({ ...draft, algorithm: "anki_legacy", queueStrategy: "due_first" })}>
                <strong>{copy.legacy}</strong><span>{copy.legacyDesc}</span>
              </Choice>
              <Choice type="button" $active={draft.algorithm === "leitner"} onClick={() => setDraft({ ...draft, algorithm: "leitner" })}>
                <strong>{copy.leitner}</strong><span>{copy.leitnerDesc}</span>
              </Choice>
            </div>

            <Field>{copy.queue}
              <select
                className="w-full mt-[0.35rem] border-2 border-[#050505] rounded-xl bg-white p-[0.65rem] text-[#050505] text-[0.8rem] font-[850]"
                value={draft.algorithm === "leitner" ? draft.queueStrategy : "due_first"}
                disabled={draft.algorithm !== "leitner"}
                onChange={(event) => setDraft({ ...draft, queueStrategy: event.target.value as QueueStrategy })}
              >
                <option value="due_first">{copy.dueFirst}</option>
                <option value="frequency">{copy.frequency}</option>
              </select>
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
              <label className="flex items-center justify-between gap-4 mt-[0.9rem] border-2 border-[#050505] rounded-xl bg-white p-[0.65rem] text-[#050505] text-[0.74rem] font-[850] [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:accent-[#f47a4a]">{copy.fuzz}
                <input type="checkbox" checked={draft.enableFuzz} onChange={(event) => setDraft({ ...draft, enableFuzz: event.target.checked })} />
              </label>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <SecondaryButton type="button" onClick={() => setSettingsOpen(false)}>{copy.cancel}</SecondaryButton>
              <PrimaryButton style={{ width: "auto", minHeight: "2.45rem" }} disabled={savingSettings} onClick={() => void saveSettings()}>{copy.saveSettings}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
