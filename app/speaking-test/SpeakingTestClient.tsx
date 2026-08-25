"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { styled } from "styled-components";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { appLayout } from "../lib/constants/app_layout";

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

const Page = styled.main`
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
  padding: 3rem ${appLayout.pageGutterDesktop} 4.5rem;
  color: #050505;

  @media (max-width: 700px) {
    padding: 2rem ${appLayout.pageGutterMobile} 3rem;
  }
`;

const Hero = styled.section`
  position: relative;
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 18px;
  background: #050505;
  padding: 3.25rem;
  color: #fff;
  box-shadow: 7px 7px 0 #f47a4a;

  &::after {
    position: absolute;
    width: 460px;
    height: 460px;
    right: -190px;
    bottom: -270px;
    border: 42px solid rgba(244, 122, 74, 0.48);
    border-radius: 50%;
    content: "";
  }

  @media (max-width: 700px) { padding: 2.25rem 1.5rem; border-radius: 22px; }
`;

const Eyebrow = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  margin: 0 0 0.9rem;
  color: #f47a4a;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const HeroTitle = styled.h1`
  max-width: 690px;
  margin: 0;
  color: #fff;
  font-size: clamp(2rem, 4.7vw, 3.5rem);
  font-weight: 850;
  letter-spacing: -0.05em;
  line-height: 1.08;
`;

const HeroSubtitle = styled.p`
  max-width: 625px;
  margin: 1.15rem 0 1.75rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 1.04rem;
  line-height: 1.65;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 50px;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 0.8rem 1.2rem;
  background: #fff;
  color: #050505;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 4px 4px 0 #f47a4a;
  transition: transform 140ms ease, box-shadow 140ms ease;

  &:hover { transform: translate(-1px, -1px); box-shadow: 6px 6px 0 #f47a4a; }
  &:disabled { cursor: wait; opacity: 0.72; transform: none; }
  svg { width: 19px; height: 19px; }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.8rem;
`;

const MetaPill = styled.span`
  border: 1px solid rgba(255, 255, 255, 0.48);
  border-radius: 999px;
  padding: 0.42rem 0.72rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
`;

const Note = styled.p`
  margin: 0.9rem 0 0;
  color: rgba(255, 255, 255, 0.59);
  font-size: 0.75rem;
  line-height: 1.5;
`;

const Section = styled.section`
  margin-top: 3.25rem;
`;

const SectionTitle = styled.h2`
  margin: 0 0 1.2rem;
  font-size: 1.35rem;
  font-weight: 850;
  letter-spacing: -0.035em;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const HistoryList = styled.div`
  border-top: 2px solid #050505;
`;

const HistoryItem = styled.button`
  display: grid;
  width: 100%;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 1rem;
  border: 0;
  border-bottom: 1px solid rgba(5, 5, 5, 0.24);
  background: transparent;
  padding: 0.9rem 0;
  color: #050505;
  font: inherit;
  text-align: left;
  cursor: pointer;
  &:hover { color: #c84932; }
  @media (max-width: 540px) { grid-template-columns: 1fr auto; }
`;

const HistoryDate = styled.span`
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.82rem;
  font-weight: 700;
`;

const HistoryScore = styled.strong`
  color: #f47a4a;
  font-size: 1.04rem;
  font-weight: 900;
`;

const InfoCard = styled.div`
  min-height: 145px;
  border: 2px solid #050505;
  border-radius: 12px;
  padding: 1.3rem;
  background: #fff8dc;
  box-shadow: 4px 4px 0 #050505;
`;

const CardNumber = styled.span`
  display: flex;
  width: 29px;
  height: 29px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f47a4a;
  color: #050505;
  font-size: 0.78rem;
  font-weight: 850;
`;

const CardTitle = styled.h3`
  margin: 0.75rem 0 0.3rem;
  font-size: 1rem;
  font-weight: 800;
`;

const CardText = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.87rem;
  line-height: 1.55;
`;

const TestShell = styled.section`
  max-width: 880px;
  margin: 0 auto;
`;

const SetupShell = styled.section`
  max-width: 720px;
  margin: 2.5rem auto 0;
  border: 2px solid #050505;
  border-radius: 16px;
  padding: clamp(1.5rem, 5vw, 3.1rem);
  background: #fff;
  box-shadow: 6px 6px 0 #f47a4a;
`;

const SetupHeading = styled.h1`
  margin: 0;
  color: #050505;
  font-size: clamp(1.9rem, 4vw, 2.75rem);
  font-weight: 850;
  letter-spacing: -0.05em;
  line-height: 1.12;
`;

const SetupBody = styled.p`
  max-width: 595px;
  margin: 1rem 0 0;
  color: rgba(5, 5, 5, 0.68);
  font-size: 1rem;
  line-height: 1.7;
`;

const SetupChecks = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin: 2rem 0;
  @media (max-width: 620px) { grid-template-columns: 1fr; }
`;

const SetupCheck = styled.div`
  display: grid;
  min-height: 135px;
  place-items: center;
  gap: 0.6rem;
  border: 1.5px solid #050505;
  border-radius: 10px;
  padding: 1.1rem 0.7rem;
  background: #fff8dc;
  color: #050505;
  text-align: center;
  svg { width: 35px; height: 35px; }
  span { color: #050505; font-size: 0.83rem; font-weight: 800; }
`;

const MeterPanel = styled.div`
  margin: 2.1rem 0 1.15rem;
  border-top: 2px solid #050505;
  border-bottom: 2px solid #050505;
  padding: clamp(1.2rem, 4vw, 2rem);
  background: #fff8dc;
`;

const MeterBars = styled.div`
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 5px;
  min-height: 78px;
`;

const MeterBar = styled.span<{ $active: boolean; $index: number }>`
  width: 9px;
  height: ${({ $index }) => 28 + (($index % 5) * 10)}px;
  background: ${({ $active, $index }) =>
    $active ? ($index > 17 ? "#f47a4a" : "#050505") : "#ddd7c7"};
  transition: background 90ms ease;
`;

const MeterStatus = styled.div<{ $state: "quiet" | "good" | "loud" | "idle" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.15rem;
  color: ${({ $state }) =>
    $state === "loud" ? "#c84932" : $state === "good" ? "#050505" : "rgba(5, 5, 5, 0.58)"};
  font-size: 0.9rem;
  font-weight: 850;
`;

const TimeGuide = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  margin: 1.7rem 0 0;
  border-top: 2px solid #050505;
  border-bottom: 2px solid #050505;
`;

const TimeGuideItem = styled.div`
  padding: 0.82rem 1rem;
  &:first-child { border-right: 2px solid #050505; }
  strong { display: block; color: #f47a4a; font-size: 0.72rem; font-weight: 850; letter-spacing: 0.07em; text-transform: uppercase; }
  span { display: block; margin-top: 0.2rem; color: #050505; font-size: 0.94rem; font-weight: 850; }
`;

const ExamInstruction = styled.p`
  margin: 0 0 1.4rem;
  color: rgba(5, 5, 5, 0.66);
  font-size: 1rem;
  line-height: 1.6;
`;

const TimeTrack = styled.div`
  height: 6px;
  overflow: hidden;
  margin-top: 1.25rem;
  background: #dfd9ca;
`;

const TimeTrackFill = styled.div<{ $progress: number; $speaking: boolean }>`
  width: ${({ $progress }) => `${Math.max(0, Math.min(100, $progress))}%`};
  height: 100%;
  background: ${({ $speaking }) => ($speaking ? "#050505" : "#f47a4a")};
  transition: width 900ms linear;
`;

const PlaybackCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.95rem;
  margin-top: 1.4rem;
  border-top: 1px solid #050505;
  border-bottom: 1px solid #050505;
  padding: 0.9rem 0;
`;

const PlaybackButton = styled.button<{ $playing: boolean }>`
  display: grid;
  width: 43px;
  height: 43px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid #050505;
  border-radius: 50%;
  background: ${({ $playing }) => ($playing ? "#f47a4a" : "#050505")};
  color: ${({ $playing }) => ($playing ? "#050505" : "#fff")};
  cursor: pointer;
  svg { width: 21px; height: 21px; }
`;

const PlaybackCopy = styled.div`
  min-width: 0;
  strong { display: block; color: #050505; font-size: 0.86rem; font-weight: 850; }
  span { display: block; margin-top: 0.16rem; color: rgba(5, 5, 5, 0.62); font-size: 0.78rem; line-height: 1.45; }
`;

const FinishOverlay = styled.div`
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(5, 5, 5, 0.58);
`;

const FinishDialog = styled.div`
  width: min(100%, 460px);
  border: 2px solid #050505;
  border-radius: 16px;
  padding: 2rem;
  background: #fff;
  box-shadow: 8px 8px 0 #f47a4a;
  text-align: center;
  svg { width: 38px; height: 38px; color: #f47a4a; }
  h2 { margin: 0.7rem 0 0; color: #050505; font-size: 1.6rem; font-weight: 850; }
  p { margin: 0.65rem 0 0; color: rgba(5, 5, 5, 0.68); font-size: 0.94rem; line-height: 1.58; }
`;

const Progress = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 1.45rem;
`;

const ProgressPart = styled.div<{ $complete: boolean; $current: boolean }>`
  height: 6px;
  flex: 1;
  background: ${({ $complete, $current }) => ($complete ? "#f47a4a" : $current ? "#050505" : "#ded8cb")};
`;

const TaskHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #050505;
  padding-bottom: 1rem;
`;

const TaskKicker = styled.p`
  margin: 0 0 0.35rem;
  color: #f47a4a;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const TaskTitle = styled.h1`
  margin: 0;
  color: #050505;
  font-size: clamp(1.7rem, 4vw, 2.45rem);
  font-weight: 850;
  letter-spacing: -0.05em;
`;

const Timer = styled.div<{ $urgent: boolean }>`
  display: inline-flex;
  flex: 0 0 auto;
  min-width: 92px;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 0.68rem 0.75rem;
  background: ${({ $urgent }) => ($urgent ? "#f47a4a" : "#fff8dc")};
  color: #050505;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  font-weight: 850;
  svg { width: 18px; height: 18px; }
`;

const PromptCard = styled.article`
  padding: 0 0 1.5rem;
`;

const PromptLabel = styled.h2`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.6rem;
  color: #f47a4a;
  font-size: 0.77rem;
  font-weight: 850;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  svg { width: 17px; height: 17px; }
`;

const PromptText = styled.p`
  margin: 0;
  color: #050505;
  font-size: clamp(1.2rem, 2.25vw, 1.55rem);
  font-weight: 850;
  line-height: 1.5;
`;

const SourceGrid = styled.div`
  display: grid;
  gap: 0.9rem;
  margin: 1.35rem 0;
`;

const SourceCard = styled.div`
  border-left: 3px solid #f47a4a;
  padding: 0.2rem 0 0.2rem 0.95rem;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.87rem;
  line-height: 1.58;
`;

const SourceLabel = styled.strong`
  display: block;
  margin-bottom: 0.4rem;
  color: #050505;
  font-size: 0.73rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
`;

const PicturePrompt = styled.div`
  width: min(100%, 620px);
  margin: 1.45rem auto 0;
  border: 2px solid #050505;
  background: #fff8dc;

  svg { display: block; width: 100%; height: auto; }
`;

const Stage = styled.div<{ $speaking: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 1.35rem;
  border-top: 1px solid #050505;
  padding: 1rem 0;
  color: #050505;
`;

const StageIcon = styled.div<{ $speaking: boolean }>`
  display: grid;
  width: 37px;
  height: 37px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid #050505;
  border-radius: 50%;
  background: ${({ $speaking }) => ($speaking ? "#050505" : "#f47a4a")};
  color: ${({ $speaking }) => ($speaking ? "#fff" : "#050505")};
  svg { width: 20px; height: 20px; }
`;

const StageTitle = styled.strong`
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.92rem;
`;

const StageCopy = styled.span`
  display: block;
  font-size: 0.82rem;
  line-height: 1.45;
`;

const TranscriptArea = styled.textarea`
  width: 100%;
  min-height: 160px;
  margin-top: 1rem;
  resize: vertical;
  border: 2px solid #050505;
  border-radius: 10px;
  padding: 1rem;
  outline: none;
  background: #fff;
  color: #050505;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1.62;
  &:focus { border-color: #050505; box-shadow: 4px 4px 0 #f47a4a; }
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
  margin-top: 1rem;
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  min-height: 45px;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 0.7rem 0.9rem;
  background: #fff8dc;
  color: #050505;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  svg { width: 18px; height: 18px; }
`;

const ContinueButton = styled(PrimaryButton)`
  min-height: 45px;
  background: #050505;
  color: #fff;
  box-shadow: 4px 4px 0 #f47a4a;
`;

const InlineNotice = styled.p<{ $error?: boolean }>`
  margin: 0.7rem 0 0;
  color: ${({ $error }) => ($error ? "#c84932" : "rgba(5, 5, 5, 0.62)")};
  font-size: 0.78rem;
  line-height: 1.5;
`;

const Evaluating = styled.div`
  display: grid;
  min-height: 390px;
  place-items: center;
  text-align: center;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #fff0c3;
  border-top-color: #f47a4a;
  border-radius: 50%;
  animation: spin 0.85s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const ReportHeader = styled.section`
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 1rem;
  margin-bottom: 1rem;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const OverallCard = styled.div`
  border: 2px solid #050505;
  border-radius: 14px;
  padding: 1.7rem;
  background: #050505;
  color: #fff;
  box-shadow: 6px 6px 0 #f47a4a;
`;

const OverallTitle = styled.h1`
  margin: 0.35rem 0 0;
  color: #fff;
  font-size: 2rem;
  font-weight: 850;
  letter-spacing: -0.045em;
`;

const OverallText = styled.p`
  margin: 0.8rem 0 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.91rem;
  line-height: 1.6;
`;

const ScoreCard = styled.div`
  display: flex;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #fff8dc;
`;

const BigScore = styled.strong`
  color: #f47a4a;
  font-size: 3rem;
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  letter-spacing: -0.08em;
`;

const ReportSection = styled.section`
  margin-top: 1.15rem;
  border-top: 2px solid #050505;
  padding: 1.35rem 0 0;
`;

const CriteriaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.9rem;
  @media (max-width: 740px) { grid-template-columns: 1fr; }
`;

const CriterionCard = styled.article`
  border-left: 3px solid #f47a4a;
  padding: 0.25rem 0 0.25rem 0.95rem;
`;

const CriterionTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
`;

const CriterionTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 850;
`;

const Level = styled.span`
  color: #f47a4a;
  font-size: 0.83rem;
  font-weight: 850;
`;

const CriterionDescription = styled.p`
  margin: 0.75rem 0;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.86rem;
  line-height: 1.55;
`;

const DetailLabel = styled.strong`
  display: block;
  margin: 0.7rem 0 0.2rem;
  color: #f47a4a;
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const DetailText = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.8rem;
  line-height: 1.5;
`;

const TwoColumn = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1.15rem;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const List = styled.ul`
  display: grid;
  gap: 0.68rem;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const ListItem = styled.li`
  position: relative;
  padding-left: 1.2rem;
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.88rem;
  line-height: 1.52;
  &::before { position: absolute; left: 0; top: 0.48rem; width: 7px; height: 7px; border-radius: 50%; background: #f47a4a; content: ""; }
`;

const TaskFeedbackList = styled.div`
  display: grid;
  gap: 0.65rem;
`;

const TaskFeedback = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  align-items: start;
  border-left: 3px solid #050505;
  padding: 0.25rem 0 0.25rem 0.85rem;
`;

const TaskScore = styled.span`
  display: inline-grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  background: #f47a4a;
  color: #050505;
  font-size: 0.79rem;
  font-weight: 850;
`;

const Plan = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.7rem;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const PlanItem = styled.article`
  border-left: 3px solid #f47a4a;
  padding: 0.35rem 0 0.35rem 0.75rem;
`;

const PlanDay = styled.strong`
  display: block;
  color: #f47a4a;
  font-size: 0.74rem;
  font-weight: 850;
  letter-spacing: 0.07em;
  text-transform: uppercase;
`;

const PlanGoal = styled.h3`
  margin: 0.35rem 0;
  font-size: 0.92rem;
  font-weight: 800;
`;

const ReportNote = styled.p`
  margin: 1.1rem 0 0;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.76rem;
  line-height: 1.55;
`;

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
          {!isReview && <Stage $speaking={isSpeaking}>
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
