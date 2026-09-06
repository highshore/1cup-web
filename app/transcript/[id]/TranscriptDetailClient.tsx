"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, invokeFunction } from "../../lib/supabase/client";
import { useSoniox } from "../hooks/useSoniox";
import { UserAvatar } from "../../lib/features/meetup/components/user_avatar";
import {
  fetchUserProfiles,
  UserProfile,
} from "../../lib/features/meetup/services/user_service";
import { useTranscriptCopilot } from "../hooks/useTranscriptCopilot";
import CopilotTranscriptSnippet from "../components/CopilotTranscriptSnippet";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

ChartJS.register(ArcElement, Tooltip, Legend);

// Local Tailwind components matching the original styled-components
type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SectionProps = React.HTMLAttributes<HTMLElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;
type ParagraphProps = React.HTMLAttributes<HTMLParagraphElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type UlProps = React.HTMLAttributes<HTMLUListElement>;
type LiProps = React.LiHTMLAttributes<HTMLLIElement>;

const scoreColorClass = (score: number) => {
  if (score >= 8) return "text-[#10b981]";
  if (score >= 6) return "text-[#f59e0b]";
  return "text-[#ef4444]";
};

function ConversationDetailContainer({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`w-full ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ConversationDetailLeft({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-col gap-8 w-full ${className}`} {...rest}>
      {children}
    </div>
  );
}

function AppSpeechDetails({ className = "", children, ...rest }: SectionProps) {
  return (
    <section className={`bg-transparent border-none rounded-none p-0 mb-6 ${className}`} {...rest}>
      {children}
    </section>
  );
}

function SectionHeader({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h2
      className={`text-[1.125rem] font-black text-[#050505] m-0 mb-4 pb-3 border-b-2 border-[#050505] flex justify-between items-center ${className}`}
      {...rest}
    >
      {children}
    </h2>
  );
}

function TranscriptSnippet({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`flex gap-3 items-start mb-3 w-full [transition:background-color_0.3s_ease] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function SpeakerAvatar({
  $bgColor,
  $textColor,
  className = "",
  style,
  children,
  ...rest
}: { $bgColor?: string; $textColor?: string } & ButtonProps) {
  return (
    <button
      className={`w-10 h-10 shrink-0 rounded-full border-2 border-[#050505] text-[1rem] font-extrabold flex items-center justify-center cursor-pointer shadow-[2px_2px_0_rgba(5,5,5,0.9)] [transition:transform_0.16s_ease,box-shadow_0.16s_ease] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_rgba(5,5,5,0.9)] focus-visible:outline-2 focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2 ${className}`}
      style={{
        backgroundColor: $bgColor || "#e5e7eb",
        color: $textColor || "#4b5563",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function TranscriptContent({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-col gap-0.5 w-full min-w-0 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function TranscriptHeadRow({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function SpeakerName({
  $color,
  className = "",
  style,
  children,
  ...rest
}: { $color?: string } & SpanProps) {
  return (
    <span
      className={`font-extrabold text-[1rem] ${className}`}
      style={{ color: $color || "#050505", ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}

function Timestamp({ className = "", children, ...rest }: SpanProps) {
  return (
    <span className={`text-[0.875rem] text-[rgba(5,5,5,0.6)] ${className}`} {...rest}>
      {children}
    </span>
  );
}

function TranscriptBody({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`leading-[1.7] text-[#050505] cursor-default bg-transparent border-none rounded-none p-0 mt-1 break-words hyphens-auto w-full select-text whitespace-normal ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function WordSpan({
  $lowConfidence,
  $isPartial,
  $isCurrentlyPlaying,
  $isPunctuation,
  className = "",
  children,
  ...rest
}: {
  $lowConfidence?: boolean;
  $isPartial?: boolean;
  $isCurrentlyPlaying?: boolean;
  $isPunctuation?: boolean;
} & SpanProps) {
  const color = $isCurrentlyPlaying
    ? "text-[#050505]"
    : $lowConfidence
      ? "text-[#b91c1c]"
      : $isPartial
        ? "text-[rgba(5,5,5,0.55)]"
        : "";
  const weight = $isCurrentlyPlaying
    ? "font-extrabold"
    : $lowConfidence
      ? "font-bold"
      : "font-normal";
  return (
    <span
      className={`${color} ${$isCurrentlyPlaying ? "bg-[#f47a4a]" : "bg-transparent"} ${weight} ${
        $isPartial ? "italic opacity-70" : "not-italic opacity-100"
      } ${$lowConfidence ? "underline" : "no-underline"} decoration-[#fecaca] underline-offset-2 [transition:all_0.2s_ease] rounded-[4px] [word-break:break-word] ${
        $isCurrentlyPlaying ? "py-0.5 px-1" : "p-0"
      } cursor-pointer ${
        $isCurrentlyPlaying
          ? "hover:bg-[#f47a4a]"
          : "hover:bg-[rgba(244,122,74,0.18)]"
      } ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

function Container({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`min-h-screen text-[#050505] bg-transparent [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] pb-[80px] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function RecordButton({
  $isRecording,
  className = "",
  children,
  ...rest
}: { $isRecording: boolean } & ButtonProps) {
  return (
    <button
      className={`flex items-center gap-2 py-[0.7rem] px-[1.4rem] border-2 border-[#050505] rounded-full text-[0.875rem] font-extrabold cursor-pointer shadow-[3px_3px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] ${
        $isRecording ? "bg-[#d64545] text-white" : "bg-[#f47a4a] text-[#050505]"
      } hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#050505] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Content({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`pt-0 px-0 pb-8 max-w-[900px] mx-auto bg-transparent ${className}`} {...rest}>
      {children}
    </div>
  );
}

function SessionInfo({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`p-6 bg-white rounded-[16px] border-[3px] border-[#050505] shadow-[6px_6px_0_rgba(5,5,5,0.9)] mb-8 h-full ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function SessionInfoGrid({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`grid grid-cols-[1fr_minmax(260px,360px)] gap-4 items-stretch mb-8 max-[900px]:grid-cols-1 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ChartPanel({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`p-6 bg-white rounded-[16px] border-[3px] border-[#050505] shadow-[6px_6px_0_rgba(5,5,5,0.9)] h-full ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ChartTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h3 className={`m-0 mb-4 text-[1.25rem] font-black text-[#050505] ${className}`} {...rest}>
      {children}
    </h3>
  );
}

function SessionTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h2 className={`text-[1.25rem] font-black text-[#050505] m-0 mb-4 ${className}`} {...rest}>
      {children}
    </h2>
  );
}

function SessionDetail({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`mb-3 text-[0.875rem] text-[rgba(5,5,5,0.6)] [&_strong]:text-[#050505] [&_strong]:font-extrabold ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ParticipantsList({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-wrap gap-2 mt-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ParticipantChip({
  $isLeader,
  className = "",
  children,
  ...rest
}: { $isLeader?: boolean } & DivProps) {
  return (
    <div
      className={`flex items-center gap-2 py-[0.375rem] px-[0.8rem] rounded-full text-[0.875rem] font-extrabold ${
        $isLeader ? "bg-[#f47a4a]" : "bg-white"
      } text-[#050505] border-2 border-[#050505] [transition:all_0.2s_ease] hover:-translate-x-px hover:-translate-y-px ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function LoadingMessage({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`flex items-center justify-center py-16 px-8 text-[rgba(5,5,5,0.6)] font-bold text-[1rem] bg-white rounded-[12px] border-2 border-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.9)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ErrorMessage({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`mb-8 py-4 px-6 bg-[#fef2f2] text-[#991b1b] rounded-[12px] border-2 border-[#d64545] shadow-[4px_4px_0_rgba(214,69,69,0.4)] text-[0.875rem] font-bold ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function EmptyState({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`text-center text-[rgba(5,5,5,0.6)] italic font-bold py-16 px-8 text-[1rem] bg-white rounded-[12px] border-2 border-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.9)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function LegendContent({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-start flex-col gap-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function LegendSpeakers({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex gap-4 flex-wrap ${className}`} {...rest}>
      {children}
    </div>
  );
}

function LegendItem({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-center text-[0.75rem] font-bold text-[rgba(5,5,5,0.6)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function LegendColor({
  $color,
  className = "",
  style,
  ...rest
}: { $color: string } & DivProps) {
  return (
    <div
      className={`w-[10px] h-[10px] border-[1.5px] border-[#050505] rounded-full mr-[0.375rem] ${className}`}
      style={{ backgroundColor: $color, ...style }}
      {...rest}
    />
  );
}

function ConfidenceNote({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-[0.6875rem] text-[rgba(5,5,5,0.55)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

// Audio Player Components
function AudioPlayerContainer({
  $isVisible,
  className = "",
  style,
  children,
  ...rest
}: { $isVisible: boolean } & DivProps) {
  return (
    <div
      className={`fixed bottom-0 left-1/2 w-full max-w-[850px] bg-white text-[#050505] p-4 flex items-center justify-between border-[3px] border-[#050505] border-b-0 shadow-[0_-6px_0_rgba(5,5,5,0.9)] [transition:transform_0.3s_ease] z-[100] rounded-tl-[16px] rounded-tr-[16px] box-border max-[768px]:p-[0.8rem] max-[768px]:flex-wrap ${className}`}
      style={{
        transform: `translateX(-50%) translateY(${$isVisible ? "0" : "100%"})`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function AudioControls({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`flex items-center gap-[0.8rem] my-0 mx-[0.3rem] flex-nowrap max-[768px]:gap-2 max-[768px]:mx-[0.2rem] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function AudioButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`bg-[#f47a4a] text-[#050505] border-2 border-[#050505] text-[1.5rem] cursor-pointer flex items-center justify-center [transition:transform_0.16s_ease,box-shadow_0.16s_ease] w-10 h-10 rounded-full shadow-[2px_2px_0_#050505] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0_#050505] max-[768px]:text-[1.3rem] max-[768px]:w-9 max-[768px]:h-9 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function AudioProgress({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`flex-1 h-[10px] bg-[#f3f3f1] border-2 border-[#050505] rounded-full overflow-hidden relative my-0 mx-4 cursor-pointer max-[768px]:mx-[0.8rem] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function AudioProgressFill({
  $progress,
  className = "",
  style,
  ...rest
}: { $progress: number } & DivProps) {
  return (
    <div
      className={`absolute top-0 left-0 h-full bg-[#f47a4a] rounded-full ${className}`}
      style={{ width: `${$progress}%`, ...style }}
      {...rest}
    />
  );
}

function AudioTime({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`text-[0.9rem] text-[#050505] font-extrabold tabular-nums my-0 mx-2 min-w-[50px] text-center max-[768px]:text-[0.8rem] max-[768px]:min-w-[44px] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function SpeedButton({
  $active,
  className = "",
  children,
  ...rest
}: { $active: boolean } & ButtonProps) {
  return (
    <button
      className={`${
        $active ? "bg-[#f47a4a]" : "bg-white"
      } text-[#050505] border-2 border-[#050505] rounded-full py-[0.3rem] px-[0.6rem] text-[0.85rem] font-extrabold cursor-pointer shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] hover:bg-[#f47a4a] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0_#050505] max-[768px]:text-[0.75rem] max-[768px]:py-1 max-[768px]:px-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Keyword Management Components
function KeywordManagementSection({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`mb-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function KeywordInputContainer({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex gap-2 mb-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function KeywordInput({ className = "", ...rest }: InputProps) {
  return (
    <input
      className={`flex-1 py-2 px-3 border-2 border-[#050505] rounded-[10px] text-[0.875rem] font-semibold text-[#050505] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a] ${className}`}
      {...rest}
    />
  );
}

function AddKeywordButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`py-2 px-[1.1rem] bg-[#f47a4a] text-[#050505] border-2 border-[#050505] rounded-full text-[0.875rem] font-extrabold cursor-pointer shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function KeywordsList({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function KeywordChip({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`flex items-center gap-2 py-[0.375rem] px-3 bg-white text-[#050505] border-[1.5px] border-[#050505] rounded-full text-[0.875rem] font-bold ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function RemoveKeywordButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`bg-transparent border-none text-[#d64545] cursor-pointer p-0 w-4 h-4 flex items-center justify-center rounded-full font-extrabold [transition:background_0.2s_ease] hover:bg-[rgba(214,69,69,0.15)] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function ArticleLink({ className = "", children, ...rest }: AnchorProps) {
  return (
    <a
      className={`text-[#050505] underline decoration-[#f47a4a] decoration-2 underline-offset-2 font-extrabold hover:text-[#f47a4a] ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}

// Speaker Assignment Modal Components
function ModalOverlay({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[1000] p-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ModalContainer({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`bg-white rounded-[16px] p-8 max-w-[500px] w-full max-h-[80vh] overflow-y-auto border-[3px] border-[#050505] shadow-[8px_8px_0_rgba(5,5,5,0.9)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ModalTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h3 className={`text-[1.25rem] font-black text-[#050505] m-0 mb-4 text-center ${className}`} {...rest}>
      {children}
    </h3>
  );
}

function ModalSubtitle({ className = "", children, ...rest }: ParagraphProps) {
  return (
    <p className={`text-[rgba(5,5,5,0.6)] m-0 mb-8 text-center text-[0.875rem] ${className}`} {...rest}>
      {children}
    </p>
  );
}

function ParticipantGrid({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`grid gap-3 mb-8 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ParticipantOption({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`flex items-center gap-4 p-4 border-2 border-[#050505] rounded-[12px] bg-white cursor-pointer shadow-[3px_3px_0_rgba(5,5,5,0.9)] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] text-left w-full hover:bg-[#faf8f4] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_rgba(5,5,5,0.9)] focus:outline-none focus:shadow-[4px_4px_0_#f47a4a] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function ParticipantInfo({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ParticipantName({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`font-extrabold text-[#050505] text-[1rem] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ParticipantRole({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-[0.75rem] text-[rgba(5,5,5,0.6)] uppercase font-bold ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ModalActions({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex gap-3 justify-end ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ModalButton({
  $variant,
  className = "",
  children,
  ...rest
}: { $variant?: "primary" | "secondary" } & ButtonProps) {
  return (
    <button
      className={`py-3 px-6 rounded-full font-extrabold text-[0.875rem] cursor-pointer border-2 border-[#050505] shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] ${
        $variant === "primary" ? "bg-[#f47a4a]" : "bg-white"
      } text-[#050505] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] hover:bg-[#f47a4a] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function ToggleButton({
  $active,
  className = "",
  children,
  ...rest
}: { $active: boolean } & ButtonProps) {
  return (
    <button
      className={`py-2 px-[0.9rem] rounded-full text-[0.8rem] font-extrabold cursor-pointer border-2 border-[#050505] shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] ${
        $active ? "bg-[#f47a4a]" : "bg-white"
      } text-[#050505] hover:bg-[#f47a4a] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function RecordingControls({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function PauseResumeButton({
  $isRecording,
  className = "",
  children,
  ...rest
}: { $isRecording: boolean } & ButtonProps) {
  return (
    <button
      className={`flex items-center gap-2 py-[0.7rem] px-[1.4rem] border-2 border-[#050505] rounded-full text-[0.875rem] font-extrabold cursor-pointer shadow-[3px_3px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] ${
        $isRecording ? "text-white bg-[#d64545]" : "text-[#050505] bg-[#f47a4a]"
      } hover:enabled:-translate-x-px hover:enabled:-translate-y-px hover:enabled:shadow-[4px_4px_0_#050505] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function StopRecordingButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`flex items-center gap-2 py-[0.7rem] px-[1.4rem] border-2 border-[#050505] rounded-full bg-white text-[#b91c1c] cursor-pointer text-[0.875rem] font-extrabold shadow-[3px_3px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] hover:enabled:bg-[#fff1f1] hover:enabled:-translate-x-px hover:enabled:-translate-y-px hover:enabled:shadow-[4px_4px_0_#050505] disabled:cursor-not-allowed disabled:opacity-[0.55] disabled:shadow-none ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Report Dialog components
function ReportDialogOverlay({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[1000] p-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ReportDialogContainer({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`bg-white rounded-[16px] p-8 max-w-[500px] w-full max-h-[80vh] overflow-y-auto border-[3px] border-[#050505] shadow-[8px_8px_0_rgba(5,5,5,0.9)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ReportDialogTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h3 className={`text-[1.5rem] font-black text-[#050505] m-0 mb-4 text-center ${className}`} {...rest}>
      {children}
    </h3>
  );
}

function ReportDialogContent({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-[rgba(5,5,5,0.6)] m-0 mb-8 text-center leading-[1.6] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ReportDialogActions({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex gap-3 justify-end ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ReportDialogButton({
  $variant,
  className = "",
  children,
  ...rest
}: { $variant?: "primary" | "secondary" } & ButtonProps) {
  const variantClasses =
    $variant === "primary"
      ? "bg-[#f47a4a] text-[#050505] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
      : "bg-white text-[#050505] hover:bg-[#f47a4a] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505]";
  return (
    <button
      className={`py-3 px-6 rounded-full font-extrabold text-[0.875rem] cursor-pointer border-2 border-[#050505] shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] flex items-center gap-2 ${variantClasses} focus:outline-none focus:shadow-[2px_2px_0_#f47a4a] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Report display components
function ReportsSection({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`my-8 mx-0 p-6 bg-white rounded-[16px] border-[3px] border-[#050505] shadow-[6px_6px_0_rgba(5,5,5,0.9)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ReportCard({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`bg-white rounded-[12px] p-6 mb-4 border-2 border-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.9)] cursor-pointer [transition:transform_0.16s_ease,box-shadow_0.16s_ease] hover:shadow-[5px_5px_0_rgba(5,5,5,0.9)] hover:-translate-x-px hover:-translate-y-px last:mb-0 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ReportHeader({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex justify-between items-center mb-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ReportUserName({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h4
      className={`text-[1.125rem] font-extrabold text-[#050505] m-0 flex items-center gap-2 ${className}`}
      {...rest}
    >
      {children}
    </h4>
  );
}

function ReportScore({
  $score,
  className = "",
  children,
  ...rest
}: { $score: number } & DivProps) {
  return (
    <div className={`text-[1.5rem] font-bold ${scoreColorClass($score)} ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ReportMetrics({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4 mb-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ReportMetric({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-center ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ReportMetricValue({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-[1.25rem] font-extrabold text-[#050505] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ReportMetricLabel({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-[0.75rem] text-[rgba(5,5,5,0.6)] uppercase font-bold ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ReportPreview({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-[0.875rem] text-[rgba(5,5,5,0.6)] leading-[1.5] ${className}`} {...rest}>
      {children}
    </div>
  );
}

// Detailed report modal components
function DetailedReportModal({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[1100] p-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function DetailedReportContainer({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`bg-white rounded-[16px] p-8 max-w-[800px] w-full max-h-[90vh] overflow-y-auto border-[3px] border-[#050505] shadow-[8px_8px_0_rgba(5,5,5,0.9)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function DetailedReportTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h2 className={`text-[1.75rem] font-black text-[#050505] m-0 mb-8 text-center ${className}`} {...rest}>
      {children}
    </h2>
  );
}

function ScoreGrid({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ScoreCard({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`bg-white border-2 border-[#050505] rounded-[12px] shadow-[3px_3px_0_rgba(5,5,5,0.9)] p-4 text-center ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function ScoreTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h4
      className={`text-[0.875rem] font-extrabold text-[rgba(5,5,5,0.6)] m-0 mb-2 uppercase ${className}`}
      {...rest}
    >
      {children}
    </h4>
  );
}

function ScoreValue({
  $score,
  className = "",
  children,
  ...rest
}: { $score: number } & DivProps) {
  return (
    <div className={`text-[2rem] font-bold ${scoreColorClass($score)} mb-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ScoreFeedback({ className = "", children, ...rest }: ParagraphProps) {
  return (
    <p className={`text-[0.875rem] text-[rgba(5,5,5,0.6)] m-0 leading-[1.4] ${className}`} {...rest}>
      {children}
    </p>
  );
}

function FeedbackSection({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`mb-8 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function FeedbackTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h3 className={`text-[1.25rem] font-black text-[#050505] m-0 mb-4 ${className}`} {...rest}>
      {children}
    </h3>
  );
}

function FeedbackList({ className = "", children, ...rest }: UlProps) {
  return (
    <ul className={`list-none p-0 m-0 ${className}`} {...rest}>
      {children}
    </ul>
  );
}

function FeedbackItem({ className = "", children, ...rest }: LiProps) {
  return (
    <li
      className={`p-3 mb-2 bg-white rounded-[10px] border-[1.5px] border-[#050505] border-l-[5px] border-l-[#f47a4a] text-[0.875rem] leading-[1.5] text-[rgba(5,5,5,0.72)] last:mb-0 ${className}`}
      {...rest}
    >
      {children}
    </li>
  );
}

function TranscriptSection({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`mt-8 pt-8 border-t-2 border-[#050505] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function TranscriptTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h3
      className={`inline-flex items-center gap-2 text-[1.25rem] font-black text-[#050505] m-0 mb-4 [&_svg]:w-5 [&_svg]:h-5 ${className}`}
      {...rest}
    >
      {children}
    </h3>
  );
}

function TranscriptText({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`bg-white rounded-[10px] p-4 [font-family:'Courier_New',monospace] text-[0.875rem] leading-[1.6] text-[rgba(5,5,5,0.72)] max-h-[200px] overflow-y-auto border-2 border-[#050505] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// Icon components
const RecordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const PulseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="3">
      <animate
        attributeName="r"
        values="3;5;3"
        dur="1.5s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="1;0.5;1"
        dur="1.5s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

// Interfaces
interface TranscriptData {
  id: string;
  eventId: string;
  sessionNumber: number;
  articleId: string;
  leaderUids: string[];
  participantUids: string[];
  createdAt: Date;
  createdBy: string;
  speakerMappings?: Record<string, string>; // speaker ID -> participant UID
  customKeywords?: string[]; // Custom keywords for this transcript
  transcriptContent?: any[]; // Soniox results
  hideUnidentifiedSpeakers?: boolean; // UI preference
  transcriptMetadata?: {
    totalWords: number;
    uniqueSpeakers: string[];
    speakerCount: number;
    latestTimestamp: number;
    lastRecordingSession: Date;
    totalRecordingDuration: number;
  };
}

interface ArticleData {
  title: {
    english: string;
    korean: string;
  };
  pronunciation_keywords?: string[];
}

// Interface for user data including phone numbers
interface UserWithDetails {
  uid: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  phoneLast4?: string;
}

interface EnhancedUserProfile extends UserProfile {
  isLeader: boolean;
  phoneNumber?: string;
  phoneLast4?: string;
}

interface SpeakerMapping {
  speakerId: string;
  participantUid: string;
}

interface UserSpeakingReport {
  userId: string;
  transcriptId: string;
  speakerId: string;
  userScript: string;
  analysis: {
    overallScore: number;
    fluency: {
      score: number;
      feedback: string;
    };
    vocabulary: {
      score: number;
      feedback: string;
    };
    grammar: {
      score: number;
      feedback: string;
    };
    pronunciation: {
      score: number;
      feedback: string;
    };
    engagement: {
      score: number;
      feedback: string;
    };
    strengths: string[];
    areasForImprovement: string[];
    specificSuggestions: string[];
  };
  metadata: {
    wordCount: number;
    speakingDuration: number;
    averageWordsPerMinute: number;
    createdAt: Date;
    articleId?: string;
    sessionNumber?: number;
  };
}

export default function TranscriptDetailClient() {
  const params = useParams();
  const router = useRouter();
  const transcriptId = params?.id as string;

  // Soniox-only

  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(
    null
  );
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [participants, setParticipants] = useState<EnhancedUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the existing speech hooks
  // Keep track of when we were paused to filter out results during pause periods
  const pausePeriodsRef = useRef<Array<{ start: number; end?: number }>>([]);
  // Ref to track pause state for audio processing callback
  const isPausedRef = useRef<boolean>(false);

  const {
    sonioxResults,
    sonioxError,
    isSonioxSocketOpen,
    startSoniox,
    stopSoniox,
    sendSonioxAudio,
    setSavedTranscript: setSavedSonioxTranscript,
    getFinalTranscript,
  } = useSoniox(isPausedRef);

  // Unified transcript states (Soniox-only)
  const activePartialSegment = sonioxResults.activePartialSegment;
  const finalTranscript = sonioxResults.finalTranscript;
  const transcriptionError = sonioxError;
  const isSocketOpen = isSonioxSocketOpen;

  // Persisted transcript data (source of truth for saved transcript)
  const [savedTranscriptData, setSavedTranscriptData] = useState<any[]>([]);

  // Audio recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [totalRecordingDuration, setTotalRecordingDuration] =
    useState<number>(0);
  const [totalPausedDuration, setTotalPausedDuration] = useState<number>(0);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("");
  const [customSpeakers, setCustomSpeakers] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsLoaded, setKeywordsLoaded] = useState<boolean>(false);
  const keywordsLoadedRef = useRef<boolean>(false);
  const keywordsRef = useRef<string[]>([]);
  const [newKeyword, setNewKeyword] = useState<string>("");

  const participantLabels = useMemo(
    () =>
      participants.map(
        (participant) =>
          participant.displayName ||
          participant.phoneLast4 ||
          participant.phoneNumber ||
          participant.uid
      ),
    [participants]
  );

  const {
    messages: copilotMessages,
    isThinking: isCopilotThinking,
  } = useTranscriptCopilot({
    finalTranscript,
    isListening: isRecording && !isPaused,
    participants: participantLabels,
    articleTitle: articleData?.title?.english || articleData?.title?.korean,
  });

  // Audio storage and playback state
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentlyHighlightedSnippet, setCurrentlyHighlightedSnippet] =
    useState<number | null>(null);
  const [currentlyHighlightedWord, setCurrentlyHighlightedWord] = useState<{
    snippetIndex: number;
    wordIndex: number;
  } | null>(null);

  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const lastAudioSentAtRef = useRef<number>(0);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Speaker assignment state
  const [speakerMappings, setSpeakerMappings] = useState<
    Record<string, string>
  >({});
  const [showSpeakerModal, setShowSpeakerModal] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);

  const [hideUnidentifiedSpeakers, setHideUnidentifiedSpeakers] =
    useState(false);

  // Report generation state
  const [showCreateReportDialog, setShowCreateReportDialog] = useState(false);

  // Speaking metrics state
  const [showMetrics, setShowMetrics] = useState(false);

  // Qualitative analysis state
  const [qualitativeAnalysis, setQualitativeAnalysis] = useState<
    Record<string, any>
  >({});
  const [isLoadingQualitativeAnalysis, setIsLoadingQualitativeAnalysis] =
    useState(false);
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);
  const [reports, setReports] = useState<UserSpeakingReport[]>([]);
  const [selectedReport, setSelectedReport] =
    useState<UserSpeakingReport | null>(null);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [reportsGenerated, setReportsGenerated] = useState(false);

  // Function to get user details with phone numbers
  const fetchUserDetails = async (
    uids: string[]
  ): Promise<UserWithDetails[]> => {
    try {
      // Use the service-role messaging function (RLS would hide other users' rows
      // from a non-admin leader). Returns { displayNames, phoneNumbers } keyed by uid.
      const result = await invokeFunction<{
        displayNames: Record<string, string>;
        phoneNumbers: Record<string, string>;
      }>("messaging", { action: "user-names", userIds: uids });

      return uids.map((uid) => {
        const phone = result.phoneNumbers[uid] || "";
        return {
          uid,
          displayName: result.displayNames[uid] || `User ${uid.substring(0, 6)}`,
          phoneNumber: phone,
          phoneLast4: phone ? phone.replace(/\D/g, "").slice(-4) : "",
        };
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      return uids.map((uid) => ({
        uid,
        displayName: `User ${uid.substring(0, 6)}`,
        phoneNumber: "",
        phoneLast4: "",
      }));
    }
  };

  // Helper functions for formatting names
  const isValidDisplayName = (displayName?: string): boolean => {
    if (!displayName) return false;
    const userPattern = /^User [a-zA-Z0-9]{6}$/;
    return !userPattern.test(displayName);
  };

  const formatParticipantDisplay = (user: EnhancedUserProfile): string => {
    const validName = isValidDisplayName(user.displayName);
    if (!validName) return `익명 (${user.phoneLast4 || "****"})`;

    return `${user.displayName} (${user.phoneLast4 || "****"})`;
  };

  const formatLeaderDisplay = (user: EnhancedUserProfile): string => {
    const validName = isValidDisplayName(user.displayName);
    return validName ? user.displayName! : "익명";
  };

  // Helper function to determine if a word is punctuation or should be attached to previous word
  const isPunctuationOrAttached = (word: any): boolean => {
    if (!word) return false;

    // Check the type field first
    if (word.type && word.type !== "word") {
      return true;
    }

    // Common punctuation patterns
    const punctuationPattern = /^[.,!?;:'")\]}>-]+$/;
    const contractionPattern = /^'[a-z]+$/i; // 's, 't, 'll, etc.

    return (
      punctuationPattern.test(word.content) ||
      contractionPattern.test(word.content)
    );
  };

  // Filter out results that occurred during pause periods
  const filterPausedResults = useCallback((results: any[]) => {
    if (pausePeriodsRef.current.length === 0) return results;

    return results.filter((result) => {
      if (!result.start_time) return true; // Include results without timestamps

      // Check if this result's timestamp falls within any pause period
      for (const pausePeriod of pausePeriodsRef.current) {
        const isAfterPauseStart = result.start_time >= pausePeriod.start;
        const isBeforePauseEnd = pausePeriod.end
          ? result.start_time <= pausePeriod.end
          : false;

        // If result is during a pause period, filter it out
        if (isAfterPauseStart && (isBeforePauseEnd || !pausePeriod.end)) {
          console.log(
            `[Filter] Filtering out result at ${
              result.start_time
            }s (pause period: ${pausePeriod.start}-${
              pausePeriod.end || "ongoing"
            })`
          );
          return false;
        }
      }

      return true;
    });
  }, []);

  // Group transcript results into snippets for rendering (copied from original RecordTranscriptClient)
  const createTranscriptSnippets = useCallback((results: any[]) => {
    const validResults = results.filter(
      (result) => {
        const content = result.alternatives?.[0]?.content;
        return content && content.trim().toLowerCase() !== "<end>";
      }
    );
    if (validResults.length === 0) return [];

    const snippets: Array<{
      speaker: string;
      startTime: number;
      words: Array<{
        content: string;
        confidence?: number;
        isPartial?: boolean;
        type?: string;
        preserveSpacing?: boolean;
      }>;
    }> = [];

    let currentSnippet: {
      speaker: string;
      startTime: number;
      words: Array<{
        content: string;
        confidence?: number;
        isPartial?: boolean;
        type?: string;
        preserveSpacing?: boolean;
      }>;
    } | null = null;

    validResults.forEach((result, index) => {
      const word = result.alternatives[0];
      const speaker = word.speaker || "UU";

      if (!currentSnippet || currentSnippet.speaker !== speaker) {
        if (currentSnippet) {
          snippets.push(currentSnippet);
        }
        currentSnippet = {
          speaker,
          startTime: result.start_time,
          words: [
            {
              content: word.content,
              confidence: word.confidence,
              type: result.type || "word",
              preserveSpacing: result.preserveSpacing,
            },
          ],
        };
      } else {
        currentSnippet.words.push({
          content: word.content,
          confidence: word.confidence,
          type: result.type || "word",
          preserveSpacing: result.preserveSpacing,
        });
      }
    });

    if (currentSnippet) {
      snippets.push(currentSnippet);
    }

    return snippets;
  }, []);

  // Get new live data that hasn't been saved yet
  const newLiveData = useMemo(() => {
    const currentFinalTranscript = finalTranscript || [];
    const savedDataLength = savedTranscriptData.length;

    // Only show new data that's beyond what's already saved
    return currentFinalTranscript.slice(savedDataLength);
  }, [finalTranscript, savedTranscriptData.length]);

  // Combine saved data with new live data
  const combinedFinalTranscript = useMemo(() => {
    return [...savedTranscriptData, ...newLiveData];
  }, [savedTranscriptData, newLiveData]);

  // Apply filtering to remove paused periods from the combined data
  const filteredFinalTranscript = isPaused
    ? filterPausedResults(combinedFinalTranscript)
    : combinedFinalTranscript;

  const filteredActivePartialSegment = isPaused
    ? [] // Don't show active partials when paused
    : activePartialSegment || [];

  const finalSnippets = createTranscriptSnippets(filteredFinalTranscript);
  const partialSnippets = createTranscriptSnippets(
    filteredActivePartialSegment.map((r) => ({
      ...r,
      isPartial: true,
    }))
  );

  // Combine final and partial snippets for a seamless display (copied from original RecordTranscriptClient)
  const displaySnippets = useMemo(() => {
    // Start with a deep copy of final snippets to avoid mutation
    const combined = finalSnippets.map((snippet) => ({
      ...snippet,
      words: [...snippet.words],
    }));

    // Only process partials if they exist
    if (partialSnippets.length === 0) {
      return combined;
    }

    const lastFinalSnippet = combined[combined.length - 1];
    const firstPartialSnippet = partialSnippets[0];

    if (
      lastFinalSnippet &&
      firstPartialSnippet &&
      lastFinalSnippet.speaker === firstPartialSnippet.speaker
    ) {
      // If the same speaker is continuing, merge the words
      const partialWords = firstPartialSnippet.words.map((w) => ({
        ...w,
        isPartial: true,
      }));
      lastFinalSnippet.words = [...lastFinalSnippet.words, ...partialWords];

      // Add any additional partial snippets from other speakers
      for (let i = 1; i < partialSnippets.length; i++) {
        const additionalPartial = partialSnippets[i];
        combined.push({
          ...additionalPartial,
          words: additionalPartial.words.map((w) => ({
            ...w,
            isPartial: true,
          })),
        });
      }
    } else {
      // If it's a new speaker or no final snippets, add all partial snippets
      partialSnippets.forEach((partialSnippet) => {
        combined.push({
          ...partialSnippet,
          words: partialSnippet.words.map((w) => ({ ...w, isPartial: true })),
        });
      });
    }

    return combined;
  }, [finalSnippets, partialSnippets]);

  // Speaker display info function
  const getSpeakerDisplayInfo = (speakerId: string) => {
    const participantUid = speakerMappings[speakerId];
    if (participantUid) {
      const participant = participants.find((p) => p.uid === participantUid);
      if (participant) {
        const formattedName = participant.isLeader
          ? formatLeaderDisplay(participant)
          : formatParticipantDisplay(participant);

        return {
          name: formattedName,
          avatar: participant.uid,
          isAssigned: true,
          isLeader: participant.isLeader,
        };
      }
    }

    return {
      name:
        speakerId === "UU"
          ? "Unknown Speaker"
          : `Speaker ${speakerId.slice(1)}`,
      avatar: null,
      isAssigned: false,
      isLeader: false,
    };
  };

  // Filter snippets based on hideUnidentifiedSpeakers setting
  const filteredDisplaySnippets = useMemo(() => {
    if (!hideUnidentifiedSpeakers) {
      return displaySnippets;
    }

    return displaySnippets.filter((snippet) => {
      const speakerInfo = getSpeakerDisplayInfo(snippet.speaker);
      return speakerInfo.isAssigned;
    });
  }, [
    displaySnippets,
    hideUnidentifiedSpeakers,
    speakerMappings,
    participants,
  ]);

  const conversationItems = useMemo(() => {
    const sortedMessages = [...copilotMessages].sort(
      (a, b) =>
        a.transcriptItemCount - b.transcriptItemCount ||
        a.createdAt - b.createdAt
    );
    const items: Array<
      | { type: "transcript"; snippet: (typeof filteredDisplaySnippets)[number]; snippetIndex: number }
      | { type: "copilot"; message: (typeof copilotMessages)[number] }
      | { type: "copilot-thinking" }
    > = [];
    let cumulativeItems = 0;
    let messageIndex = 0;

    filteredDisplaySnippets.forEach((snippet, snippetIndex) => {
      items.push({ type: "transcript", snippet, snippetIndex });
      cumulativeItems += snippet.words.length;

      while (
        messageIndex < sortedMessages.length &&
        sortedMessages[messageIndex].transcriptItemCount <= cumulativeItems
      ) {
        items.push({ type: "copilot", message: sortedMessages[messageIndex] });
        messageIndex += 1;
      }
    });

    while (messageIndex < sortedMessages.length) {
      items.push({ type: "copilot", message: sortedMessages[messageIndex] });
      messageIndex += 1;
    }

    if (isCopilotThinking) {
      items.push({ type: "copilot-thinking" });
    }

    return items;
  }, [copilotMessages, filteredDisplaySnippets, isCopilotThinking]);

  // Speaker color mapping
  const getSpeakerColor = (speaker: string) => {
    const colors = {
      S1: { avatar: "#4f46e5" },
      S2: { avatar: "#e11d48" },
      S3: { avatar: "#059669" },
      S4: { avatar: "#d97706" },
      S5: { avatar: "#9333ea" },
      UU: { avatar: "#6b7280" },
    };
    return colors[speaker as keyof typeof colors] || { avatar: "#6b7280" };
  };

  // Label resolver combining mapped users and unmapped speakers
  const displayLabelForSpeaker = useCallback(
    (speakerId: string): string => {
      const participantUid = speakerMappings[speakerId];
      if (participantUid) {
        const participant = participants.find((p) => p.uid === participantUid);
        if (participant) return formatParticipantDisplay(participant);
      }
      return speakerId === "UU" ? "Unknown" : `Speaker ${speakerId.slice(1)}`;
    },
    [speakerMappings, participants]
  );

  // Speaking Metrics Calculation Functions
  const calculateSpeakingMetrics = useMemo(() => {
    if (filteredFinalTranscript.length === 0) return {};

    const speakerMetrics: Record<string, any> = {};
    const speakingSegments: Record<
      string,
      Array<{ startTime: number; endTime: number; words: string[] }>
    > = {};

    // Group by speakers and calculate segments
    filteredFinalTranscript.forEach((result, index) => {
      if (!result.alternatives || !result.alternatives[0]) return;

      const word = result.alternatives[0];
      const speaker = word.speaker || "UU";
      const startTime = result.start_time || 0;
      const endTime = result.end_time || startTime + 0.5; // Default 0.5s if no end time
      const content = word.content || "";

      if (!speakingSegments[speaker]) {
        speakingSegments[speaker] = [];
      }

      // Check if this continues the current segment (same speaker within 2 seconds)
      const lastSegment =
        speakingSegments[speaker][speakingSegments[speaker].length - 1];
      if (lastSegment && startTime - lastSegment.endTime <= 2) {
        // Continue existing segment
        lastSegment.endTime = endTime;
        lastSegment.words.push(content);
      } else {
        // Start new segment
        speakingSegments[speaker].push({
          startTime,
          endTime,
          words: [content],
        });
      }
    });

    // Calculate metrics for each speaker
    Object.keys(speakingSegments).forEach((speaker) => {
      const segments = speakingSegments[speaker];

      // 1. Total Speaking Time
      const totalSpeakingTime = segments.reduce(
        (sum, segment) => sum + (segment.endTime - segment.startTime),
        0
      );

      // 3. Speaking Turn Count
      const speakingTurns = segments.length;

      // 4. Average Speaking Duration
      const avgSpeakingDuration =
        speakingTurns > 0 ? totalSpeakingTime / speakingTurns : 0;

      // 5. Longest Speaking Turn
      const longestSpeakingTurn =
        segments.length > 0
          ? Math.max(...segments.map((seg) => seg.endTime - seg.startTime))
          : 0;

      // Get all words for this speaker
      const allWords = segments
        .flatMap((seg) => seg.words)
        .filter((word) => word.trim().length > 0);
      const totalWords = allWords.length;

      // 6. Unique Words Used / Lexical Diversity
      const wordsLowerCase = allWords
        .map(
          (word) => word.toLowerCase().replace(/[^\w\s]/g, "") // Remove punctuation
        )
        .filter((word) => word.length > 0);

      const uniqueWords = new Set(wordsLowerCase);
      const lexicalDiversity =
        totalWords > 0 ? (uniqueWords.size / totalWords) * 100 : 0;

      // 7. Questions Asked
      const allText = segments.map((seg) => seg.words.join(" ")).join(" ");
      const questionMarks = (allText.match(/\?/g) || []).length;
      const questionWords = [
        "who",
        "what",
        "when",
        "where",
        "why",
        "how",
        "do",
        "did",
        "can",
        "could",
        "would",
        "will",
        "should",
        "is",
        "are",
        "was",
        "were",
      ];
      const questionStarters = questionWords.reduce((count, qWord) => {
        const regex = new RegExp(`\\b${qWord}\\b`, "gi");
        const matches = allText.match(regex) || [];
        return count + matches.length;
      }, 0);
      const questionsAsked = questionMarks + Math.floor(questionStarters / 3); // Rough estimate

      speakerMetrics[speaker] = {
        totalSpeakingTime: Math.round(totalSpeakingTime * 10) / 10, // Round to 1 decimal
        speakingTurns,
        avgSpeakingDuration: Math.round(avgSpeakingDuration * 10) / 10,
        longestSpeakingTurn: Math.round(longestSpeakingTurn * 10) / 10,
        totalWords,
        uniqueWords: uniqueWords.size,
        lexicalDiversity: Math.round(lexicalDiversity * 10) / 10,
        questionsAsked,
      };
    });

    // 2. Calculate Speaking Time Share (%)
    const totalSessionTime = Object.values(speakerMetrics).reduce(
      (sum: number, metrics: any) => sum + metrics.totalSpeakingTime,
      0
    );

    Object.keys(speakerMetrics).forEach((speaker) => {
      const timeShare =
        totalSessionTime > 0
          ? (speakerMetrics[speaker].totalSpeakingTime / totalSessionTime) * 100
          : 0;
      speakerMetrics[speaker].speakingTimeShare =
        Math.round(timeShare * 10) / 10;
    });

    return speakerMetrics;
  }, [filteredFinalTranscript]);

  // Aggregate total speaking time by display label (merging mapped speakers)
  const pieChartData = useMemo(() => {
    const metrics = (calculateSpeakingMetrics || {}) as Record<string, any>;
    const labelToTime: Record<string, number> = {};
    const labelToColor: Record<string, string> = {};

    Object.keys(metrics).forEach((speakerId) => {
      const label = displayLabelForSpeaker(speakerId);
      const time = metrics[speakerId]?.totalSpeakingTime || 0;
      labelToTime[label] = (labelToTime[label] || 0) + time;

      if (!labelToColor[label]) {
        labelToColor[label] = getSpeakerColor(speakerId).avatar;
      }
    });

    const labels = Object.keys(labelToTime);
    const data = labels.map((l) => Math.round(labelToTime[l] * 10) / 10);
    const backgroundColor = labels.map((l) => labelToColor[l] || "#6b7280");

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [calculateSpeakingMetrics, displayLabelForSpeaker]);

  // Analysis helper functions (defined before the useMemo to avoid hoisting issues)
  const getComplexityLevel = (score: number) => {
    if (score >= 80) return "C6+";
    if (score >= 70) return "C5";
    if (score >= 60) return "C4";
    if (score >= 50) return "C3";
    if (score >= 40) return "C2";
    return "C1";
  };

  const getAccuracyLevel = (score: number) => {
    if (score >= 85) return "A6+";
    if (score >= 75) return "A5";
    if (score >= 65) return "A4";
    if (score >= 55) return "A3";
    if (score >= 45) return "A2";
    return "A1";
  };

  const getFluencyLevel = (score: number) => {
    if (score >= 80) return "F6+";
    if (score >= 70) return "F5";
    if (score >= 60) return "F4";
    if (score >= 50) return "F3";
    if (score >= 40) return "F2";
    return "F1";
  };

  const getComplexityDescription = (level: string, score: number) => {
    if (level.includes("6+"))
      return "상위 25% 수준 - 주제에 대해 길고 분명하게 전달할 만큼의 어휘력 보유";
    if (level.includes("5")) return "고급 수준 - 다양하고 정교한 어휘 구사";
    if (level.includes("4"))
      return "중상급 수준 - 적절한 어휘 선택과 문장 구성";
    if (level.includes("3")) return "중급 수준 - 기본적인 복잡성 표현 가능";
    return "초급 수준 - 단순한 어휘와 문장 구조 사용";
  };

  const getAccuracyDescription = (level: string, score: number) => {
    if (level.includes("6+"))
      return "상위 20% 수준 - 복잡한 문법 구조 혼합 사용, 고급 문법에서 간헐적 실수";
    if (level.includes("5"))
      return "고급 수준 - 대부분의 문법 구조를 정확하게 사용";
    if (level.includes("4"))
      return "중상급 수준 - 기본 문법은 안정적, 복잡한 구조에서 실수";
    if (level.includes("3")) return "중급 수준 - 문법적 정확성에 개선 여지";
    return "초급 수준 - 기본 문법 학습 필요";
  };

  const getFluencyDescription = (level: string, score: number) => {
    if (level.includes("6+"))
      return "상위 20% 수준 - 불편함 없이 영어 대화 가능, 자연스러운 속도와 흐름";
    if (level.includes("5"))
      return "고급 수준 - 대체로 자연스러운 말하기, 가끔 망설임";
    if (level.includes("4"))
      return "중상급 수준 - 의사소통 가능하나 간헐적 정체";
    if (level.includes("3"))
      return "중급 수준 - 말하기 속도와 유창함 개선 필요";
    return "초급 수준 - 말하기 연습과 속도 향상 필요";
  };

  // Analysis functions (defined before the useMemo that uses them)
  const analyzeComplexity = (text: string, metrics: any) => {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Vocabulary difficulty (basic heuristic - can be enhanced with AI)
    const complexWords = words.filter((word) => word.length > 6).length;
    const vocabularyDifficulty =
      words.length > 0 ? (complexWords / words.length) * 100 : 0;

    // Sentence variety (simple heuristic)
    const avgSentenceLength =
      sentences.length > 0 ? words.length / sentences.length : 0;
    const sentenceVariety = Math.min((avgSentenceLength / 15) * 100, 100);

    // Vocabulary diversity (already calculated)
    const vocabularyDiversity = metrics.lexicalDiversity || 0;

    // Overall complexity score (weighted average)
    const complexityScore = Math.round(
      vocabularyDifficulty * 0.4 +
        sentenceVariety * 0.3 +
        vocabularyDiversity * 0.3
    );

    const level = getComplexityLevel(complexityScore);
    const description = getComplexityDescription(level, complexityScore);

    return {
      score: complexityScore,
      level,
      description,
      details: {
        vocabularyDifficulty: Math.round(vocabularyDifficulty),
        sentenceVariety: Math.round(sentenceVariety),
        vocabularyDiversity: Math.round(vocabularyDiversity),
      },
    };
  };

  const analyzeAccuracy = (text: string) => {
    const words = text.split(/\s+/).filter((w) => w.length > 0);

    // Basic grammar error detection (placeholder - will be enhanced with AI)
    const commonErrors = [
      /\ba\s+[aeiou]/gi, // a + vowel sound
      /\ban\s+[^aeiou]/gi, // an + consonant sound
      /\bdon't\s+never\b/gi, // double negative
      /\bmore\s+better\b/gi, // double comparative
      /\bmuch\s+many\b/gi, // countable/uncountable confusion
    ];

    let errorCount = 0;
    commonErrors.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) errorCount += matches.length;
    });

    // Calculate accuracy score
    const errorRate = words.length > 0 ? (errorCount / words.length) * 100 : 0;
    const accuracyScore = Math.max(0, Math.round(100 - errorRate * 10));

    const level = getAccuracyLevel(accuracyScore);
    const description = getAccuracyDescription(level, accuracyScore);

    return {
      score: accuracyScore,
      level,
      description,
      details: {
        totalWords: words.length,
        detectedErrors: errorCount,
        errorRate: Math.round(errorRate * 100) / 100,
      },
    };
  };

  const analyzeFluency = (text: string, metrics: any) => {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    // Filler words detection
    const fillerWords = [
      "um",
      "uh",
      "er",
      "ah",
      "like",
      "you know",
      "actually",
      "basically",
    ];
    const fillerCount = words.filter((word) =>
      fillerWords.some((filler) => word.includes(filler))
    ).length;

    // Word repetition analysis
    const wordCounts = words.reduce((acc: Record<string, number>, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

    const repetitions = Object.values(wordCounts).filter(
      (count) => count > 2
    ).length;

    // Speaking rate analysis (from existing metrics)
    const avgSpeakingRate =
      metrics.totalWords && metrics.totalSpeakingTime
        ? (metrics.totalWords / metrics.totalSpeakingTime) * 60
        : 0; // words per minute

    // Calculate fluency score
    const fillerPenalty =
      words.length > 0 ? (fillerCount / words.length) * 30 : 0;
    const repetitionPenalty =
      words.length > 0 ? (repetitions / words.length) * 20 : 0;
    const rateScore = Math.min((avgSpeakingRate / 150) * 50, 50); // optimal rate ~150 WPM

    const fluencyScore = Math.max(
      0,
      Math.round(100 - fillerPenalty - repetitionPenalty + rateScore - 50)
    );

    const level = getFluencyLevel(fluencyScore);
    const description = getFluencyDescription(level, fluencyScore);

    return {
      score: fluencyScore,
      level,
      description,
      details: {
        speakingRate: Math.round(avgSpeakingRate),
        fillerWords: fillerCount,
        repetitions,
        fillerPercentage:
          words.length > 0 ? Math.round((fillerCount / words.length) * 100) : 0,
      },
    };
  };

  // Async Qualitative Analysis with OpenAI GPT-4o-mini
  const generateQualitativeAnalysis = useCallback(async () => {
    if (
      filteredFinalTranscript.length === 0 ||
      Object.keys(calculateSpeakingMetrics).length === 0
    ) {
      return;
    }

    setIsLoadingQualitativeAnalysis(true);

    try {
      const speakerAnalysis: Record<string, any> = {};

      // Process each speaker
      for (const speaker of Object.keys(calculateSpeakingMetrics)) {
        const speakerSegments = filteredFinalTranscript.filter(
          (result) => result.alternatives?.[0]?.speaker === speaker
        );

        const allText = speakerSegments
          .map((result) => result.alternatives?.[0]?.content || "")
          .join(" ");

        if (!allText.trim() || allText.split(" ").length < 10) {
          speakerAnalysis[speaker] = {
            complexity: {
              score: 0,
              level: "N/A",
              description: "Insufficient data for AI analysis",
            },
            accuracy: {
              score: 0,
              level: "N/A",
              description: "Insufficient data for AI analysis",
            },
            fluency: {
              score: 0,
              level: "N/A",
              description: "Insufficient data for AI analysis",
            },
          };
          continue;
        }

        // Call OpenAI API for each speaker
        const analysis = await analyzeWithOpenAI(
          allText,
          calculateSpeakingMetrics[speaker]
        );
        speakerAnalysis[speaker] = analysis;
      }

      setQualitativeAnalysis(speakerAnalysis);
    } catch (error) {
      console.error("Error generating qualitative analysis:", error);
      // Fallback to basic analysis if API fails
      const fallbackAnalysis = generateFallbackAnalysis();
      setQualitativeAnalysis(fallbackAnalysis);
    } finally {
      setIsLoadingQualitativeAnalysis(false);
    }
  }, [filteredFinalTranscript, calculateSpeakingMetrics]);

  // OpenAI analysis via the `speaking-reports` Supabase Edge Function
  const analyzeWithOpenAI = async (text: string, metrics: any) => {
    const prompt = `Analyze this English speaking sample for a Korean learner. Provide scores (0-100) and levels for:

1. COMPLEXITY (복잡성) - C1 to C6+ levels:
- Vocabulary difficulty and variety
- Sentence structure sophistication
- Topic development depth

2. ACCURACY (정확성) - A1 to A6+ levels:  
- Grammar correctness
- Proper word usage
- Error frequency

3. FLUENCY (유창성) - F1 to F6+ levels:
- Speaking pace and rhythm
- Hesitations and fillers
- Natural flow

Speaking sample: "${text}"
Word count: ${metrics.totalWords}
Speaking time: ${metrics.totalSpeakingTime}s
Speaking rate: ${Math.round(
      (metrics.totalWords / metrics.totalSpeakingTime) * 60
    )} WPM

Respond in JSON format:
{
  "complexity": {"score": 0-100, "level": "C1-C6+", "description": "Korean description"},
  "accuracy": {"score": 0-100, "level": "A1-A6+", "description": "Korean description"}, 
  "fluency": {"score": 0-100, "level": "F1-F6+", "description": "Korean description"}
}`;

    try {
      const data = await invokeFunction<{
        success: boolean;
        analysis: any;
        model: string;
        usage: any;
      }>("speaking-reports", {
        analysisType: "simple",
        prompt,
        model: "gpt-4o-mini",
      });

      if (!data.success) {
        throw new Error("Analysis failed");
      }

      return data.analysis;
    } catch (error) {
      throw new Error(
        `Speaking reports function error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Fallback analysis function (uses existing local analysis)
  const generateFallbackAnalysis = () => {
    const speakerAnalysis: Record<string, any> = {};

    Object.keys(calculateSpeakingMetrics).forEach((speaker) => {
      const speakerSegments = filteredFinalTranscript.filter(
        (result) => result.alternatives?.[0]?.speaker === speaker
      );

      const allText = speakerSegments
        .map((result) => result.alternatives?.[0]?.content || "")
        .join(" ");

      if (!allText.trim()) {
        speakerAnalysis[speaker] = {
          complexity: {
            score: 0,
            level: "N/A",
            description: "Insufficient data",
          },
          accuracy: {
            score: 0,
            level: "N/A",
            description: "Insufficient data",
          },
          fluency: { score: 0, level: "N/A", description: "Insufficient data" },
        };
        return;
      }

      // Use existing local analysis as fallback
      const complexity = analyzeComplexity(
        allText,
        calculateSpeakingMetrics[speaker]
      );
      const accuracy = analyzeAccuracy(allText);
      const fluency = analyzeFluency(
        allText,
        calculateSpeakingMetrics[speaker]
      );

      speakerAnalysis[speaker] = { complexity, accuracy, fluency };
    });

    return speakerAnalysis;
  };

  // Check microphone permission on component mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // First check if we can get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop()); // Stop the test stream
        setHasPermission(true);
      } catch (error) {
        console.error("Microphone permission denied:", error);
        setHasPermission(false);
      }
    };

    checkPermission();
  }, []);

  // Set up audio processing and recording
  const setupAudioProcessing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Set up audio context for Soniox
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/scripts/audio-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(
        audioContext,
        "audio-processor",
        {
          processorOptions: {
            sampleRate: 16000,
          },
        }
      );
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        const audioData = event.data;
        if (audioData && audioData.byteLength > 0) {
          // Only send audio when not paused
          if (!isPausedRef.current) {
            lastAudioSentAtRef.current = Date.now();
            sendSonioxAudio(audioData);
          }
        }
      };

      source.connect(workletNode);

      // Set up MediaRecorder for continuous audio recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;

      // DON'T clear previous recording chunks - we want to accumulate across sessions
      // recordedAudioChunksRef.current = []; // REMOVED

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedAudioChunksRef.current.push(event.data);
          console.log(
            `[Audio] Added chunk ${recordedAudioChunksRef.current.length}, size: ${event.data.size} bytes`
          );
        }
      };

      // Start continuous recording
      recordingStartTimeRef.current = Date.now();
      mediaRecorder.start();

      console.log(
        `[Audio] Started recording session with ${recordedAudioChunksRef.current.length} existing chunks`
      );

      // Reacquire mic if track ends
      const [track] = stream.getAudioTracks();
      if (track) {
        track.onended = async () => {
          if (!isRecordingRef.current) return;
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = newStream;
            const newSource = audioContext.createMediaStreamSource(newStream);
            newSource.connect(workletNode);

            const newRecorder = new MediaRecorder(newStream, { mimeType: "audio/webm;codecs=opus" });
            mediaRecorderRef.current = newRecorder;
            newRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) recordedAudioChunksRef.current.push(e.data);
            };
            newRecorder.start();
          } catch (reErr) {
            console.error("Failed to reacquire microphone after track ended:", reErr);
          }
        };
      }

      return true;
    } catch (error) {
      console.error("Error setting up audio processing:", error);
      return false;
    }
  }, [sendSonioxAudio]);

  const handleStartRecording = async () => {
    if (isStarting || isStopping) return;

    try {
      setIsStarting(true);

      // When starting fresh (not resuming), clear all existing transcript data
      if (!isRecording) {
        console.log(
          "[Recording] Starting fresh - clearing existing transcript data"
        );

        // Clear the hook's saved transcript data
        setSavedSonioxTranscript([]);
        setSavedTranscriptData([]);

        // Clear pause periods and duration tracking
        pausePeriodsRef.current = [];
        setTotalPausedDuration(0);
        setTotalRecordingDuration(0);
        setIsPaused(false);
        setPauseStartTime(null);

        // Clear audio chunks to start fresh
        recordedAudioChunksRef.current = [];
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
          setRecordedAudioUrl(null);
        }

        // Clear the transcript data in the database
        if (transcriptId) {
          try {
            const { error } = await supabase
              .from("transcripts")
              .update({
                transcript_content: [],
                transcript_metadata: {
                  totalWords: 0,
                  uniqueSpeakers: [],
                  speakerCount: 0,
                  latestTimestamp: 0,
                  lastRecordingSession: new Date().toISOString(),
                  totalRecordingDuration: 0,
                  totalPausedDuration: 0,
                  pausePeriods: [],
                },
              })
              .eq("id", transcriptId);
            if (error) throw error;
            console.log(
              "[Recording] Cleared existing transcript data from database"
            );
          } catch (error) {
            console.error("[Recording] Error clearing transcript data:", error);
          }
        }
      }

      // Re-check permission when user actually tries to record
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        testStream.getTracks().forEach((track) => track.stop());
        setHasPermission(true);
      } catch (permError) {
        console.error("Microphone permission denied:", permError);
        setHasPermission(false);
        alert(
          "Microphone permission is required for transcription. Please allow microphone access and try again."
        );
        setIsStarting(false);
        return;
      }

      // Wait for keywords to be loaded before starting recording
      if (!keywordsLoaded) {
        console.log("[Recording] Waiting for keywords to load...");
        // Wait up to 5 seconds for keywords to load
        const maxWaitTime = 5000;
        const checkInterval = 100;
        let waitTime = 0;

        while (!keywordsLoadedRef.current && waitTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
          console.log(
            "[Recording] Waiting for keywords... time:",
            waitTime,
            "loaded:",
            keywordsLoadedRef.current
          );
        }

        if (!keywordsLoadedRef.current) {
          console.warn(
            "[Recording] Keywords not loaded in time, starting without custom dictionary"
          );
        } else {
          console.log("[Recording] Keywords loaded successfully after waiting");
        }
      }

      console.log("[Recording] Final keywordsLoaded state:", keywordsLoaded);
      console.log("[Recording] Current keywords state:", keywords);
      const customDictionary = prepareCustomDictionary();
      console.log(
        "[Recording] Starting with custom dictionary length:",
        customDictionary.length
      );
      console.log("[Recording] Custom dictionary entries:", customDictionary);

      // Start provider (Soniox)
      let providerStarted = await startSoniox(customDictionary);

      if (!providerStarted) {
        isRecordingRef.current = false;
        setIsStarting(false);
        return;
      }

      const audioSetup = await setupAudioProcessing();
      if (!audioSetup) {
        await stopSoniox(false);
        isRecordingRef.current = false;
        setIsStarting(false);
        return;
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      setIsStarting(false);
      setRecordingStartTime(Date.now());
      // Start keepalive to avoid provider timeout
      lastAudioSentAtRef.current = Date.now();
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = setInterval(() => {
        if (!isSonioxSocketOpen) return;
        const now = Date.now();
        if (now - lastAudioSentAtRef.current > 1500) {
          const silent = new Float32Array(4096);
          try {
            sendSonioxAudio(silent.buffer);
            lastAudioSentAtRef.current = now;
          } catch {}
        }
      }, 800);
    } catch (error) {
      console.error("Error starting recording:", error);
      isRecordingRef.current = false;
      setIsStarting(false);
    }
  };

  const handleStopRecording = async () => {
    if (isStopping) return;

    setIsStopping(true);
    isRecordingRef.current = false;

    setIsRecording(false);
    setIsPaused(false); // Reset pause state when stopping

    const stoppedAt = Date.now();
    const startedAt = recordingStartTimeRef.current || recordingStartTime;
    const sessionDuration = startedAt ? (stoppedAt - startedAt) / 1000 : 0;
    const updatedTotalRecordingDuration = totalRecordingDuration + sessionDuration;
    let updatedTotalPausedDuration = totalPausedDuration;

    // Calculate recording duration for this session
    if (startedAt) {
      setTotalRecordingDuration((prev) => prev + sessionDuration);
      setRecordingStartTime(null);
      recordingStartTimeRef.current = null;
    }

    // Close any open pause period
    if (pauseStartTime) {
      const pauseDuration = (stoppedAt - pauseStartTime) / 1000;
      updatedTotalPausedDuration += pauseDuration;
      setTotalPausedDuration((prev) => prev + pauseDuration);
      setPauseStartTime(null);

      // Close the current pause period
      const lastPause =
        pausePeriodsRef.current[pausePeriodsRef.current.length - 1];
      if (lastPause && !lastPause.end) {
        const currentTimestamp =
          (stoppedAt - (startedAt || stoppedAt)) / 1000;
        lastPause.end = currentTimestamp;
      }
    }

    try {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => {
            const audioBlob = new Blob(recordedAudioChunksRef.current, {
              type: "audio/webm;codecs=opus",
            });
            const audioUrl = URL.createObjectURL(audioBlob);
            setRecordedAudioUrl((previousUrl) => {
              if (previousUrl) URL.revokeObjectURL(previousUrl);
              return audioUrl;
            });
            resolve();
          };
          try {
            recorder.requestData();
            recorder.stop();
          } catch (error) {
            console.error("Error stopping local audio recording:", error);
            resolve();
          }
        });
      }
      mediaRecorderRef.current = null;

      if (workletNodeRef.current) {
        // Send the final partial PCM buffer before ending the Soniox stream.
        workletNodeRef.current.port.postMessage({ type: "flush" });
        await new Promise((resolve) => setTimeout(resolve, 60));
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      // Wait for Soniox to flush its final tokens before persisting the transcript.
      await stopSoniox(true);
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }

      const finalResults = getFinalTranscript();
      const latestLiveResults = finalResults.slice(savedTranscriptData.length);
      await saveTranscriptToDatabase(
        [...savedTranscriptData, ...latestLiveResults],
        updatedTotalRecordingDuration,
        updatedTotalPausedDuration
      );
    } finally {
      setIsStopping(false);
    }
  };

  const handlePauseRecording = async () => {
    setIsPaused(true);
    setPauseStartTime(Date.now());

    // Add a new pause period
    const pauseStartTimestamp =
      (Date.now() - (recordingStartTimeRef.current || Date.now())) / 1000;
    pausePeriodsRef.current.push({ start: pauseStartTimestamp });

    console.log("[Recording] Paused at timestamp:", pauseStartTimestamp);
  };

  const handleResumeRecording = async () => {
    setIsPaused(false);

    // Update pause duration
    if (pauseStartTime) {
      const pauseDuration = (Date.now() - pauseStartTime) / 1000;
      setTotalPausedDuration((prev) => prev + pauseDuration);
      setPauseStartTime(null);

      // Close the current pause period
      const currentPauseStartTimestamp =
        (Date.now() - (recordingStartTimeRef.current || Date.now())) / 1000;
      const lastPause =
        pausePeriodsRef.current[pausePeriodsRef.current.length - 1];
      if (lastPause && !lastPause.end) {
        lastPause.end = currentPauseStartTimestamp;
      }

      console.log(
        "[Recording] Resumed at timestamp:",
        currentPauseStartTimestamp
      );
    }
  };

  const toggleRecording = useCallback(async () => {
    if (isStarting || isStopping) return;

    if (isRecording) {
      if (isPaused) {
        await handleResumeRecording();
      } else {
        await handlePauseRecording();
      }
    } else {
      await handleStartRecording();
    }
  }, [isRecording, isPaused, isStarting, isStopping]);

  // Sync pause state with ref for audio processing callback
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Speaker assignment functions
  const handleSpeakerClick = (speakerId: string) => {
    setSelectedSpeaker(speakerId);
    setShowSpeakerModal(true);
  };

  const handleAssignSpeaker = async (participantUid: string) => {
    if (!selectedSpeaker || !transcriptId) return;

    try {
      const newMappings = {
        ...speakerMappings,
        [selectedSpeaker]: participantUid,
      };

      setSpeakerMappings(newMappings);

      // Save to the database
      const { error } = await supabase
        .from("transcripts")
        .update({ speaker_mappings: newMappings })
        .eq("id", transcriptId);
      if (error) throw error;

      setShowSpeakerModal(false);
      setSelectedSpeaker(null);
    } catch (error) {
      console.error("Error saving speaker assignment:", error);
      alert("Failed to save speaker assignment. Please try again.");
    }
  };

  // Auto-save transcript to the database with comprehensive data
  const saveTranscriptToDatabase = useCallback(async (
    transcriptResults = combinedFinalTranscript,
    recordingDuration = totalRecordingDuration,
    pausedDuration = totalPausedDuration
  ) => {
    if (!transcriptId || !transcriptResults) return;

    try {
      // Use filtered transcript data (excluding paused periods)
      const transcriptData = filterPausedResults(transcriptResults);
      const totalWords = transcriptData.reduce((count, result) => {
        return count + (result.alternatives?.[0]?.content ? 1 : 0);
      }, 0);

      const speakers = new Set();
      transcriptData.forEach((result) => {
        if (result.alternatives?.[0]?.speaker) {
          speakers.add(result.alternatives[0].speaker);
        }
      });

      // Get the latest timestamp to know how far we've progressed
      const latestTimestamp =
        transcriptData.length > 0
          ? Math.max(
              ...transcriptData
                .filter((r) => r.end_time)
                .map((r) => r.end_time!)
            )
          : 0;

      const { error } = await supabase
        .from("transcripts")
        .update({
          transcript_content: transcriptData,
          last_updated: new Date().toISOString(),
          transcript_metadata: {
            totalWords,
            uniqueSpeakers: Array.from(speakers),
            speakerCount: speakers.size,
            latestTimestamp,
            lastRecordingSession: new Date().toISOString(),
            totalRecordingDuration: recordingDuration,
            totalPausedDuration: pausedDuration,
            pausePeriods: pausePeriodsRef.current,
          },
        })
        .eq("id", transcriptId);
      if (error) throw error;

      // Update our local saved data to match what was just saved
      setSavedTranscriptData(transcriptData);

      console.log(
        `[Auto-save] Transcript saved: ${totalWords} words, ${speakers.size} speakers, latest: ${latestTimestamp}s, paused: ${pausedDuration}s`
      );
    } catch (error) {
      console.error("[Auto-save] Error saving transcript:", error);
    }
  }, [
    transcriptId,
    combinedFinalTranscript,
    filterPausedResults,
    totalRecordingDuration,
    totalPausedDuration,
  ]);

  // Toggle hide unidentified speakers and save preference
  const toggleHideUnidentifiedSpeakers = useCallback(async () => {
    const newValue = !hideUnidentifiedSpeakers;
    setHideUnidentifiedSpeakers(newValue);

    if (transcriptId) {
      try {
        const { error } = await supabase
          .from("transcripts")
          .update({ hide_unidentified_speakers: newValue })
          .eq("id", transcriptId);
        if (error) throw error;
      } catch (error) {
        console.error("Error saving hide preference:", error);
      }
    }
  }, [hideUnidentifiedSpeakers, transcriptId]);

  // Generate speaking analysis reports
  const handleGenerateReports = async () => {
    if (!transcriptId || savedTranscriptData.length === 0) {
      alert("No saved transcript data available for analysis");
      return;
    }

    // Check if there are any mapped speakers
    const mappedSpeakers = Object.keys(speakerMappings).filter(
      (speakerId) => speakerMappings[speakerId]
    );

    if (mappedSpeakers.length === 0) {
      alert("Please assign speakers to participants before generating reports");
      return;
    }

    setIsGeneratingReports(true);
    setShowCreateReportDialog(false);

    try {
      // Use saved transcript data (source of truth)
      const filteredTranscriptData = filterPausedResults(savedTranscriptData);

      const data = await invokeFunction<{
        success: boolean;
        reportCount: number;
        reports: Array<{
          userId: string;
          overallScore: number;
          wordCount: number;
        }>;
      }>("speaking-reports", {
        transcriptId,
        speakerMappings,
        transcriptContent: filteredTranscriptData,
      });

      if (data.success) {
        const message = `Successfully generated ${data.reportCount} speaking analysis reports!\n\nView the reports in the Speaking Analysis Reports section below, or visit:\n${window.location.href}`;
        alert(message);
        setReportsGenerated(true);
        // Load the generated reports
        await loadReports();

        // Per-event rollups are now live SQL views (meetup_report_users /
        // meetup_reports) — no aggregation call needed.
      } else {
        alert("Failed to generate reports. Please try again.");
      }
    } catch (error) {
      console.error("Error generating reports:", error);
      alert(
        "Failed to generate reports: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsGeneratingReports(false);
    }
  };

  // Load existing reports for this transcript
  const loadReports = useCallback(async () => {
    if (!transcriptId) return;

    try {
      const { data: rows, error } = await supabase
        .from("speaking_reports")
        .select("*")
        .eq("transcript_id", transcriptId);
      if (error) throw error;

      const dedupMap = new Map<string, UserSpeakingReport>();

      (rows || []).forEach((row) => {
        const rawMetadata = row.metadata || {};
        const createdAt = row.created_at
          ? new Date(row.created_at)
          : rawMetadata.createdAt
          ? new Date(rawMetadata.createdAt)
          : new Date(0);

        const report = {
          userId: row.user_id,
          transcriptId: row.transcript_id,
          speakerId: row.speaker_id,
          userScript: row.user_script,
          analysis: row.analysis,
          metadata: {
            ...rawMetadata,
            // Prefer promoted columns; fall back to the raw metadata map.
            wordCount: row.word_count ?? rawMetadata.wordCount,
            speakingDuration: row.speaking_duration_sec ?? rawMetadata.speakingDuration,
            averageWordsPerMinute: row.avg_wpm ?? rawMetadata.averageWordsPerMinute,
            articleId: row.article_id ?? rawMetadata.articleId,
            sessionNumber: row.session_number ?? rawMetadata.sessionNumber,
            createdAt,
          },
        } as UserSpeakingReport;

        // Deduplicate by userId within this transcript (keep latest by createdAt)
        const existing = dedupMap.get(report.userId);
        if (!existing || existing.metadata.createdAt < report.metadata.createdAt) {
          dedupMap.set(report.userId, report);
        }
      });

      const loadedReports = Array.from(dedupMap.values());

      // Sort by createdAt desc in client
      loadedReports.sort(
        (a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      );
      setReports(loadedReports);
      setReportsGenerated(loadedReports.length > 0);
    } catch (error) {
      console.error("Error loading reports:", error);
    }
  }, [transcriptId]);

  // Get participant name for report display
  const getParticipantName = (userId: string): string => {
    const participant = participants.find((p) => p.uid === userId);
    if (!participant) return `User ${userId.substring(0, 6)}`;

    return participant.isLeader
      ? formatLeaderDisplay(participant)
      : formatParticipantDisplay(participant);
  };

  // Load transcript data
  useEffect(() => {
    if (!transcriptId) {
      setError("No transcript ID provided");
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Map a snake_case transcripts row into the camelCase shape the UI uses.
    const processTranscriptRow = (row: any) => {
      if (cancelled) return;
      if (row) {
          const data = row;
          const transcriptInfo = {
            id: row.id,
            eventId: data.event_id,
            sessionNumber: data.session_number,
            articleId: data.article_id,
            leaderUids: data.leader_uids || [],
            participantUids: data.participant_uids || [],
            createdAt: data.created_at ? new Date(data.created_at) : new Date(),
            createdBy: data.created_by,
            speakerMappings: data.speaker_mappings || {},
            transcriptContent: data.transcript_content || [],
            hideUnidentifiedSpeakers: data.hide_unidentified_speakers || false,
          };

          setTranscriptData(transcriptInfo);
          setSpeakerMappings(data.speaker_mappings || {});
          setHideUnidentifiedSpeakers(data.hide_unidentified_speakers || false);
          setReportsGenerated(data.reports_generated || false);

          // Database updates arrive after each local autosave. Do not replace the
          // in-memory Soniox stream while it is recording: the database snapshot
          // can be a few seconds behind and would otherwise erase new sentences.
          if (!isRecordingRef.current) {
            if (
              data.transcript_content &&
              Array.isArray(data.transcript_content) &&
              data.transcript_content.length > 0
            ) {
              console.log(
                "[Transcript Loading] Restoring",
                data.transcript_content.length,
                "saved transcript items"
              );
              setSavedTranscriptData(data.transcript_content);
              setSavedSonioxTranscript(data.transcript_content);
            } else {
              setSavedTranscriptData([]);
              setSavedSonioxTranscript([]);
            }
          }

          // Load saved recording duration
          if (data.transcript_metadata?.totalRecordingDuration) {
            setTotalRecordingDuration(
              data.transcript_metadata.totalRecordingDuration
            );
          }

          // Initialize keywords from transcript data and article
          const initializeKeywords = async () => {
            try {
              let allKeywords: string[] = [];

              // Get keywords from transcript custom keywords
              if (data.custom_keywords && Array.isArray(data.custom_keywords)) {
                allKeywords = [...data.custom_keywords];
              }

              // Fetch article data and pronunciation keywords
              if (transcriptInfo.articleId) {
                const { data: articleData } = await supabase
                  .from("articles")
                  .select("*")
                  .eq("id", transcriptInfo.articleId)
                  .maybeSingle();

                if (articleData) {
                  setArticleData(articleData as ArticleData);

                  // Add pronunciation keywords from article
                  if (
                    articleData.pronunciation_keywords &&
                    Array.isArray(articleData.pronunciation_keywords)
                  ) {
                    articleData.pronunciation_keywords.forEach((keyword) => {
                      if (!allKeywords.includes(keyword)) {
                        allKeywords.push(keyword);
                      }
                    });
                  }
                }
              }

              // Add leader names as keywords
              if (transcriptInfo.leaderUids.length > 0) {
                const userProfiles = await fetchUserProfiles(
                  transcriptInfo.leaderUids
                );
                userProfiles.forEach((profile) => {
                  if (
                    profile.displayName &&
                    !allKeywords.includes(profile.displayName)
                  ) {
                    allKeywords.push(profile.displayName);
                  }
                });
              }

              setKeywords(allKeywords);
              keywordsRef.current = allKeywords;
              console.log("[Keywords] Initialized keywords:", allKeywords);
              console.log("[Keywords] About to set keywordsLoaded to true");
              setKeywordsLoaded(true);
              keywordsLoadedRef.current = true;
              console.log("[Keywords] Keywords loaded state set to true");
            } catch (error) {
              console.error("Error initializing keywords:", error);
              // Even if there's an error, mark keywords as loaded so recording can proceed
              console.log(
                "[Keywords] Error occurred, but marking keywords as loaded anyway"
              );
              setKeywordsLoaded(true);
              keywordsLoadedRef.current = true;
            }
          };

          initializeKeywords();

          // Fetch user details for participants and leaders with phone numbers
          const fetchParticipantDetails = async () => {
            try {
              const allUids = [
                ...transcriptInfo.leaderUids,
                ...transcriptInfo.participantUids,
              ];
              if (allUids.length > 0) {
                const userDetailsWithPhone = await fetchUserDetails(allUids);
                const enhancedProfiles = userDetailsWithPhone.map((user) => ({
                  uid: user.uid,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  phoneNumber: user.phoneNumber,
                  phoneLast4: user.phoneLast4,
                  isLeader: transcriptInfo.leaderUids.includes(user.uid),
                }));
                setParticipants(enhancedProfiles);
              }
            } catch (error) {
              console.error("Error fetching user details:", error);
            }
          };

          fetchParticipantDetails();
        } else {
          setError("Transcript not found");
        }
        setLoading(false);
    };

    // Initial load + realtime subscription (replaces Firestore onSnapshot).
    const loadTranscript = async () => {
      const { data: row, error: fetchError } = await supabase
        .from("transcripts")
        .select("*")
        .eq("id", transcriptId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        console.error("Error fetching transcript:", fetchError);
        setError("Failed to load transcript");
        setLoading(false);
        return;
      }

      processTranscriptRow(row);
    };

    loadTranscript();

    const channel = supabase
      .channel(`transcript-${transcriptId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transcripts",
          filter: `id=eq.${transcriptId}`,
        },
        (payload) => {
          processTranscriptRow(payload.new);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [transcriptId]);

  // Load reports when transcript data is available
  useEffect(() => {
    if (transcriptData && reportsGenerated) {
      loadReports();
    }
  }, [transcriptData, reportsGenerated, loadReports]);

  // Auto-save transcript when it changes - ONLY during active recording
  useEffect(() => {
    if (isRecording && !isPaused && newLiveData.length > 0) {
      // Save every 2 seconds during active recording when there's new live data
      const saveTimer = setTimeout(() => {
        saveTranscriptToDatabase();
      }, 2000);

      return () => clearTimeout(saveTimer);
    }
  }, [newLiveData.length, saveTranscriptToDatabase, isRecording, isPaused]);

  // Generate qualitative analysis after transcript data is loaded and stable
  useEffect(() => {
    if (
      filteredFinalTranscript.length > 0 &&
      Object.keys(calculateSpeakingMetrics).length > 0 &&
      !isRecording && // Only run when not actively recording
      !isLoadingQualitativeAnalysis &&
      Object.keys(qualitativeAnalysis).length === 0 // Only run if not already generated
    ) {
      // Delay the analysis to ensure UI has loaded first
      const analysisTimer = setTimeout(() => {
        generateQualitativeAnalysis();
      }, 1000);

      return () => clearTimeout(analysisTimer);
    }
  }, [
    filteredFinalTranscript.length,
    calculateSpeakingMetrics,
    isRecording,
    isLoadingQualitativeAnalysis,
    qualitativeAnalysis,
    generateQualitativeAnalysis,
  ]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const formatTimestamp = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Audio player control functions
  const toggleAudioPlayback = useCallback(() => {
    if (!audioPlayerRef.current) return;

    if (isAudioPlaying) {
      audioPlayerRef.current.pause();
    } else {
      audioPlayerRef.current.play();
    }
    setIsAudioPlaying(!isAudioPlaying);
  }, [isAudioPlaying]);

  const seekAudio = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioPlayerRef.current) return;

    const progressBar = e.currentTarget;
    const clickPosition =
      (e.clientX - progressBar.getBoundingClientRect().left) /
      progressBar.clientWidth;
    const seekTime = clickPosition * (audioPlayerRef.current.duration || 0);

    audioPlayerRef.current.currentTime = seekTime;
    setAudioCurrentTime(seekTime);
    setAudioProgress(clickPosition * 100);
  }, []);

  const changePlaybackSpeed = useCallback((speed: number) => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  }, []);

  // Jump to specific timestamp
  const jumpToTimestamp = useCallback(
    (timestamp: number) => {
      if (!audioPlayerRef.current) return;
      audioPlayerRef.current.currentTime = timestamp;
      setAudioCurrentTime(timestamp);

      if (!isAudioPlaying) {
        audioPlayerRef.current.play();
        setIsAudioPlaying(true);
      }
    },
    [isAudioPlaying]
  );

  // Create a flat array of words with timestamps for word-level syncing
  const flatWordsWithTimestamps = useMemo(() => {
    return filteredFinalTranscript
      .filter((item) => item.alternatives && item.alternatives[0])
      .map((item, originalIndex) => ({
        content: item.alternatives[0].content,
        startTime: item.start_time || 0,
        endTime: item.end_time || 0,
        speaker: item.alternatives[0].speaker || "UU",
        confidence: item.alternatives[0].confidence || 1,
        originalIndex,
      }));
  }, [filteredFinalTranscript]);

  // Jump to specific word timestamp
  const jumpToWordTimestamp = useCallback(
    (snippetIndex: number, wordIndex: number) => {
      if (!audioPlayerRef.current || !filteredDisplaySnippets[snippetIndex])
        return;

      const snippet = filteredDisplaySnippets[snippetIndex];
      const word = snippet.words[wordIndex];

      // Find the word in flat words data to get exact timing
      const wordFromFlat = flatWordsWithTimestamps.find(
        (flatWord) =>
          flatWord.content === word.content &&
          Math.abs(flatWord.startTime - snippet.startTime) < 10 // Within 10 seconds of snippet start
      );

      const targetTime = wordFromFlat
        ? wordFromFlat.startTime
        : snippet.startTime;
      jumpToTimestamp(targetTime);
    },
    [filteredDisplaySnippets, flatWordsWithTimestamps, jumpToTimestamp]
  );

  // Handle audio time updates for word-level transcript highlighting
  const handleAudioTimeUpdate = useCallback(() => {
    if (!audioPlayerRef.current) return;

    const currentTime = audioPlayerRef.current.currentTime;
    setAudioCurrentTime(currentTime);

    // Calculate progress
    const duration = audioPlayerRef.current.duration || 1;
    setAudioProgress((currentTime / duration) * 100);

    // Find which snippet should be highlighted based on current time
    const currentSnippetIndex = displaySnippets.findIndex((snippet, index) => {
      const nextSnippet = displaySnippets[index + 1];
      return (
        currentTime >= snippet.startTime &&
        (!nextSnippet || currentTime < nextSnippet.startTime)
      );
    });

    // Map to filtered index if needed
    let mappedSnippetIndex = -1;
    if (currentSnippetIndex !== -1) {
      const currentSnippet = displaySnippets[currentSnippetIndex];
      mappedSnippetIndex = filteredDisplaySnippets.findIndex(
        (snippet) =>
          snippet.speaker === currentSnippet.speaker &&
          snippet.startTime === currentSnippet.startTime
      );
    }

    if (
      mappedSnippetIndex !== -1 &&
      mappedSnippetIndex !== currentlyHighlightedSnippet
    ) {
      setCurrentlyHighlightedSnippet(mappedSnippetIndex);
    }

    // Find currently playing word for word-level highlighting
    if (
      mappedSnippetIndex !== -1 &&
      filteredDisplaySnippets[mappedSnippetIndex]
    ) {
      const currentSnippet = filteredDisplaySnippets[mappedSnippetIndex];

      // Find which word in the snippet is currently playing
      let cumulativeTime = currentSnippet.startTime;
      let currentWordIndex = -1;

      // Use flat words data to find exact word timing
      const currentWordFromFlat = flatWordsWithTimestamps.find(
        (word) => word.startTime <= currentTime && word.endTime >= currentTime
      );

      if (currentWordFromFlat) {
        // Find this word in the current snippet
        currentWordIndex = currentSnippet.words.findIndex((word, index) => {
          // Match by content and approximate timing
          return word.content === currentWordFromFlat.content;
        });
      }

      // Update word highlighting
      const newWordHighlight =
        currentWordIndex !== -1
          ? {
              snippetIndex: mappedSnippetIndex,
              wordIndex: currentWordIndex,
            }
          : null;

      if (
        JSON.stringify(newWordHighlight) !==
        JSON.stringify(currentlyHighlightedWord)
      ) {
        setCurrentlyHighlightedWord(newWordHighlight);
      }
    } else {
      // Clear word highlighting if no snippet is active
      if (currentlyHighlightedWord) {
        setCurrentlyHighlightedWord(null);
      }
    }
  }, [
    displaySnippets,
    filteredDisplaySnippets,
    currentlyHighlightedSnippet,
    currentlyHighlightedWord,
    flatWordsWithTimestamps,
  ]);

  // Set up audio player event listeners
  useEffect(() => {
    if (recordedAudioUrl && audioPlayerRef.current) {
      const audio = audioPlayerRef.current;

      const handleLoadedMetadata = () => {
        setAudioDuration(audio.duration);
      };

      const handleTimeUpdate = () => {
        handleAudioTimeUpdate();
      };

      const handleEnded = () => {
        setIsAudioPlaying(false);
        setCurrentlyHighlightedSnippet(null);
        setCurrentlyHighlightedWord(null);
      };

      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
      };
    }
  }, [recordedAudioUrl, handleAudioTimeUpdate]);

  // Keyword management functions
  const addKeyword = async () => {
    if (!newKeyword.trim() || !transcriptId) return;

    const trimmedKeyword = newKeyword.trim();
    if (keywords.includes(trimmedKeyword)) {
      alert("Keyword already exists!");
      return;
    }

    try {
      const updatedKeywords = [...keywords, trimmedKeyword];
      setKeywords(updatedKeywords);
      keywordsRef.current = updatedKeywords;
      setNewKeyword("");
      console.log(
        "[Keywords] Added keyword:",
        trimmedKeyword,
        "Total keywords:",
        updatedKeywords.length
      );

      // Save to the database
      const { error } = await supabase
        .from("transcripts")
        .update({ custom_keywords: updatedKeywords })
        .eq("id", transcriptId);
      if (error) throw error;
    } catch (error) {
      console.error("Error adding keyword:", error);
      alert("Failed to add keyword. Please try again.");
    }
  };

  const removeKeyword = async (keywordToRemove: string) => {
    if (!transcriptId) return;

    try {
      const updatedKeywords = keywords.filter(
        (keyword) => keyword !== keywordToRemove
      );
      setKeywords(updatedKeywords);
      keywordsRef.current = updatedKeywords;

      // Save to the database
      const { error } = await supabase
        .from("transcripts")
        .update({ custom_keywords: updatedKeywords })
        .eq("id", transcriptId);
      if (error) throw error;
    } catch (error) {
      console.error("Error removing keyword:", error);
      alert("Failed to remove keyword. Please try again.");
    }
  };

  // Prepare custom dictionary for Soniox
  const prepareCustomDictionary = useCallback(() => {
    const currentKeywords = keywordsRef.current;
    console.log(
      "[Custom Dictionary] Using keywords from ref:",
      currentKeywords
    );
    const dictionary = currentKeywords.map((keyword) => {
      // Add sounds_like for better recognition
      const entry: { content: string; sounds_like?: string[] } = {
        content: keyword,
        sounds_like: [keyword], // Add the exact word as sounds_like
      };

      // Add common variations for better recognition
      if (keyword.includes(" ")) {
        // For phrases, add variations without spaces
        entry.sounds_like!.push(keyword.replace(/\s+/g, ""));
      }

      // Add variations for names (capitalize first letter)
      if (keyword.toLowerCase() !== keyword) {
        entry.sounds_like!.push(keyword.toLowerCase());
      }

      return entry;
    });

    console.log(
      "[Custom Dictionary] Prepared dictionary:",
      JSON.stringify(dictionary, null, 2)
    );
    return dictionary;
  }, []); // No longer depends on keywords state since we use ref

  if (loading) {
    return (
      <Container>
        <LoadingMessage>Loading transcript...</LoadingMessage>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
      </Container>
    );
  }

  if (!transcriptData) {
    return (
      <Container>
        <ErrorMessage>Transcript data not available</ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Content>
        {/* Provider Selection removed (Soniox-only) */}

        {transcriptionError && (
          <ErrorMessage>{transcriptionError}</ErrorMessage>
        )}

        <SessionInfoGrid>
          <SessionInfo>
            <SessionTitle>Session {transcriptData.sessionNumber}</SessionTitle>
            <SessionDetail>
              <strong>Article:</strong>{" "}
              {articleData?.title?.english ? (
                <ArticleLink
                  href={`/article/${transcriptData.articleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {articleData.title.english}
                </ArticleLink>
              ) : (
                <ArticleLink
                  href={`/article/${transcriptData.articleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {transcriptData.articleId}
                </ArticleLink>
              )}
            </SessionDetail>
            <SessionDetail>
              <strong>Leaders:</strong>
              <ParticipantsList>
                {participants
                  .filter((participant) => participant.isLeader)
                  .map((leader) => (
                    <ParticipantChip key={leader.uid} $isLeader>
                      <UserAvatar uid={leader.uid} size={24} isLeader={true} />
                      <span>{formatLeaderDisplay(leader)}</span>
                    </ParticipantChip>
                  ))}
                {participants.filter((p) => p.isLeader).length === 0 &&
                  transcriptData.leaderUids.map((uid) => (
                    <ParticipantChip key={uid} $isLeader>
                      <UserAvatar uid={uid} size={24} isLeader={true} />
                      <span>Loading...</span>
                    </ParticipantChip>
                  ))}
              </ParticipantsList>
            </SessionDetail>
            <SessionDetail>
              <strong>Participants:</strong>
              <ParticipantsList>
                {participants
                  .filter((participant) => !participant.isLeader)
                  .map((participant) => (
                    <ParticipantChip key={participant.uid}>
                      <UserAvatar
                        uid={participant.uid}
                        size={24}
                        isLeader={false}
                      />
                      <span>{formatParticipantDisplay(participant)}</span>
                    </ParticipantChip>
                  ))}
                {participants.filter((p) => !p.isLeader).length === 0 &&
                  transcriptData.participantUids.map((uid) => (
                    <ParticipantChip key={uid}>
                      <UserAvatar uid={uid} size={24} isLeader={false} />
                      <span>Loading...</span>
                    </ParticipantChip>
                  ))}
              </ParticipantsList>
            </SessionDetail>
          </SessionInfo>

          <ChartPanel>
            <ChartTitle>Speaking Time Share</ChartTitle>
            <Pie
              data={pieChartData}
              options={{
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      usePointStyle: true,
                      pointStyle: "circle",
                      boxWidth: 10,
                      boxHeight: 10,
                      padding: 14,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx: any) => {
                        const label = ctx.label || "";
                        const value = ctx.parsed || 0;
                        return `${label}: ${value}s`;
                      },
                    },
                  },
                },
              }}
            />
          </ChartPanel>
        </SessionInfoGrid>

        <ConversationDetailContainer>
          <ConversationDetailLeft>
            <AppSpeechDetails>
              <SectionHeader>Keywords</SectionHeader>
              <KeywordManagementSection>
                <KeywordInputContainer>
                  <KeywordInput
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Add a custom keyword..."
                    onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                  />
                  <AddKeywordButton
                    onClick={addKeyword}
                    disabled={!newKeyword.trim()}
                  >
                    Add
                  </AddKeywordButton>
                </KeywordInputContainer>
                <KeywordsList>
                  {keywords.map((keyword) => (
                    <KeywordChip key={keyword}>
                      {keyword}
                      <RemoveKeywordButton
                        onClick={() => removeKeyword(keyword)}
                        title="Remove keyword"
                      >
                        ×
                      </RemoveKeywordButton>
                    </KeywordChip>
                  ))}
                </KeywordsList>
              </KeywordManagementSection>
            </AppSpeechDetails>

            <AppSpeechDetails>
              <SectionHeader>
                <span>Speakers</span>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <ToggleButton
                    $active={hideUnidentifiedSpeakers}
                    onClick={() => setHideUnidentifiedSpeakers(!hideUnidentifiedSpeakers)}
                    title={hideUnidentifiedSpeakers ? "Show all speakers including Unknown" : "Hide Unknown speakers"}
                  >
                    {hideUnidentifiedSpeakers ? "Show All" : "Hide Unknown"}
                  </ToggleButton>

                  <RecordingControls>
                    {isRecording ? (
                      <>
                        <PauseResumeButton
                          $isRecording={isRecording && !isPaused}
                          onClick={toggleRecording}
                          disabled={isStarting || isStopping}
                        >
                          {isPaused ? (
                            <>
                              <RecordIcon />
                              Resume Recording
                            </>
                          ) : (
                            <>
                              <PulseIcon />
                              Pause Recording
                            </>
                          )}
                        </PauseResumeButton>
                        <StopRecordingButton
                          onClick={handleStopRecording}
                          disabled={isStarting || isStopping}
                        >
                          Stop Recording
                        </StopRecordingButton>
                      </>
                    ) : (
                      <RecordButton
                        $isRecording={false}
                        onClick={toggleRecording}
                        disabled={isStarting || isStopping || !keywordsLoaded}
                      >
                        {isStopping ? (
                          <>
                            <PulseIcon />
                            Stopping...
                          </>
                        ) : isStarting ? (
                          <>
                            <PulseIcon />
                            Starting...
                          </>
                        ) : !keywordsLoaded ? (
                          <>
                            <PulseIcon />
                            Loading Keywords...
                          </>
                        ) : (
                          <>
                            <RecordIcon />
                            Start Recording
                          </>
                        )}
                      </RecordButton>
                    )}
                  </RecordingControls>
                </div>
              </SectionHeader>
              <LegendContent>
                <LegendSpeakers>
                  <LegendItem>
                    <LegendColor $color="#4f46e5" />
                    Speaker 1
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#e11d48" />
                    Speaker 2
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#059669" />
                    Speaker 3
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#d97706" />
                    Speaker 4
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#9333ea" />
                    Speaker 5
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#6b7280" />
                    Unknown
                  </LegendItem>
                </LegendSpeakers>
                <ConfidenceNote>
                  Low confidence words appear underlined • Click timestamps to
                  jump to audio position • Keywords are used as custom
                  dictionary for better recognition
                  {hideUnidentifiedSpeakers &&
                    " • Unidentified speakers are hidden"}
                </ConfidenceNote>
              </LegendContent>
            </AppSpeechDetails>

            {/* Render transcript snippets */}
            {conversationItems.map((item) => {
              if (item.type === "copilot-thinking") {
                return <CopilotTranscriptSnippet key="copilot-thinking" isThinking />;
              }

              if (item.type === "copilot") {
                return (
                  <CopilotTranscriptSnippet
                    key={`copilot-${item.message.id}`}
                    message={item.message}
                  />
                );
              }

              const { snippet, snippetIndex: index } = item;
              const speakerColor = getSpeakerColor(snippet.speaker);
              const speakerInfo = getSpeakerDisplayInfo(snippet.speaker);
              const hasAudio = !!recordedAudioUrl;
              const isHighlighted = currentlyHighlightedSnippet === index;

              return (
                <TranscriptSnippet
                  key={`snippet-${index}`}
                  style={{
                    backgroundColor: isHighlighted ? "#fff2cc" : "transparent",
                    transition: "background-color 0.3s ease",
                  }}
                >
                  <div>
                    {speakerInfo.isAssigned && speakerInfo.avatar ? (
                      <UserAvatar
                        uid={speakerInfo.avatar}
                        size={40}
                        isLeader={speakerInfo.isLeader}
                        onClick={() => handleSpeakerClick(snippet.speaker)}
                      />
                    ) : (
                      <SpeakerAvatar
                        $bgColor={speakerColor.avatar}
                        $textColor="#ffffff"
                        onClick={() => handleSpeakerClick(snippet.speaker)}
                      >
                        {snippet.speaker === "UU"
                          ? "U"
                          : snippet.speaker.slice(1)}
                      </SpeakerAvatar>
                    )}
                  </div>
                  <TranscriptContent>
                    <TranscriptHeadRow>
                      <SpeakerName $color={speakerColor.avatar}>
                        {speakerInfo.name}
                      </SpeakerName>
                      <Timestamp
                        style={{ cursor: hasAudio ? "pointer" : "default" }}
                        onClick={() =>
                          hasAudio && jumpToTimestamp(snippet.startTime)
                        }
                      >
                        {formatTimestamp(snippet.startTime)}
                      </Timestamp>
                    </TranscriptHeadRow>
                    <TranscriptBody>
                      {snippet.words.map((word, wordIndex) => {
                        const isCurrentlyPlaying =
                          currentlyHighlightedWord &&
                          currentlyHighlightedWord.snippetIndex === index &&
                          currentlyHighlightedWord.wordIndex === wordIndex;

                        const isPunctuation = isPunctuationOrAttached(word);

                        return (
                          <WordSpan
                            key={`word-${index}-${wordIndex}`}
                            $lowConfidence={
                              word.confidence !== undefined &&
                              word.confidence < 0.9
                            }
                            $isPartial={word.isPartial}
                            $isCurrentlyPlaying={isCurrentlyPlaying}
                            $isPunctuation={isPunctuation}
                            onClick={() =>
                              jumpToWordTimestamp(index, wordIndex)
                            }
                            title={`Click to jump to this word${
                              hasAudio ? "" : " (no audio available)"
                            }`}
                            style={{
                              cursor: hasAudio ? "pointer" : "default",
                              pointerEvents: hasAudio ? "auto" : "none",
                            }}
                          >
                            {word.content}
                            {/* Add space after word unless it's punctuation */}
                            {!word.preserveSpacing && !isPunctuationOrAttached(word) ? " " : ""}
                          </WordSpan>
                        );
                      })}
                    </TranscriptBody>
                  </TranscriptContent>
                </TranscriptSnippet>
              );
            })}

            {conversationItems.length === 0 && (
              <EmptyState>
                {displaySnippets.length === 0
                  ? isRecording
                    ? isPaused
                      ? "Recording is paused. Audio continues but transcript processing is stopped."
                      : "Listening..."
                    : 'Click "Start Recording" to begin.'
                  : 'All speakers are hidden. Toggle "Show All" to see unidentified speakers.'}
              </EmptyState>
            )}

            {/* Speaking Analysis Reports Section */}
            <ReportsSection>
              <SectionHeader>
                <span>Speaking Analysis Reports</span>
                <ToggleButton
                  $active={false}
                  onClick={() => setShowCreateReportDialog(true)}
                  title="Generate speaking reports for participants"
                >
                  📊 Generate Reports
                </ToggleButton>
              </SectionHeader>

              {reports.length === 0 ? (
                <EmptyState>
                  No reports yet. Click "Generate Reports" to analyze this transcript and create per-participant reports.
                </EmptyState>
              ) : (
                reports.map((report) => (
                  <ReportCard
                    key={`${report.userId}_${report.metadata.createdAt.getTime()}`}
                    onClick={() => {
                      setSelectedReport(report);
                      setShowDetailedReport(true);
                    }}
                  >
                    <ReportHeader>
                      <ReportUserName>
                        <UserAvatar
                          uid={report.userId}
                          size={32}
                          isLeader={
                            participants.find((p) => p.uid === report.userId)
                              ?.isLeader || false
                          }
                        />
                        {getParticipantName(report.userId)}
                      </ReportUserName>
                      <ReportScore $score={report.analysis.overallScore}>
                        {report.analysis.overallScore.toFixed(1)}/10
                      </ReportScore>
                    </ReportHeader>

                    <ReportMetrics>
                      <ReportMetric>
                        <ReportMetricValue>
                          {report.metadata.wordCount}
                        </ReportMetricValue>
                        <ReportMetricLabel>Words</ReportMetricLabel>
                      </ReportMetric>
                      <ReportMetric>
                        <ReportMetricValue>
                          {Math.round(report.metadata.speakingDuration)}s
                        </ReportMetricValue>
                        <ReportMetricLabel>Duration</ReportMetricLabel>
                      </ReportMetric>
                      <ReportMetric>
                        <ReportMetricValue>
                          {Math.round(report.metadata.averageWordsPerMinute)}
                        </ReportMetricValue>
                        <ReportMetricLabel>WPM</ReportMetricLabel>
                      </ReportMetric>
                    </ReportMetrics>

                    <ReportPreview>
                      <strong>Top Strength:</strong> {report.analysis.strengths[0] || "Good participation"}
                      <br />
                      <strong>Focus Area:</strong> {report.analysis.areasForImprovement[0] || "Continue practicing"}
                    </ReportPreview>
                  </ReportCard>
                ))
              )}
            </ReportsSection>
          </ConversationDetailLeft>
        </ConversationDetailContainer>
      </Content>

      {/* Create Report Dialog */}
      {showCreateReportDialog && (
        <ReportDialogOverlay onClick={() => setShowCreateReportDialog(false)}>
          <ReportDialogContainer onClick={(e) => e.stopPropagation()}>
            <ReportDialogTitle>
              Create Speaking Analysis Reports
            </ReportDialogTitle>
            <ReportDialogContent>
              <p>
                Generate AI-powered speaking analysis reports for all
                participants who were assigned to speakers during this session.
              </p>
              <p>
                The analysis will include scores for fluency, vocabulary,
                grammar, pronunciation, and engagement, along with personalized
                feedback and improvement suggestions.
              </p>
              {Object.keys(speakerMappings).filter((id) => speakerMappings[id])
                .length === 0 && (
                <p style={{ color: "#ef4444", fontWeight: "600" }}>
                  ⚠️ No speakers have been assigned to participants yet. Please
                  assign speakers before generating reports.
                </p>
              )}
            </ReportDialogContent>
            <ReportDialogActions>
              <ReportDialogButton
                onClick={() => setShowCreateReportDialog(false)}
              >
                Cancel
              </ReportDialogButton>
              <ReportDialogButton
                $variant="primary"
                onClick={handleGenerateReports}
                disabled={
                  Object.keys(speakerMappings).filter(
                    (id) => speakerMappings[id]
                  ).length === 0
                }
              >
                {isGeneratingReports ? (
                  <>
                    <PulseIcon />
                    Generating Reports...
                  </>
                ) : (
                  <>📊 Generate Reports</>
                )}
              </ReportDialogButton>
            </ReportDialogActions>
          </ReportDialogContainer>
        </ReportDialogOverlay>
      )}

      {/* Speaker Assignment Modal */}
      {showSpeakerModal && selectedSpeaker && (
        <ModalOverlay onClick={() => setShowSpeakerModal(false)}>
          <ModalContainer onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Assign Speaker</ModalTitle>
            <ModalSubtitle>
              Who is{" "}
              {selectedSpeaker === "UU"
                ? "Unknown Speaker"
                : `Speaker ${selectedSpeaker.slice(1)}`}
              ? Click on a participant to assign them to this speaker.
            </ModalSubtitle>

            <ParticipantGrid>
              {participants.map((participant) => (
                <ParticipantOption
                  key={participant.uid}
                  onClick={() => handleAssignSpeaker(participant.uid)}
                >
                  <UserAvatar
                    uid={participant.uid}
                    size={40}
                    isLeader={participant.isLeader}
                  />
                  <ParticipantInfo>
                    <ParticipantName>
                      {participant.isLeader
                        ? formatLeaderDisplay(participant)
                        : formatParticipantDisplay(participant)}
                    </ParticipantName>
                    <ParticipantRole>
                      {participant.isLeader ? "Leader" : "Participant"}
                    </ParticipantRole>
                  </ParticipantInfo>
                </ParticipantOption>
              ))}
            </ParticipantGrid>

            <ModalActions>
              <ModalButton onClick={() => setShowSpeakerModal(false)}>
                Cancel
              </ModalButton>
            </ModalActions>
          </ModalContainer>
        </ModalOverlay>
      )}

      {/* Audio Player */}
      {recordedAudioUrl && (
        <>
          <AudioPlayerContainer $isVisible={!!recordedAudioUrl}>
            <AudioControls>
              <AudioButton onClick={toggleAudioPlayback}>
                {isAudioPlaying ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    style={{ width: "1.5rem", height: "1.5rem" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    style={{ width: "1.5rem", height: "1.5rem" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                    />
                  </svg>
                )}
              </AudioButton>
              <AudioTime>{formatTime(audioCurrentTime)}</AudioTime>
            </AudioControls>

            <AudioProgress onClick={seekAudio}>
              <AudioProgressFill $progress={audioProgress} />
            </AudioProgress>

            <AudioControls>
              <AudioTime>{formatTime(audioDuration)}</AudioTime>
              <SpeedButton
                $active={playbackSpeed === 0.75}
                onClick={() => changePlaybackSpeed(0.75)}
              >
                0.75×
              </SpeedButton>
              <SpeedButton
                $active={playbackSpeed === 1}
                onClick={() => changePlaybackSpeed(1)}
              >
                1×
              </SpeedButton>
              <SpeedButton
                $active={playbackSpeed === 1.25}
                onClick={() => changePlaybackSpeed(1.25)}
              >
                1.25×
              </SpeedButton>
              <SpeedButton
                $active={playbackSpeed === 1.5}
                onClick={() => changePlaybackSpeed(1.5)}
              >
                1.5×
              </SpeedButton>
            </AudioControls>
          </AudioPlayerContainer>

          {/* Hidden audio element */}
          <audio
            ref={audioPlayerRef}
            src={recordedAudioUrl}
            preload="metadata"
            style={{ display: "none" }}
          />
        </>
      )}

      {/* Detailed Report Modal */}
      {showDetailedReport && selectedReport && (
        <DetailedReportModal onClick={() => setShowDetailedReport(false)}>
          <DetailedReportContainer onClick={(e) => e.stopPropagation()}>
            <DetailedReportTitle>
              Speaking Analysis Report -{" "}
              {getParticipantName(selectedReport.userId)}
            </DetailedReportTitle>

            {/* Overall Score and Category Scores */}
            <ScoreGrid>
              <ScoreCard>
                <ScoreTitle>Overall Score</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.overallScore}>
                  {selectedReport.analysis.overallScore.toFixed(1)}/10
                </ScoreValue>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Fluency</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.fluency.score}>
                  {selectedReport.analysis.fluency.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.fluency.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Vocabulary</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.vocabulary.score}>
                  {selectedReport.analysis.vocabulary.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.vocabulary.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Grammar</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.grammar.score}>
                  {selectedReport.analysis.grammar.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.grammar.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Pronunciation</ScoreTitle>
                <ScoreValue
                  $score={selectedReport.analysis.pronunciation.score}
                >
                  {selectedReport.analysis.pronunciation.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.pronunciation.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Engagement</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.engagement.score}>
                  {selectedReport.analysis.engagement.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.engagement.feedback}
                </ScoreFeedback>
              </ScoreCard>
            </ScoreGrid>

            {/* Strengths */}
            <FeedbackSection>
              <FeedbackTitle>Strengths</FeedbackTitle>
              <FeedbackList>
                {selectedReport.analysis.strengths.map((strength, index) => (
                  <FeedbackItem key={index}>{strength}</FeedbackItem>
                ))}
              </FeedbackList>
            </FeedbackSection>

            {/* Areas for Improvement */}
            <FeedbackSection>
              <FeedbackTitle>Areas for Improvement</FeedbackTitle>
              <FeedbackList>
                {selectedReport.analysis.areasForImprovement.map(
                  (area, index) => (
                    <FeedbackItem key={index}>{area}</FeedbackItem>
                  )
                )}
              </FeedbackList>
            </FeedbackSection>

            {/* Specific Suggestions */}
            <FeedbackSection>
              <FeedbackTitle>Specific Suggestions</FeedbackTitle>
              <FeedbackList>
                {selectedReport.analysis.specificSuggestions.map(
                  (suggestion, index) => (
                    <FeedbackItem key={index}>{suggestion}</FeedbackItem>
                  )
                )}
              </FeedbackList>
            </FeedbackSection>

            {/* Speaking Statistics */}
            <FeedbackSection>
              <FeedbackTitle>📊 Speaking Statistics</FeedbackTitle>
              <ReportMetrics>
                <ReportMetric>
                  <ReportMetricValue>
                    {selectedReport.metadata.wordCount}
                  </ReportMetricValue>
                  <ReportMetricLabel>Total Words</ReportMetricLabel>
                </ReportMetric>
                <ReportMetric>
                  <ReportMetricValue>
                    {Math.round(selectedReport.metadata.speakingDuration)}s
                  </ReportMetricValue>
                  <ReportMetricLabel>Speaking Duration</ReportMetricLabel>
                </ReportMetric>
                <ReportMetric>
                  <ReportMetricValue>
                    {Math.round(selectedReport.metadata.averageWordsPerMinute)}
                  </ReportMetricValue>
                  <ReportMetricLabel>Words Per Minute</ReportMetricLabel>
                </ReportMetric>
                <ReportMetric>
                  <ReportMetricValue>
                    {selectedReport.metadata.createdAt.toLocaleDateString()}
                  </ReportMetricValue>
                  <ReportMetricLabel>Report Date</ReportMetricLabel>
                </ReportMetric>
              </ReportMetrics>
            </FeedbackSection>

            {/* User's Transcript */}
            <TranscriptSection>
              <TranscriptTitle>
                <DocumentTextIcon />
                Your Speaking Transcript
              </TranscriptTitle>
              <TranscriptText>{selectedReport.userScript}</TranscriptText>
            </TranscriptSection>

            <ReportDialogActions>
              <ReportDialogButton onClick={() => setShowDetailedReport(false)}>
                Close
              </ReportDialogButton>
            </ReportDialogActions>
          </DetailedReportContainer>
        </DetailedReportModal>
      )}
    </Container>
  );
}
