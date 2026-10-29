"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signInWithLink } from "../api";
import { ProgressLink, QuizCrowd, SentenceWall, useLessonCommunity, YesterdayPick, type Progress } from "./Community";
import { CheckIcon, PauseIcon, PlayIcon, ShareIcon, SpeakerWaveIcon, XMarkIcon } from "@heroicons/react/24/solid";
import type { DailyLessonContent } from "../server/lessons";
import { DAILY_FIELD_LABEL, DAILY_REVIEW_PATH, DAILY_TRACK_LABEL, type DailyTrack } from "../constants";
import { dailyCopy } from "../copy";
import { useSpeech } from "../hooks";
import { dailyDisplay } from "../fonts";
import { cn, displayClass, Emoji, Pill, Waveform } from "./DailyUI";
import "../daily.css";

const TRACK_LABEL = DAILY_TRACK_LABEL;

export function lessonDateLabel(date: string) {
  const d = new Date(`${date}T00:00:00+09:00`);
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
}

function SpeakButton({ text, speaking, onSpeak, label }: { text: string; speaking: boolean; onSpeak: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onSpeak}
      aria-label={`${label}: ${text}`}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
        speaking ? "bg-[#050505] text-[#f47a4a]" : "bg-[#f47a4a] text-[#050505]",
      )}
    >
      {speaking ? <PauseIcon className="size-4" /> : <SpeakerWaveIcon className="size-4" />}
    </button>
  );
}

function Section({ emoji, title, children, className }: { emoji: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[28px] p-6 min-[900px]:p-8", className)}>
      <h2 className="flex items-center gap-2 text-[1.15rem] font-black">
        <Emoji className="text-[1.5rem]">{emoji}</Emoji>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// One lesson, as opened from the Kakao button. Shared by the lesson page and the
// Saturday review (compact).
export function LessonBody({
  lesson,
  compact = false,
  recordedAnswer = null,
  onAnswer,
  quizExtra,
  preview = false,
}: {
  lesson: DailyLessonContent;
  compact?: boolean;
  /** The landing page's phone: shows the audio controls before the browser says it can speak. */
  preview?: boolean;
  /** The reader's recorded answer, when they solved this quiz before. */
  recordedAnswer?: number | null;
  onAnswer?: (choice: number) => void;
  /** Shown under the explanation once answered (the crowd numbers). */
  quizExtra?: React.ReactNode;
}) {
  const speech = useSpeech(lesson.id);
  const { speaking, speak } = speech;
  const supported = speech.supported || preview;
  const [picked, setPicked] = useState<number | null>(recordedAnswer);
  // A recorded answer can arrive after the first render.
  useEffect(() => {
    if (recordedAnswer !== null) setPicked((current) => current ?? recordedAnswer);
  }, [recordedAnswer]);
  const quiz = lesson.quiz;
  const answered = picked !== null;
  const correct = quiz && picked === quiz.answer;

  return (
    <div className="flex flex-col gap-4">
      {/* Expression */}
      <section className={cn("rounded-[28px] bg-[#f47a4a] p-6 text-[#050505] min-[900px]:p-8", compact && "p-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <Pill className="bg-[#050505] text-white">{TRACK_LABEL[lesson.track]}</Pill>
          {lesson.field && <Pill className="bg-white text-[#050505]">{DAILY_FIELD_LABEL[lesson.field]}</Pill>}
          <span className="text-[0.85rem] font-bold text-[rgba(5,5,5,0.7)]">{lessonDateLabel(lesson.publishOn)}</span>
        </div>
        <p className="mt-5 text-[0.85rem] font-extrabold text-[rgba(5,5,5,0.7)]">오늘의 표현</p>
        <p className={cn(displayClass, "text-[2.8rem] leading-[1.05] min-[900px]:text-[3.4rem]", compact && "text-[2.2rem]")}>
          {lesson.expression}
        </p>
        <p className="mt-2 text-[1.08rem] font-bold">{lesson.meaning}</p>
        {supported && (
          <button
            type="button"
            onClick={() => speak("expression", lesson.expression, 0.8)}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-[#050505] px-3 py-2.5 text-white"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-[#f47a4a] text-[#050505]">
              {speaking === "expression" ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            </span>
            <Waveform className="h-5 flex-1" />
            <span className="text-[0.8rem] font-bold text-white/70">발음 듣기</span>
          </button>
        )}
        {(lesson.pronunciation || lesson.stress) && (
          <p className="mt-3 text-[0.9rem] font-bold text-[rgba(5,5,5,0.75)]">
            {lesson.pronunciation}
            {lesson.stress && <span className="ml-2">· 강세: {lesson.stress}</span>}
          </p>
        )}
      </section>

      {lesson.nuance && (
        <Section emoji="💡" title="이럴 때 써요" className="bg-[#fff8dc]">
          <p className="text-[1rem] leading-[1.7] text-[#334155]">{lesson.nuance}</p>
          {lesson.similar.length > 0 && (
            <div className="mt-4">
              <p className="text-[0.8rem] font-extrabold text-[#d95f2d]">비슷한 표현</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lesson.similar.map((item) => (
                  <span key={item} className="rounded-full bg-white px-3 py-1.5 text-[0.88rem] font-bold">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {lesson.examples.length > 0 && (
        <Section emoji="🗣️" title="실제 사용 예시" className="bg-[#f5f5f4]">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {lesson.examples.map((example, index) => (
              <li key={example.en} className="flex items-start gap-3 rounded-2xl bg-white p-4">
                {supported && (
                  <SpeakButton text={example.en} label="예문 듣기" speaking={speaking === `example-${index}`} onSpeak={() => speak(`example-${index}`, example.en)} />
                )}
                <div>
                  {example.context && <p className="text-[0.75rem] font-extrabold text-[#d95f2d]">{example.context}</p>}
                  <p className="text-[1rem] font-bold leading-snug">{example.en}</p>
                  {example.ko && <p className="mt-0.5 text-[0.88rem] text-[#64748b]">{example.ko}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!compact && lesson.dialogue.length > 0 && (
        <Section emoji="💬" title="대화로 보기" className="bg-[#f5f5f4]">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {lesson.dialogue.map((line, index) => {
              const mine = index % 2 === 1;
              return (
                <li key={`${index}-${line.en}`} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  <span className="mb-1 text-[0.72rem] font-bold text-[#64748b]">
                    {line.speaker}
                    {line.role ? ` · ${line.role}` : ""}
                  </span>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-[20px] px-4 py-3",
                      mine ? "rounded-br-[6px] bg-[#f47a4a] text-[#050505]" : "rounded-bl-[6px] bg-white",
                    )}
                  >
                    <p className="text-[0.98rem] font-bold leading-snug">{line.en}</p>
                    {line.ko && <p className={cn("mt-0.5 text-[0.82rem]", mine ? "text-[rgba(5,5,5,0.7)]" : "text-[#64748b]")}>{line.ko}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          {supported && (
            <button
              type="button"
              onClick={() => speak("dialogue", lesson.dialogue.map((line) => line.en).join(" "))}
              className="mt-4 flex items-center gap-2 rounded-full bg-[#050505] px-4 py-2.5 text-[0.88rem] font-black text-white"
            >
              {speaking === "dialogue" ? <PauseIcon className="size-4 text-[#f47a4a]" /> : <PlayIcon className="size-4 text-[#f47a4a]" />}
              대화 전체 듣기
            </button>
          )}
        </Section>
      )}

      {quiz && (
        <Section emoji="⚡" title="1분 퀴즈" className="bg-[#050505] text-white">
          <p className="text-[1.08rem] font-bold leading-snug">{quiz.prompt}</p>
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            {quiz.options.map((option, index) => {
              const isAnswer = index === quiz.answer;
              const isPicked = index === picked;
              return (
                <li key={option}>
                  <button
                    type="button"
                    disabled={answered}
                    onClick={() => {
                      setPicked(index);
                      onAnswer?.(index);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[1rem] font-bold transition-colors",
                      !answered && "bg-white/10 hover:bg-white/15",
                      answered && isAnswer && "bg-[#f47a4a] text-[#050505]",
                      answered && isPicked && !isAnswer && "bg-white/10 text-white/50 line-through",
                      answered && !isPicked && !isAnswer && "bg-white/5 text-white/40",
                    )}
                  >
                    {option}
                    {answered && isAnswer && <CheckIcon className="size-5" />}
                    {answered && isPicked && !isAnswer && <XMarkIcon className="size-5" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {answered && (
            <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-[0.95rem] leading-relaxed">
              <span className="font-black">{correct ? "🎉 정답이에요! " : "아쉬워요. "}</span>
              {quiz.explanation}
            </p>
          )}
          {answered && quizExtra}
        </Section>
      )}
    </div>
  );
}

// The headline a reader can boast with; null when their record has not loaded.
function shareHeadline(progress: Progress | null): string | null {
  const c = dailyCopy.community;
  if (!progress) return null;
  if (progress.streak > 0) return c.shareStreak.replace("{days}", String(progress.streak));
  if (progress.expressions > 1) return c.shareCount.replace("{count}", String(progress.expressions));
  return c.shareFirst;
}

function ShareButton({ expression, progress }: { expression: string; progress: Progress | null }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const c = dailyCopy.community;
    const url = `${window.location.origin}/daily`;
    const headline = shareHeadline(progress);
    const text = [headline, c.shareExpression.replace("{expression}", expression), c.shareFooter]
      .filter(Boolean)
      .join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: headline ?? "영어 한잔 Daily", text, url });
        return;
      } catch {
        // Cancelled: fall through to copying.
      }
    }
    await navigator.clipboard?.writeText(`${text}\n${url}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={share}
      className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#050505] text-[1rem] font-black text-white"
    >
      <ShareIcon className="size-5 text-[#f47a4a]" />
      {copied ? "링크를 복사했어요" : "친구에게 자랑하기"}
    </button>
  );
}


// Opening a message's button signs the browser in as the subscriber (a link-scoped
// session, see server/session.ts). Render it before anything that loads Daily data on
// mount: effects run in tree order, and every later dailyApi call waits for this one.
function LinkSignIn({ token }: { token: string }) {
  useEffect(() => {
    void signInWithLink(token);
  }, [token]);
  return null;
}

// Rendered after LinkSignIn, so the community data loads with the link's session.
function LessonPageBody({ lesson, token }: { lesson: DailyLessonContent; token: string }) {
  const { data, reload, answer } = useLessonCommunity(token);
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <YesterdayPick pick={data?.yesterdayPick ?? null} />
      <LessonBody lesson={lesson} recordedAnswer={data?.quiz.answered ?? null} onAnswer={answer} quizExtra={<QuizCrowd stats={data?.quiz.stats ?? null} />} />
      {data && <SentenceWall token={token} expression={lesson.expression} data={data} reload={reload} />}

      <section className="rounded-[28px] bg-[#fff8dc] p-6 text-center">
        <Emoji className="text-[2.6rem]">☕</Emoji>
        <p className="mt-2 text-[1.2rem] font-black">오늘의 레슨 끝!</p>
        <p className="mt-1 text-[0.95rem] font-semibold text-[#475569]">오늘 회의에서 한 번 써보세요.</p>
        <div className="mt-5">
          <ProgressLink progress={data?.progress ?? null} />
        </div>
        <div className="mt-3 flex gap-2">
          <ShareButton expression={lesson.expression} progress={data?.progress ?? null} />
        </div>
      </section>
    </div>
  );
}

export function LessonPage({
  lesson,
  isTrial,
  paidOtherTrack,
  subscribeHref,
  linkToken,
}: {
  lesson: DailyLessonContent;
  isTrial: boolean;
  paidOtherTrack: DailyTrack | null;
  subscribeHref: string;
  linkToken: string;
}) {
  return (
    <div className={cn("daily-page min-h-[80vh] bg-white px-4 pb-20 pt-6 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <LinkSignIn token={linkToken} />
      <LessonPageBody lesson={lesson} token={linkToken} />
      <div className="mx-auto mt-4 flex w-full max-w-[720px] flex-col gap-4">

        {/* The review form lives on its own page (/daily/review); this only points there. */}
        <Link href={DAILY_REVIEW_PATH} className="flex items-center gap-4 rounded-[28px] bg-[#f5f5f4] p-6 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[1.15rem] font-black">
              <Emoji className="text-[1.5rem]">💬</Emoji>
              {dailyCopy.reviewPage.cta.title}
            </span>
            <span className="mt-1 block text-[0.95rem] font-semibold text-[#475569]">{dailyCopy.reviewPage.cta.detail}</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#050505] px-4 py-2.5 text-[0.9rem] font-black text-white">
            {dailyCopy.reviewPage.cta.button}
          </span>
        </Link>

        {isTrial && (
          <section className="rounded-[28px] bg-[#050505] p-6 text-white">
            <p className="flex items-center gap-2 text-[1.1rem] font-black">
              <Emoji className="text-[1.6rem]">🎁</Emoji>
              {TRACK_LABEL[lesson.track]} 무료 체험 레슨이에요
            </p>
            <p className="mt-2 text-[0.95rem] font-semibold text-white/70">
              {paidOtherTrack
                ? `지금 ${TRACK_LABEL[paidOtherTrack]} 레벨을 받고 있어요. ${TRACK_LABEL[lesson.track]} 레벨로 바꾸고 싶다면 내 구독에서 바꿀 수 있어요.`
                : "평일마다 받는 시간에 새 표현이, 토요일엔 한 주 복습이 와요. 월 ₩3,700 · 언제든 해지."}
            </p>
            {/* One plan at a time: someone paying for the other level switches, not buys. */}
            <Link
              href={paidOtherTrack ? "/daily/account" : subscribeHref}
              className="mt-5 flex h-[54px] items-center justify-center rounded-2xl bg-[#f47a4a] text-[1rem] font-black text-[#050505]"
            >
              {paidOtherTrack ? "내 구독에서 레벨 바꾸기" : "구독 안내 보기"}
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}

export function ReviewPage({ lessons, linkToken }: { lessons: DailyLessonContent[]; linkToken: string }) {
  return (
    <div className={cn("daily-page min-h-[80vh] bg-white px-4 pb-20 pt-8 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <LinkSignIn token={linkToken} />
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
        <div className="text-center min-[900px]:text-left">
          <Emoji className="text-[2.6rem]">🧠</Emoji>
          <h1 className={cn(displayClass, "mt-3 text-[2.2rem] leading-tight")}>이번 주 복습</h1>
          <p className="mt-2 text-[1rem] font-semibold text-[#475569]">이번 주에 받은 표현 {lessons.length}개를 다시 꺼내 봐요.</p>
        </div>
        {lessons.map((lesson) => (
          <LessonBody key={lesson.id} lesson={lesson} compact />
        ))}
      </div>
    </div>
  );
}
