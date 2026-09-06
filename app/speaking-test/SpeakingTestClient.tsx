"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ComputerDesktopIcon,
  MicrophoneIcon,
  PauseCircleIcon,
  PrinterIcon,
  SparklesIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import "./speaking-test.css";

type Phase = "welcome" | "hardware" | "microphone" | "section" | "preparing" | "speaking" | "finishing" | "review" | "evaluating" | "report";

type Answer = {
  taskNumber: number;
  taskKind: "listen_repeat" | "picture_description" | "interview";
  transcript: string;
  durationSeconds: number;
};

type Criterion = {
  id: "fluency" | "accuracy" | "range";
  label: string;
  level: string;
  score: number;
  description: string;
  evidence: string;
  nextStep: string;
};

type Report = {
  overall: { cefr: string; band: string; score: number; summary: string };
  criteria: Criterion[];
  taskFeedback: Array<{ taskNumber: number; score: number; feedback: string }>;
  strengths: string[];
  focusAreas: string[];
  studyPlan: Array<{ day: string; goal: string; exercise: string }>;
  reportNote: string;
};

type SavedAttempt = {
  id: string;
  cefr: string;
  band: string;
  score: number;
  report: Report;
  completedAt: string;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

const TOEFL_STYLE_TASKS = [
  {
    type: "Listen and Repeat",
    kind: "listen_repeat",
    prompt: "",
    audioText: "The student center will remain open until ten o'clock during final examinations.",
    preparationSeconds: 5,
    responseSeconds: 12,
  },
  {
    type: "Listen and Repeat",
    kind: "listen_repeat",
    prompt: "",
    audioText: "Researchers found that regular breaks can help people maintain attention during a long study session.",
    preparationSeconds: 5,
    responseSeconds: 12,
  },
  {
    type: "Listen and Repeat",
    kind: "listen_repeat",
    prompt: "",
    audioText: "Before choosing a course, compare the meeting times with the assignments and examination schedule.",
    preparationSeconds: 5,
    responseSeconds: 12,
  },
  {
    type: "Describe a Picture",
    kind: "picture_description",
    prompt: "Describe the picture in as much detail as you can. Include the people, their actions, and the setting.",
    audioText: "",
    preparationSeconds: 15,
    responseSeconds: 45,
  },
  {
    type: "Take an Interview",
    kind: "interview",
    prompt: "You are meeting an academic adviser for the first time. What would you like help with, and why?",
    audioText: "",
    preparationSeconds: 10,
    responseSeconds: 45,
  },
  {
    type: "Take an Interview",
    kind: "interview",
    prompt: "Tell the interviewer about a time you worked with other people to solve a problem. What did you do?",
    audioText: "",
    preparationSeconds: 10,
    responseSeconds: 45,
  },
  {
    type: "Take an Interview",
    kind: "interview",
    prompt: "What is one change that would make campus life better for students? Explain your answer with an example.",
    audioText: "",
    preparationSeconds: 10,
    responseSeconds: 45,
  },
] as const;

const EXAM_TEXT = {
  questionInstruction: "Follow the instructions for this task. Speak clearly and use the full response time when you can.",
  prompt: "Question",
  listenPrompt: "Play sentence",
  promptPlaying: "Playing sentence…",
  promptHint: "Listen once, then repeat the sentence as accurately as you can.",
  preparationTime: "Preparation time",
  responseTime: "Response time",
  seconds: (count: number) => `${count} seconds`,
  prepareHeading: "Prepare your response",
  prepareHint: "Get ready. The response timer will start automatically.",
  speakHeading: "Speak now",
  speakHint: "Your response is transcribed as you speak. You can correct it when time ends.",
  transcript: "Your response",
  transcriptPlaceholder: "Your response will appear here. You can also type or paste an answer.",
  microphone: "Enable microphone",
  microphoneOn: "Listening",
  taskComplete: "Finish response",
  taskCompleteHint: "Review the transcript, then continue when you are ready.",
  nextTask: "Continue",
  finishTest: "View report",
  timeUpTitle: "Time is up",
  timeUpBody: "Your response has been captured. Please review the transcript before continuing.",
};

// Layout primitives (styled-components -> Tailwind migration). Each keeps the
// original styled-component name and rules; max-w-page / px-gutter mirror appLayout.
type ElProps = HTMLAttributes<HTMLElement>;
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement>;

function Page({ className = "", ...rest }: ElProps) {
  return (
    <main
      className={`mx-auto max-w-page px-gutter pt-12 pb-[4.5rem] text-[#050505] max-[700px]:px-gutter-mobile max-[700px]:pt-8 max-[700px]:pb-12 ${className}`}
      {...rest}
    />
  );
}

function Hero({ className = "", ...rest }: ElProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-[18px] border-2 border-[#050505] bg-[#050505] p-[3.25rem] text-white shadow-[7px_7px_0_#f47a4a] after:absolute after:right-[-190px] after:bottom-[-270px] after:h-[460px] after:w-[460px] after:rounded-full after:border-[42px] after:border-[rgba(244,122,74,0.48)] after:content-[''] max-[700px]:rounded-[22px] max-[700px]:px-6 max-[700px]:py-9 ${className}`}
      {...rest}
    />
  );
}

function Eyebrow({ className = "", ...rest }: ElProps) {
  return (
    <p
      className={`m-0 mb-[0.9rem] inline-flex items-center gap-[0.42rem] text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-[#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function HeroTitle({ className = "", ...rest }: ElProps) {
  return (
    <h1
      className={`m-0 max-w-[690px] text-[clamp(2rem,4.7vw,3.5rem)] font-[850] leading-[1.08] tracking-[-0.05em] text-white ${className}`}
      {...rest}
    />
  );
}

function HeroSubtitle({ className = "", ...rest }: ElProps) {
  return (
    <p
      className={`mx-0 mt-[1.15rem] mb-7 max-w-[625px] text-[1.04rem] leading-[1.65] text-[rgba(255,255,255,0.78)] ${className}`}
      {...rest}
    />
  );
}

const pillButtonBase =
  "inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-[#050505] [transition:transform_140ms_ease,box-shadow_140ms_ease] enabled:hover:shadow-[6px_6px_0_#f47a4a] enabled:hover:[transform:translate(-1px,-1px)] disabled:cursor-wait disabled:opacity-[0.72]";

function PrimaryButton({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`${pillButtonBase} min-h-[50px] gap-[0.55rem] bg-white px-[1.2rem] py-[0.8rem] text-[0.95rem] font-extrabold text-[#050505] shadow-[4px_4px_0_#f47a4a] [&_svg]:h-[19px] [&_svg]:w-[19px] ${className}`}
      {...rest}
    />
  );
}

function ContinueButton({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`${pillButtonBase} min-h-[45px] gap-[0.55rem] bg-[#050505] px-[1.2rem] py-[0.8rem] text-[0.95rem] font-extrabold text-white shadow-[4px_4px_0_#f47a4a] [&_svg]:h-[19px] [&_svg]:w-[19px] ${className}`}
      {...rest}
    />
  );
}

function MetaRow({ className = "", ...rest }: ElProps) {
  return <div className={`mt-[1.8rem] flex flex-wrap gap-[0.65rem] ${className}`} {...rest} />;
}

function MetaPill({ className = "", ...rest }: ElProps) {
  return (
    <span
      className={`rounded-full border border-[rgba(255,255,255,0.48)] bg-[rgba(255,255,255,0.1)] px-[0.72rem] py-[0.42rem] text-[0.8rem] font-bold text-white ${className}`}
      {...rest}
    />
  );
}

function Note({ className = "", ...rest }: ElProps) {
  return (
    <p className={`mx-0 mb-0 mt-[0.9rem] text-[0.75rem] leading-normal text-[rgba(255,255,255,0.59)] ${className}`} {...rest} />
  );
}

function Section({ className = "", ...rest }: ElProps) {
  return <section className={`mt-[3.25rem] ${className}`} {...rest} />;
}

function SectionTitle({ className = "", ...rest }: ElProps) {
  return <h2 className={`mx-0 mt-0 mb-[1.2rem] text-[1.35rem] font-[850] tracking-[-0.035em] ${className}`} {...rest} />;
}

function InfoGrid({ className = "", ...rest }: ElProps) {
  return <div className={`grid grid-cols-3 gap-4 max-[700px]:grid-cols-1 ${className}`} {...rest} />;
}

function HistoryList({ className = "", ...rest }: ElProps) {
  return <div className={`border-t-2 border-[#050505] ${className}`} {...rest} />;
}

function HistoryItem({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-4 border-0 border-b border-b-[rgba(5,5,5,0.24)] bg-transparent px-0 py-[0.9rem] text-left text-[#050505] hover:text-[#c84932] max-[540px]:grid-cols-[1fr_auto] ${className}`}
      {...rest}
    />
  );
}

function HistoryDate({ className = "", ...rest }: ElProps) {
  return <span className={`text-[0.82rem] font-bold text-[rgba(5,5,5,0.62)] ${className}`} {...rest} />;
}

function HistoryScore({ className = "", ...rest }: ElProps) {
  return <strong className={`text-[1.04rem] font-black text-[#f47a4a] ${className}`} {...rest} />;
}

function InfoCard({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`min-h-[145px] rounded-xl border-2 border-[#050505] bg-[#fff8dc] p-[1.3rem] shadow-[4px_4px_0_#050505] ${className}`}
      {...rest}
    />
  );
}

function CardNumber({ className = "", ...rest }: ElProps) {
  return (
    <span
      className={`flex h-[29px] w-[29px] items-center justify-center rounded-full bg-[#f47a4a] text-[0.78rem] font-[850] text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function CardTitle({ className = "", ...rest }: ElProps) {
  return <h3 className={`mx-0 mt-3 mb-[0.3rem] text-[1rem] font-extrabold ${className}`} {...rest} />;
}

function CardText({ className = "", ...rest }: ElProps) {
  return <p className={`m-0 text-[0.87rem] leading-[1.55] text-[rgba(5,5,5,0.68)] ${className}`} {...rest} />;
}

function TestShell({ className = "", ...rest }: ElProps) {
  return <section className={`mx-auto max-w-[880px] ${className}`} {...rest} />;
}

function SetupShell({ className = "", ...rest }: ElProps) {
  return (
    <section
      className={`mx-auto mt-10 mb-0 max-w-[720px] rounded-2xl border-2 border-[#050505] bg-white p-[clamp(1.5rem,5vw,3.1rem)] shadow-[6px_6px_0_#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function SetupHeading({ className = "", ...rest }: ElProps) {
  return (
    <h1
      className={`m-0 text-[clamp(1.9rem,4vw,2.75rem)] font-[850] leading-[1.12] tracking-[-0.05em] text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function SetupBody({ className = "", ...rest }: ElProps) {
  return (
    <p className={`mx-0 mb-0 mt-4 max-w-[595px] text-[1rem] leading-[1.7] text-[rgba(5,5,5,0.68)] ${className}`} {...rest} />
  );
}

function SetupChecks({ className = "", ...rest }: ElProps) {
  return <div className={`my-8 grid grid-cols-3 gap-3 max-[620px]:grid-cols-1 ${className}`} {...rest} />;
}

function SetupCheck({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`grid min-h-[135px] place-items-center gap-[0.6rem] rounded-[10px] border-[1.5px] border-[#050505] bg-[#fff8dc] px-[0.7rem] py-[1.1rem] text-center text-[#050505] [&_svg]:h-[35px] [&_svg]:w-[35px] [&_span]:text-[0.83rem] [&_span]:font-extrabold [&_span]:text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function MeterPanel({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`mx-0 mt-[2.1rem] mb-[1.15rem] border-y-2 border-[#050505] bg-[#fff8dc] p-[clamp(1.2rem,4vw,2rem)] ${className}`}
      {...rest}
    />
  );
}

function MeterBars({ className = "", ...rest }: ElProps) {
  return <div className={`flex min-h-[78px] items-end justify-center gap-[5px] ${className}`} {...rest} />;
}

const meterBarHeights = ["h-[28px]", "h-[38px]", "h-[48px]", "h-[58px]", "h-[68px]"];

function MeterBar({ $active, $index }: { $active: boolean; $index: number }) {
  return (
    <span
      className={`w-[9px] [transition:background_90ms_ease] ${meterBarHeights[$index % 5]} ${
        $active ? ($index > 17 ? "bg-[#f47a4a]" : "bg-[#050505]") : "bg-[#ddd7c7]"
      }`}
    />
  );
}

function MeterStatus({
  $state,
  className = "",
  ...rest
}: { $state: "quiet" | "good" | "loud" | "idle" } & ElProps) {
  return (
    <div
      className={`mt-[1.15rem] flex items-center justify-center gap-[0.4rem] text-[0.9rem] font-[850] ${
        $state === "loud" ? "text-[#c84932]" : $state === "good" ? "text-[#050505]" : "text-[rgba(5,5,5,0.58)]"
      } ${className}`}
      {...rest}
    />
  );
}

function TimeGuide({ className = "", ...rest }: ElProps) {
  return <div className={`mx-0 mb-0 mt-[1.7rem] grid grid-cols-2 border-y-2 border-[#050505] ${className}`} {...rest} />;
}

function TimeGuideItem({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`px-4 py-[0.82rem] first:border-r-2 first:border-r-[#050505] [&_strong]:block [&_strong]:text-[0.72rem] [&_strong]:font-[850] [&_strong]:uppercase [&_strong]:tracking-[0.07em] [&_strong]:text-[#f47a4a] [&_span]:mt-[0.2rem] [&_span]:block [&_span]:text-[0.94rem] [&_span]:font-[850] [&_span]:text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function ExamInstruction({ className = "", ...rest }: ElProps) {
  return (
    <p className={`mx-0 mt-0 mb-[1.4rem] text-[1rem] leading-[1.6] text-[rgba(5,5,5,0.66)] ${className}`} {...rest} />
  );
}

function TimeTrack({ className = "", ...rest }: ElProps) {
  return <div className={`mt-5 h-[6px] overflow-hidden bg-[#dfd9ca] ${className}`} {...rest} />;
}

function TimeTrackFill({ $progress, $speaking }: { $progress: number; $speaking: boolean }) {
  return (
    <div
      className={`h-full [transition:width_900ms_linear] ${$speaking ? "bg-[#050505]" : "bg-[#f47a4a]"}`}
      style={{ width: `${Math.max(0, Math.min(100, $progress))}%` }}
    />
  );
}

function PlaybackCard({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`mt-[1.4rem] flex items-center gap-[0.95rem] border-y border-[#050505] px-0 py-[0.9rem] ${className}`}
      {...rest}
    />
  );
}

function PlaybackButton({ $playing, className = "", ...rest }: { $playing: boolean } & BtnProps) {
  return (
    <button
      className={`grid h-[43px] w-[43px] flex-none cursor-pointer place-items-center rounded-full border-2 border-[#050505] [&_svg]:h-[21px] [&_svg]:w-[21px] ${
        $playing ? "bg-[#f47a4a] text-[#050505]" : "bg-[#050505] text-white"
      } ${className}`}
      {...rest}
    />
  );
}

function PlaybackCopy({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`min-w-0 [&_strong]:block [&_strong]:text-[0.86rem] [&_strong]:font-[850] [&_strong]:text-[#050505] [&_span]:mt-[0.16rem] [&_span]:block [&_span]:text-[0.78rem] [&_span]:leading-[1.45] [&_span]:text-[rgba(5,5,5,0.62)] ${className}`}
      {...rest}
    />
  );
}

function FinishOverlay({ className = "", ...rest }: ElProps) {
  return (
    <div className={`fixed inset-0 z-[100] grid place-items-center bg-[rgba(5,5,5,0.58)] p-5 ${className}`} {...rest} />
  );
}

function FinishDialog({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`w-[min(100%,460px)] rounded-2xl border-2 border-[#050505] bg-white p-8 text-center shadow-[8px_8px_0_#f47a4a] [&_svg]:h-[38px] [&_svg]:w-[38px] [&_svg]:text-[#f47a4a] [&_h2]:mx-0 [&_h2]:mb-0 [&_h2]:mt-[0.7rem] [&_h2]:text-[1.6rem] [&_h2]:font-[850] [&_h2]:text-[#050505] [&_p]:mx-0 [&_p]:mb-0 [&_p]:mt-[0.65rem] [&_p]:text-[0.94rem] [&_p]:leading-[1.58] [&_p]:text-[rgba(5,5,5,0.68)] ${className}`}
      {...rest}
    />
  );
}

function Progress({ className = "", ...rest }: ElProps) {
  return <div className={`mb-[1.45rem] flex gap-2 ${className}`} {...rest} />;
}

function ProgressPart({ $complete, $current }: { $complete: boolean; $current: boolean }) {
  return (
    <div className={`h-[6px] flex-1 ${$complete ? "bg-[#f47a4a]" : $current ? "bg-[#050505]" : "bg-[#ded8cb]"}`} />
  );
}

function TaskHeader({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`mb-6 flex items-start justify-between gap-4 border-b-2 border-[#050505] pb-4 ${className}`}
      {...rest}
    />
  );
}

function TaskKicker({ className = "", ...rest }: ElProps) {
  return (
    <p
      className={`mx-0 mt-0 mb-[0.35rem] text-[0.78rem] font-extrabold uppercase tracking-[0.08em] text-[#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function TaskTitle({ className = "", ...rest }: ElProps) {
  return (
    <h1
      className={`m-0 text-[clamp(1.7rem,4vw,2.45rem)] font-[850] tracking-[-0.05em] text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function Timer({ $urgent, className = "", ...rest }: { $urgent: boolean } & ElProps) {
  return (
    <div
      className={`inline-flex min-w-[92px] flex-none items-center justify-center gap-[0.35rem] rounded-full border-2 border-[#050505] px-3 py-[0.68rem] text-[1.05rem] font-[850] text-[#050505] tabular-nums [&_svg]:h-[18px] [&_svg]:w-[18px] ${
        $urgent ? "bg-[#f47a4a]" : "bg-[#fff8dc]"
      } ${className}`}
      {...rest}
    />
  );
}

function PromptCard({ className = "", ...rest }: ElProps) {
  return <article className={`p-0 pb-6 ${className}`} {...rest} />;
}

function PromptLabel({ className = "", ...rest }: ElProps) {
  return (
    <h2
      className={`mx-0 mt-0 mb-[0.6rem] flex items-center gap-[0.4rem] text-[0.77rem] font-[850] uppercase tracking-[0.09em] text-[#f47a4a] [&_svg]:h-[17px] [&_svg]:w-[17px] ${className}`}
      {...rest}
    />
  );
}

function PromptText({ className = "", ...rest }: ElProps) {
  return (
    <p
      className={`m-0 text-[clamp(1.2rem,2.25vw,1.55rem)] font-[850] leading-[1.5] text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function PicturePrompt({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`mx-auto mb-0 mt-[1.45rem] w-[min(100%,620px)] border-2 border-[#050505] bg-[#fff8dc] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${className}`}
      {...rest}
    />
  );
}

function Stage({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`mt-[1.35rem] flex items-center gap-[0.85rem] border-t border-[#050505] px-0 py-4 text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function StageIcon({ $speaking, className = "", ...rest }: { $speaking: boolean } & ElProps) {
  return (
    <div
      className={`grid h-[37px] w-[37px] flex-none place-items-center rounded-full border-2 border-[#050505] [&_svg]:h-5 [&_svg]:w-5 ${
        $speaking ? "bg-[#050505] text-white" : "bg-[#f47a4a] text-[#050505]"
      } ${className}`}
      {...rest}
    />
  );
}

function StageTitle({ className = "", ...rest }: ElProps) {
  return <strong className={`mb-[0.15rem] block text-[0.92rem] ${className}`} {...rest} />;
}

function StageCopy({ className = "", ...rest }: ElProps) {
  return <span className={`block text-[0.82rem] leading-[1.45] ${className}`} {...rest} />;
}

function TranscriptArea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`mt-4 min-h-[160px] w-full resize-y rounded-[10px] border-2 border-[#050505] bg-white p-4 text-[0.95rem] leading-[1.62] text-[#050505] outline-none focus:border-[#050505] focus:shadow-[4px_4px_0_#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function ButtonRow({ className = "", ...rest }: ElProps) {
  return <div className={`mt-4 flex flex-wrap justify-end gap-[0.65rem] ${className}`} {...rest} />;
}

function SecondaryButton({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`inline-flex min-h-[45px] cursor-pointer items-center justify-center gap-[0.45rem] rounded-full border-2 border-[#050505] bg-[#fff8dc] px-[0.9rem] py-[0.7rem] text-[0.88rem] font-extrabold text-[#050505] [&_svg]:h-[18px] [&_svg]:w-[18px] ${className}`}
      {...rest}
    />
  );
}

function InlineNotice({ $error, className = "", ...rest }: { $error?: boolean } & ElProps) {
  return (
    <p
      className={`mx-0 mb-0 mt-[0.7rem] text-[0.78rem] leading-normal ${
        $error ? "text-[#c84932]" : "text-[rgba(5,5,5,0.62)]"
      } ${className}`}
      {...rest}
    />
  );
}

function Evaluating({ className = "", ...rest }: ElProps) {
  return <div className={`grid min-h-[390px] place-items-center text-center ${className}`} {...rest} />;
}

function Spinner({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`h-12 w-12 rounded-full border-4 border-[#fff0c3] border-t-[#f47a4a] animate-[speaking-test-spin_0.85s_linear_infinite] ${className}`}
      {...rest}
    />
  );
}

function ReportHeader({ className = "", ...rest }: ElProps) {
  return (
    <section className={`mb-4 grid grid-cols-[1.1fr_0.9fr] gap-4 max-[700px]:grid-cols-1 ${className}`} {...rest} />
  );
}

function OverallCard({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`rounded-[14px] border-2 border-[#050505] bg-[#050505] p-[1.7rem] text-white shadow-[6px_6px_0_#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function OverallTitle({ className = "", ...rest }: ElProps) {
  return (
    <h1 className={`mx-0 mb-0 mt-[0.35rem] text-[2rem] font-[850] tracking-[-0.045em] text-white ${className}`} {...rest} />
  );
}

function OverallText({ className = "", ...rest }: ElProps) {
  return (
    <p
      className={`mx-0 mb-0 mt-[0.8rem] text-[0.91rem] leading-[1.6] text-[rgba(255,255,255,0.78)] ${className}`}
      {...rest}
    />
  );
}

function ScoreCard({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`flex min-h-[180px] flex-col items-center justify-center rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] ${className}`}
      {...rest}
    />
  );
}

function BigScore({ className = "", ...rest }: ElProps) {
  return (
    <strong className={`text-[3rem] font-black tracking-[-0.08em] text-[#f47a4a] tabular-nums ${className}`} {...rest} />
  );
}

function ReportSection({ className = "", ...rest }: ElProps) {
  return <section className={`mt-[1.15rem] border-t-2 border-[#050505] p-0 pt-[1.35rem] ${className}`} {...rest} />;
}

function CriteriaGrid({ className = "", ...rest }: ElProps) {
  return <div className={`grid grid-cols-3 gap-[0.9rem] max-[740px]:grid-cols-1 ${className}`} {...rest} />;
}

function CriterionCard({ className = "", ...rest }: ElProps) {
  return <article className={`border-l-[3px] border-l-[#f47a4a] py-1 pl-[0.95rem] pr-0 ${className}`} {...rest} />;
}

function CriterionTop({ className = "", ...rest }: ElProps) {
  return <div className={`flex items-baseline justify-between gap-2 ${className}`} {...rest} />;
}

function CriterionTitle({ className = "", ...rest }: ElProps) {
  return <h3 className={`m-0 text-[1rem] font-[850] ${className}`} {...rest} />;
}

function Level({ className = "", ...rest }: ElProps) {
  return <span className={`text-[0.83rem] font-[850] text-[#f47a4a] ${className}`} {...rest} />;
}

function CriterionDescription({ className = "", ...rest }: ElProps) {
  return <p className={`mx-0 my-3 text-[0.86rem] leading-[1.55] text-[rgba(5,5,5,0.68)] ${className}`} {...rest} />;
}

function DetailLabel({ className = "", ...rest }: ElProps) {
  return (
    <strong
      className={`mx-0 mt-[0.7rem] mb-[0.2rem] block text-[0.7rem] font-[850] uppercase tracking-[0.06em] text-[#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function DetailText({ className = "", ...rest }: ElProps) {
  return <p className={`m-0 text-[0.8rem] leading-normal text-[rgba(5,5,5,0.72)] ${className}`} {...rest} />;
}

function TwoColumn({ className = "", ...rest }: ElProps) {
  return <div className={`mt-[1.15rem] grid grid-cols-2 gap-4 max-[700px]:grid-cols-1 ${className}`} {...rest} />;
}

function List({ className = "", ...rest }: ElProps) {
  return <ul className={`m-0 grid list-none gap-[0.68rem] p-0 ${className}`} {...rest} />;
}

function ListItem({ className = "", ...rest }: ElProps) {
  return (
    <li
      className={`relative pl-[1.2rem] text-[0.88rem] leading-[1.52] text-[rgba(5,5,5,0.72)] before:absolute before:left-0 before:top-[0.48rem] before:h-[7px] before:w-[7px] before:rounded-full before:bg-[#f47a4a] before:content-[''] ${className}`}
      {...rest}
    />
  );
}

function TaskFeedbackList({ className = "", ...rest }: ElProps) {
  return <div className={`grid gap-[0.65rem] ${className}`} {...rest} />;
}

function TaskFeedback({ className = "", ...rest }: ElProps) {
  return (
    <div
      className={`grid grid-cols-[auto_1fr] items-start gap-[0.8rem] border-l-[3px] border-l-[#050505] py-1 pl-[0.85rem] pr-0 ${className}`}
      {...rest}
    />
  );
}

function TaskScore({ className = "", ...rest }: ElProps) {
  return (
    <span
      className={`inline-grid h-[42px] w-[42px] place-items-center rounded-full bg-[#f47a4a] text-[0.79rem] font-[850] text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function Plan({ className = "", ...rest }: ElProps) {
  return <div className={`grid grid-cols-3 gap-[0.7rem] max-[700px]:grid-cols-1 ${className}`} {...rest} />;
}

function PlanItem({ className = "", ...rest }: ElProps) {
  return <article className={`border-l-[3px] border-l-[#f47a4a] py-[0.35rem] pl-3 pr-0 ${className}`} {...rest} />;
}

function PlanDay({ className = "", ...rest }: ElProps) {
  return (
    <strong
      className={`block text-[0.74rem] font-[850] uppercase tracking-[0.07em] text-[#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function PlanGoal({ className = "", ...rest }: ElProps) {
  return <h3 className={`mx-0 my-[0.35rem] text-[0.92rem] font-extrabold ${className}`} {...rest} />;
}

function ReportNote({ className = "", ...rest }: ElProps) {
  return (
    <p className={`mx-0 mb-0 mt-[1.1rem] text-[0.76rem] leading-[1.55] text-[rgba(5,5,5,0.58)] ${className}`} {...rest} />
  );
}

const formatTimer = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const scoreText = (score: number) => `${Math.round(score)}`;

function CampusPicture() {
  return (
    <PicturePrompt aria-label="Illustration of students at a campus information booth">
      <svg viewBox="0 0 720 390" role="img" aria-hidden="true">
        <rect width="720" height="390" fill="#fff8dc" />
        <path d="M0 242h720v148H0z" fill="#f6d875" />
        <path d="M0 188c58-44 109-32 155 0 49-65 135-65 187 0 57-50 130-41 186 0 50-49 131-46 192 0v58H0z" fill="#9bcc8b" />
        <circle cx="104" cy="101" r="50" fill="#f47a4a" />
        <path d="M77 184V96m27 88V76m27 108V98" stroke="#050505" strokeWidth="9" strokeLinecap="round" />
        <rect x="445" y="116" width="162" height="136" rx="4" fill="#fff" stroke="#050505" strokeWidth="7" />
        <path d="M462 143h128M462 170h84M462 197h110" stroke="#f47a4a" strokeWidth="11" strokeLinecap="round" />
        <path d="M427 245h202" stroke="#050505" strokeWidth="10" strokeLinecap="round" />
        <circle cx="262" cy="192" r="25" fill="#050505" />
        <path d="M219 310c7-65 79-65 86 0" fill="#f47a4a" stroke="#050505" strokeWidth="7" />
        <path d="M262 246v65M236 268l-34 28M287 268l34 18" stroke="#050505" strokeWidth="8" strokeLinecap="round" />
        <circle cx="365" cy="205" r="23" fill="#050505" />
        <path d="M327 315c4-61 68-61 77 0" fill="#fff" stroke="#050505" strokeWidth="7" />
        <path d="M365 250v64M343 270l-23 19M388 270l37-33" stroke="#050505" strokeWidth="8" strokeLinecap="round" />
        <path d="M104 252c-2 65 48 88 48 88M104 252c3 65-43 88-43 88" stroke="#050505" strokeWidth="10" strokeLinecap="round" />
        <path d="M0 340h720" stroke="#050505" strokeWidth="7" strokeDasharray="18 18" />
      </svg>
    </PicturePrompt>
  );
}

export default function SpeakingTestClient() {
  const { currentUser } = useAuth();
  const { locale, t } = useI18n();
  const copy = t.speakingTest;
  const [phase, setPhase] = useState<Phase>("welcome");
  const [taskIndex, setTaskIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(TOEFL_STYLE_TASKS[0].preparationSeconds);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isPromptPlaying, setIsPromptPlaying] = useState(false);
  const [microphoneError, setMicrophoneError] = useState("");
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [isCheckingMicrophone, setIsCheckingMicrophone] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [savedAttempts, setSavedAttempts] = useState<SavedAttempt[]>([]);
  const [assessmentError, setAssessmentError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const microphoneContextRef = useRef<AudioContext | null>(null);
  const microphoneFrameRef = useRef<number | null>(null);

  const task = TOEFL_STYLE_TASKS[taskIndex];
  const preparationSeconds = task.preparationSeconds;
  const speakingSeconds = task.responseSeconds;
  const liveTranscript = `${transcript}${interimTranscript ? `${transcript ? " " : ""}${interimTranscript}` : ""}`;

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const response = await fetch("/api/speaking-test/history");
        if (!response.ok) return;
        const payload = await response.json() as { attempts?: SavedAttempt[] };
        if (active) setSavedAttempts(payload.attempts ?? []);
      } catch {
        // History is optional enhancement; the test remains available if it cannot load.
      }
    }
    void loadHistory();
    return () => { active = false; };
  }, []);

  const playPrompt = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const promptText = task.audioText;
    const utterance = new SpeechSynthesisUtterance(promptText);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.onend = () => setIsPromptPlaying(false);
    utterance.onerror = () => setIsPromptPlaying(false);
    setIsPromptPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, [task.audioText]);

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const stopMicrophoneCheck = useCallback(() => {
    if (microphoneFrameRef.current !== null) cancelAnimationFrame(microphoneFrameRef.current);
    microphoneFrameRef.current = null;
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    void microphoneContextRef.current?.close();
    microphoneContextRef.current = null;
    setIsCheckingMicrophone(false);
    setMicrophoneLevel(0);
  }, []);

  const startMicrophoneCheck = useCallback(async () => {
    stopMicrophoneCheck();
    setMicrophoneError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio context unavailable");
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      microphoneStreamRef.current = stream;
      microphoneContextRef.current = context;
      setIsCheckingMicrophone(true);

      const updateLevel = () => {
        analyser.getByteTimeDomainData(values);
        const average = values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length;
        setMicrophoneLevel(Math.min(1, average / 36));
        microphoneFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      setMicrophoneError(copy.micDenied);
    }
  }, [copy.micDenied, stopMicrophoneCheck]);

  const beginRecognition = useCallback(async () => {
    setMicrophoneError("");
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setMicrophoneError(copy.microphoneUnsupported);
      return;
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        if (finalText.trim()) setTranscript((previous) => `${previous}${previous ? " " : ""}${finalText.trim()}`);
        setInterimTranscript(interimText.trim());
      };
      recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") setMicrophoneError(copy.micDenied);
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setMicrophoneError(copy.micDenied);
    }
  }, [copy.micDenied, copy.microphoneUnsupported]);

  const saveCurrentAnswer = useCallback((durationSeconds: number) => {
    stopRecognition();
    setAnswers((previous) => {
      const next = previous.filter((answer) => answer.taskNumber !== taskIndex + 1);
      return [...next, { taskNumber: taskIndex + 1, taskKind: task.kind, transcript: liveTranscript.trim(), durationSeconds }];
    });
  }, [liveTranscript, stopRecognition, task.kind, taskIndex]);

  const beginTask = useCallback((nextTaskIndex: number) => {
    stopRecognition();
    stopMicrophoneCheck();
    window.speechSynthesis?.cancel();
    setIsPromptPlaying(false);
    setTaskIndex(nextTaskIndex);
    setTranscript("");
    setInterimTranscript("");
    setMicrophoneError("");
    setSecondsLeft(TOEFL_STYLE_TASKS[nextTaskIndex].preparationSeconds);
    setPhase("preparing");
  }, [stopMicrophoneCheck, stopRecognition]);

  const completeSpeaking = useCallback(() => {
    const elapsed = Math.max(1, speakingSeconds - secondsLeft);
    saveCurrentAnswer(elapsed);
    setPhase("finishing");
  }, [saveCurrentAnswer, secondsLeft, speakingSeconds]);

  useEffect(() => {
    if (phase !== "preparing" && phase !== "speaking") return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous > 1) return previous - 1;
        if (phase === "preparing") {
          setPhase("speaking");
          return speakingSeconds;
        }
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, speakingSeconds]);

  useEffect(() => {
    if (phase === "speaking" && secondsLeft === 0) completeSpeaking();
  }, [completeSpeaking, phase, secondsLeft]);

  useEffect(() => {
    if (phase === "speaking") void beginRecognition();
  }, [beginRecognition, phase]);

  useEffect(() => {
    if (phase !== "finishing") return undefined;
    const timeout = window.setTimeout(() => setPhase("review"), 1200);
    return () => window.clearTimeout(timeout);
  }, [phase]);

  useEffect(() => () => {
    stopRecognition();
    stopMicrophoneCheck();
    window.speechSynthesis?.cancel();
  }, [stopMicrophoneCheck, stopRecognition]);

  const evaluate = useCallback(async (allAnswers: Answer[]) => {
    if (!currentUser) {
      setAssessmentError(copy.signInRequired);
      return;
    }
    setAssessmentError("");
    setPhase("evaluating");
    try {
      const response = await fetch("/api/speaking-test/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: allAnswers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || copy.error);
      const savedReport = payload as Report & { attemptId?: string };
      setReport(savedReport);
      if (savedReport.attemptId) {
        setSavedAttempts((previous) => [{
          id: savedReport.attemptId,
          cefr: savedReport.overall.cefr,
          band: savedReport.overall.band,
          score: savedReport.overall.score,
          report: savedReport,
          completedAt: new Date().toISOString(),
        }, ...previous]);
      }
      setPhase("report");
    } catch (error) {
      setAssessmentError(error instanceof Error ? error.message : copy.error);
      setPhase("review");
    }
  }, [copy.error, copy.signInRequired, currentUser]);

  const continueFromReview = async () => {
    const currentAnswer: Answer = {
      taskNumber: taskIndex + 1,
      taskKind: task.kind,
      transcript: liveTranscript.trim(),
      durationSeconds: Math.max(1, speakingSeconds - secondsLeft),
    };
    const allAnswers = [...answers.filter((answer) => answer.taskNumber !== currentAnswer.taskNumber), currentAnswer]
      .sort((a, b) => a.taskNumber - b.taskNumber);
    setAnswers(allAnswers);
    if (taskIndex < TOEFL_STYLE_TASKS.length - 1) beginTask(taskIndex + 1);
    else await evaluate(allAnswers);
  };

  const start = () => setPhase("hardware");
  const openMicrophoneCheck = () => {
    setPhase("microphone");
    void startMicrophoneCheck();
  };
  const startTest = () => {
    stopMicrophoneCheck();
    setPhase("section");
  };
  const reset = () => {
    stopRecognition();
    stopMicrophoneCheck();
    setPhase("welcome");
    setTaskIndex(0);
    setAnswers([]);
    setTranscript("");
    setReport(null);
    setAssessmentError("");
  };

  if (phase === "welcome") {
    const criteria = [
      { title: copy.fluency, text: copy.fluencyDescription },
      { title: copy.accuracy, text: copy.accuracyDescription },
      { title: copy.range, text: copy.rangeDescription },
    ];
    return (
      <Page>
        <Hero>
          <Eyebrow><SparklesIcon width={15} />{copy.eyebrow}</Eyebrow>
          <HeroTitle>{copy.title}</HeroTitle>
          <HeroSubtitle>{copy.subtitle}</HeroSubtitle>
          <PrimaryButton onClick={start}><MicrophoneIcon />{copy.start}<ArrowRightIcon /></PrimaryButton>
          <MetaRow>
            <MetaPill>{copy.fourTasks}</MetaPill><MetaPill>{copy.minutes}</MetaPill><MetaPill>{copy.report}</MetaPill>
          </MetaRow>
          <Note>{copy.practiceOnly}</Note>
        </Hero>
        <Section>
          <SectionTitle>{copy.howItWorks}</SectionTitle>
          <InfoGrid>
            {[copy.stepOne, copy.stepTwo, copy.stepThree].map((text, index) => (
              <InfoCard key={text}><CardNumber>0{index + 1}</CardNumber><CardTitle>{text}</CardTitle></InfoCard>
            ))}
          </InfoGrid>
        </Section>
        <Section>
          <SectionTitle>{copy.rubricTitle}</SectionTitle>
          <InfoGrid>
            {criteria.map((criterion, index) => (
              <InfoCard key={criterion.title}><CardNumber>0{index + 1}</CardNumber><CardTitle>{criterion.title}</CardTitle><CardText>{criterion.text}</CardText></InfoCard>
            ))}
          </InfoGrid>
        </Section>
        <Section>
          <SectionTitle>{copy.historyTitle}</SectionTitle>
          {savedAttempts.length === 0 ? (
            <CardText>{copy.historyEmpty}</CardText>
          ) : (
            <HistoryList>
              {savedAttempts.map((attempt) => (
                <HistoryItem key={attempt.id} onClick={() => { setReport(attempt.report); setPhase("report"); }}>
                  <HistoryDate>{new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium" }).format(new Date(attempt.completedAt))}</HistoryDate>
                  <span>{attempt.cefr}</span>
                  <HistoryScore>{scoreText(attempt.score)}/100</HistoryScore>
                </HistoryItem>
              ))}
            </HistoryList>
          )}
        </Section>
      </Page>
    );
  }

  const microphoneState: "quiet" | "good" | "loud" | "idle" = !isCheckingMicrophone
    ? "idle"
    : microphoneLevel < 0.16
      ? "quiet"
      : microphoneLevel > 0.72
        ? "loud"
        : "good";
  const microphoneStatus = microphoneState === "quiet"
    ? copy.microphoneQuiet
    : microphoneState === "good"
      ? copy.microphoneGood
      : microphoneState === "loud"
        ? copy.microphoneLoud
        : copy.microphoneStart;

  if (phase === "hardware") {
    return (
      <Page>
        <SetupShell>
          <Eyebrow><SparklesIcon width={15} />{copy.setupEyebrow}</Eyebrow>
          <SetupHeading>{copy.hardwareTitle}</SetupHeading>
          <SetupBody>{copy.hardwareBody}</SetupBody>
          <SetupChecks>
            <SetupCheck><MicrophoneIcon /><span>{copy.hardwareMicrophone}</span></SetupCheck>
            <SetupCheck><ComputerDesktopIcon /><span>{copy.hardwareHeadphones}</span></SetupCheck>
            <SetupCheck><SpeakerWaveIcon /><span>{copy.hardwareQuiet}</span></SetupCheck>
          </SetupChecks>
          <ButtonRow><ContinueButton onClick={openMicrophoneCheck}>{copy.hardwareContinue}<ArrowRightIcon /></ContinueButton></ButtonRow>
        </SetupShell>
      </Page>
    );
  }

  if (phase === "microphone") {
    const activeBars = Math.round(microphoneLevel * 22);
    return (
      <Page>
        <SetupShell>
          <Eyebrow><MicrophoneIcon width={15} />{copy.setupEyebrow}</Eyebrow>
          <SetupHeading>{copy.microphoneTitle}</SetupHeading>
          <SetupBody>{copy.microphoneBody}</SetupBody>
          <MeterPanel>
            <MeterBars>{Array.from({ length: 22 }, (_, index) => <MeterBar key={index} $index={index} $active={index < activeBars} />)}</MeterBars>
            <MeterStatus $state={microphoneState}>{microphoneState === "good" && <CheckCircleIcon width={18} />}{microphoneStatus}</MeterStatus>
          </MeterPanel>
          {microphoneError && <InlineNotice $error>{microphoneError}</InlineNotice>}
          <ButtonRow>
            {!isCheckingMicrophone && <SecondaryButton onClick={() => void startMicrophoneCheck()}><MicrophoneIcon />{copy.microphoneStart}</SecondaryButton>}
            <ContinueButton onClick={startTest}>{copy.microphoneContinue}<ArrowRightIcon /></ContinueButton>
          </ButtonRow>
          <ReportNote>{copy.microphonePrivacy}</ReportNote>
        </SetupShell>
      </Page>
    );
  }

  if (phase === "section") {
    return (
      <Page>
        <SetupShell>
          <Eyebrow><SparklesIcon width={15} />{copy.eyebrow}</Eyebrow>
          <SetupHeading>{copy.sectionTitle}</SetupHeading>
          <SetupBody>{copy.sectionBody}</SetupBody>
          <SetupChecks>
            <SetupCheck><MicrophoneIcon /><span>{copy.sectionDirect}</span><CardText>{copy.sectionDirectDescription}</CardText></SetupCheck>
            <SetupCheck style={{ gridColumn: "span 2" }}><SpeakerWaveIcon /><span>{copy.sectionIntegrated}</span><CardText>{copy.sectionIntegratedDescription}</CardText></SetupCheck>
          </SetupChecks>
          <ButtonRow><ContinueButton onClick={() => beginTask(0)}>{copy.sectionContinue}<ArrowRightIcon /></ContinueButton></ButtonRow>
        </SetupShell>
      </Page>
    );
  }

  if (phase === "evaluating") {
    return <Page><TestShell><Evaluating><div><Spinner /><SectionTitle style={{ marginTop: "1.25rem" }}>{copy.evaluating}</SectionTitle><CardText>{copy.evaluatingHint}</CardText></div></Evaluating></TestShell></Page>;
  }

  if (phase === "report" && report) {
    return (
      <Page>
        <TestShell>
          <ReportHeader>
            <OverallCard>
              <Eyebrow>{copy.reportEyebrow}</Eyebrow>
              <OverallTitle>{copy.overall}: {report.overall.cefr}</OverallTitle>
              <OverallText>{report.overall.band} · {report.overall.summary}</OverallText>
            </OverallCard>
            <ScoreCard><CardText>{copy.score}</CardText><BigScore>{scoreText(report.overall.score)}</BigScore><CardText>/ 100</CardText></ScoreCard>
          </ReportHeader>
          <ReportSection>
            <SectionTitle>{copy.criteria}</SectionTitle>
            <CriteriaGrid>{report.criteria.map((criterion) => <CriterionCard key={criterion.id}>
              <CriterionTop><CriterionTitle>{criterion.label}</CriterionTitle><Level>{criterion.level} · {scoreText(criterion.score)}</Level></CriterionTop>
              <CriterionDescription>{criterion.description}</CriterionDescription>
              <DetailLabel>{copy.evidence}</DetailLabel><DetailText>{criterion.evidence}</DetailText>
              <DetailLabel>{copy.nextStep}</DetailLabel><DetailText>{criterion.nextStep}</DetailText>
            </CriterionCard>)}</CriteriaGrid>
          </ReportSection>
          <ReportSection>
            <SectionTitle>{copy.taskFeedback}</SectionTitle>
            <TaskFeedbackList>{report.taskFeedback.map((feedback) => <TaskFeedback key={feedback.taskNumber}><TaskScore>{feedback.taskNumber}<br />{scoreText(feedback.score)}</TaskScore><CardText>{feedback.feedback}</CardText></TaskFeedback>)}</TaskFeedbackList>
          </ReportSection>
          <TwoColumn>
            <ReportSection><SectionTitle>{copy.strengths}</SectionTitle><List>{report.strengths.map((item) => <ListItem key={item}>{item}</ListItem>)}</List></ReportSection>
            <ReportSection><SectionTitle>{copy.focusAreas}</SectionTitle><List>{report.focusAreas.map((item) => <ListItem key={item}>{item}</ListItem>)}</List></ReportSection>
          </TwoColumn>
          <ReportSection>
            <SectionTitle>{copy.plan}</SectionTitle>
            <Plan>{report.studyPlan.map((item) => <PlanItem key={item.day}><PlanDay>{item.day}</PlanDay><PlanGoal>{item.goal}</PlanGoal><CardText>{item.exercise}</CardText></PlanItem>)}</Plan>
            <ReportNote>{report.reportNote || copy.transcriptBased}</ReportNote>
          </ReportSection>
          <ButtonRow><SecondaryButton onClick={() => window.print()}><PrinterIcon />{copy.print}</SecondaryButton><ContinueButton onClick={reset}>{copy.takeAgain}<ArrowRightIcon /></ContinueButton></ButtonRow>
        </TestShell>
      </Page>
    );
  }

  const isSpeaking = phase === "speaking";
  const isReview = phase === "review";
  const isListenAndRepeat = task.kind === "listen_repeat";
  const isPictureDescription = task.kind === "picture_description";
  const timeBudget = isSpeaking ? speakingSeconds : preparationSeconds;
  const timeProgress = ((timeBudget - secondsLeft) / timeBudget) * 100;
  return (
    <Page>
      <TestShell>
        <Progress>{TOEFL_STYLE_TASKS.map((_, index) => <ProgressPart key={index} $complete={index < taskIndex || (index === taskIndex && isReview)} $current={index === taskIndex && !isReview} />)}</Progress>
        <TaskHeader>
          <div><TaskKicker>Question {taskIndex + 1} of {TOEFL_STYLE_TASKS.length}</TaskKicker><TaskTitle>{task.type}</TaskTitle></div>
          {!isReview && <Timer $urgent={isSpeaking && secondsLeft <= 10}><ClockIcon />{formatTimer(secondsLeft)}</Timer>}
        </TaskHeader>
        <PromptCard>
          <ExamInstruction>{isListenAndRepeat ? "Listen to the sentence, then repeat exactly what you heard." : EXAM_TEXT.questionInstruction}</ExamInstruction>
          {!isListenAndRepeat && <><PromptLabel>{EXAM_TEXT.prompt}</PromptLabel><PromptText>{task.prompt}</PromptText></>}
          {isPictureDescription && <CampusPicture />}
          {phase === "preparing" && isListenAndRepeat && <PlaybackCard>
            <PlaybackButton type="button" onClick={playPrompt} $playing={isPromptPlaying}><SpeakerWaveIcon /></PlaybackButton>
            <PlaybackCopy><strong>{isPromptPlaying ? EXAM_TEXT.promptPlaying : EXAM_TEXT.listenPrompt}</strong><span>{EXAM_TEXT.promptHint}</span></PlaybackCopy>
          </PlaybackCard>}
          {phase === "preparing" && <TimeGuide>
            <TimeGuideItem><strong>{EXAM_TEXT.preparationTime}</strong><span>{EXAM_TEXT.seconds(preparationSeconds)}</span></TimeGuideItem>
            <TimeGuideItem><strong>{EXAM_TEXT.responseTime}</strong><span>{EXAM_TEXT.seconds(speakingSeconds)}</span></TimeGuideItem>
          </TimeGuide>}
          {!isReview && <Stage>
            <StageIcon $speaking={isSpeaking}>{isSpeaking ? <MicrophoneIcon /> : <PauseCircleIcon />}</StageIcon>
            <div><StageTitle>{isSpeaking ? (isListenAndRepeat ? "Repeat the sentence now" : EXAM_TEXT.speakHeading) : EXAM_TEXT.prepareHeading}</StageTitle><StageCopy>{isSpeaking ? (isListenAndRepeat ? "Repeat the sentence you heard. The sentence is not shown on screen." : EXAM_TEXT.speakHint) : EXAM_TEXT.prepareHint}</StageCopy></div>
          </Stage>}
          {!isReview && <TimeTrack><TimeTrackFill $progress={timeProgress} $speaking={isSpeaking} /></TimeTrack>}
          {(isSpeaking || isReview) && <>
            {isReview && <ExamInstruction style={{ marginTop: "1.4rem", marginBottom: "0.25rem" }}>{EXAM_TEXT.taskCompleteHint}</ExamInstruction>}
            <TranscriptArea value={liveTranscript} onChange={(event) => { setTranscript(event.target.value); setInterimTranscript(""); }} placeholder={EXAM_TEXT.transcriptPlaceholder} aria-label={EXAM_TEXT.transcript} />
            {microphoneError && <InlineNotice $error>{microphoneError}</InlineNotice>}
            {assessmentError && <InlineNotice $error>{assessmentError}</InlineNotice>}
            <ButtonRow>
              {isSpeaking && <SecondaryButton onClick={isListening ? stopRecognition : beginRecognition}><MicrophoneIcon />{isListening ? EXAM_TEXT.microphoneOn : EXAM_TEXT.microphone}</SecondaryButton>}
              {isSpeaking && <ContinueButton onClick={completeSpeaking}>{EXAM_TEXT.taskComplete}<CheckCircleIcon /></ContinueButton>}
              {isReview && <ContinueButton onClick={continueFromReview}>{taskIndex === TOEFL_STYLE_TASKS.length - 1 ? EXAM_TEXT.finishTest : EXAM_TEXT.nextTask}<ArrowRightIcon /></ContinueButton>}
            </ButtonRow>
          </>}
        </PromptCard>
      </TestShell>
      {phase === "finishing" && <FinishOverlay role="status" aria-live="polite"><FinishDialog><CheckCircleIcon /><h2>{EXAM_TEXT.timeUpTitle}</h2><p>{EXAM_TEXT.timeUpBody}</p></FinishDialog></FinishOverlay>}
    </Page>
  );
}
