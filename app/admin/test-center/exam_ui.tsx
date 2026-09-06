"use client";

import type { ElementType, ReactNode } from "react";

import type { ExamInterviewer, ExamMediaStatus, ExamSetStatus } from "../../lib/features/exam/types";

type UiProps = {
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>;

type PolymorphicTag = (props: Record<string, unknown>) => ReactNode;

export function ExamPage({ className = "", children, ...rest }: UiProps) {
  return <main className={`mx-auto max-w-[1240px] px-5 pb-14 text-[#050505] max-[700px]:px-[15px] max-[700px]:pb-[38px] ${className}`} {...rest}>{children}</main>;
}

export function ExamHeader({ className = "", children, ...rest }: UiProps) {
  return <header className={`m-0 mb-[26px] flex items-end justify-between gap-5 border-b-2 border-[#050505] pb-[18px] max-[700px]:flex-col max-[700px]:items-start ${className}`} {...rest}>{children}</header>;
}

export function Eyebrow({ className = "", children, ...rest }: UiProps) {
  return <p className={`m-0 mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#c84932] ${className}`} {...rest}>{children}</p>;
}

export function PageTitle({ className = "", children, ...rest }: UiProps) {
  return <h1 className={`m-0 text-[clamp(28px,5vw,44px)] font-black leading-none tracking-[-0.055em] ${className}`} {...rest}>{children}</h1>;
}

export function PageLead({ className = "", children, ...rest }: UiProps) {
  return <p className={`m-0 mt-2.5 max-w-[650px] text-[14px] font-[550] leading-[1.62] text-[rgba(5,5,5,0.67)] ${className}`} {...rest}>{children}</p>;
}

export type ButtonTone = "ink" | "cream" | "orange";

export function Button({
  as = "button",
  $tone = "ink",
  sizeClassName = "min-h-[42px] px-[14px] py-[9px] text-[12px] shadow-[3px_3px_0_#050505]",
  className = "",
  children,
  ...rest
}: { as?: ElementType; $tone?: ButtonTone; sizeClassName?: string } & UiProps) {
  const Tag = as as unknown as PolymorphicTag;
  const tone = $tone === "ink" ? "bg-[#050505] text-white" : $tone === "orange" ? "bg-[#f47a4a] text-[#050505]" : "bg-[#fff8dc] text-[#050505]";
  return (
    <Tag
      className={`inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-full border-2 border-[#050505] font-[850] no-underline [transition:transform_140ms_ease,box-shadow_140ms_ease] disabled:cursor-wait disabled:opacity-60 [&:hover:not(:disabled)]:shadow-[5px_5px_0_#050505] [&:hover:not(:disabled)]:[transform:translate(-1px,-1px)] [&_svg]:h-4 [&_svg]:w-4 ${sizeClassName} ${tone} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function TextButton({ className = "", children, ...rest }: UiProps) {
  return <button className={`cursor-pointer border-0 bg-transparent px-0 py-[2px] text-[12px] font-[850] text-[#050505] underline underline-offset-[3px] ${className}`} {...rest}>{children}</button>;
}

export function Notice({ $error = false, className = "", children, ...rest }: { $error?: boolean } & UiProps) {
  return <p className={`m-0 mb-[18px] border-l-[3px] py-[7px] pl-2.5 text-[13px] font-[650] leading-[1.45] ${$error ? "border-l-[#c84932] text-[#9b2e1e]" : "border-l-[#f47a4a] text-[rgba(5,5,5,0.7)]"} ${className}`} {...rest}>{children}</p>;
}

export function Card({ as = "article", className = "", children, ...rest }: { as?: ElementType } & UiProps) {
  const Tag = as as unknown as PolymorphicTag;
  return <Tag className={`rounded-[14px] border-2 border-[#050505] bg-white shadow-[4px_4px_0_#050505] ${className}`} {...rest}>{children}</Tag>;
}

export function Loading({ className = "", children, ...rest }: UiProps) {
  return <div className={`grid min-h-[300px] place-items-center text-[14px] font-extrabold text-[rgba(5,5,5,0.65)] ${className}`} {...rest}>{children}</div>;
}

export function ExamAvatar({ interviewer, large = false }: { interviewer: Pick<ExamInterviewer, "name" | "avatar_key">; large?: boolean }) {
  const initials = interviewer.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const seed = interviewer.avatar_key;
  const hair = seed.includes("elena") || seed.includes("sofia") ? "#3c2823" : seed.includes("robert") || seed.includes("noah") ? "#2c2420" : "#263142";
  const outfit = seed.includes("elena") ? "#f5e7ca" : seed.includes("robert") ? "#383a40" : seed.includes("david") ? "#141414" : "#d6e7d5";
  const background = [
    "radial-gradient(circle at 50% 34%, #f6c9a9 0 15%, transparent 15.6%)",
    `radial-gradient(circle at 50% 33%, ${hair} 0 23%, transparent 23.6%)`,
    `radial-gradient(ellipse at 50% 110%, ${outfit} 0 46%, transparent 46.5%)`,
    "linear-gradient(135deg, #ffeab0, #f47a4a)",
  ].join(",\n    ");
  return (
    <div
      className={`grid flex-none place-items-center overflow-hidden border-2 border-[#050505] shadow-[inset_0_-18px_30px_rgba(5,5,5,0.08)] ${large ? "aspect-[16/10] w-full rounded-[10px]" : "aspect-square w-[52px] rounded-full"}`}
      style={{ background }}
      role="img"
      aria-label={`${interviewer.name} profile preview`}
    >
      <span className={`rounded-full bg-[rgba(255,255,255,0.78)] font-black tracking-[0.04em] text-[#050505] ${large ? "mt-[30%] px-2.5 py-1.5 text-[16px]" : "mt-[24%] px-[5px] py-[3px] text-[9px]"}`}>{initials}</span>
    </div>
  );
}

export function GardenScene({ target }: { target?: string }) {
  return (
    <div
      className="relative min-h-[195px] overflow-hidden rounded-xl border-2 border-[#050505] bg-[linear-gradient(#ffe9a5_0_54%,#88ba77_54%_100%)] before:absolute before:left-[9%] before:top-8 before:h-[49%] before:w-[54%] before:border-[5px] before:border-b-0 before:border-[#050505] before:bg-[repeating-linear-gradient(90deg,transparent_0_27px,rgba(5,5,5,.8)_28px_31px)] before:content-[''] after:absolute after:bottom-[26px] after:right-[10%] after:h-[58px] after:w-[58px] after:rounded-[50%_50%_42%_42%] after:border-4 after:border-[#050505] after:bg-[#f47a4a] after:shadow-[-114px_18px_0_-11px_#ebcd4e,-84px_-4px_0_-9px_#e75d43,-46px_23px_0_-12px_#e99a35] after:content-['']"
      aria-label="Community garden visual preview"
    >
      <p className="absolute bottom-[11px] right-3 z-[1] m-0 max-w-40 rounded-full border border-[#050505] bg-white px-2 py-1 text-center text-[10px] font-[850] leading-[1.15] text-[#050505]">{target || "Community garden scene"}</p>
    </div>
  );
}

type PillTone = "ready" | "pending" | "rejected" | "draft" | "published";

function Pill({ $tone, children }: { $tone: PillTone; children: ReactNode }) {
  const background = $tone === "ready" || $tone === "published" ? "bg-[#ccebc5]" : $tone === "rejected" ? "bg-[#f7cac1]" : $tone === "draft" ? "bg-[#fff0b9]" : "bg-white";
  return <span className={`inline-flex items-center rounded-full border-[1.5px] border-[#050505] px-[7px] py-1 text-[10px] font-[850] leading-none text-[#050505] ${background}`}>{children}</span>;
}

export function MediaPill({ status, label }: { status: ExamMediaStatus; label?: string }) {
  return <Pill $tone={status === "ready" ? "ready" : "pending"}>{label || (status === "ready" ? "Ready" : "Needs media")}</Pill>;
}

export function SetStatusPill({ status }: { status: ExamSetStatus }) {
  const tone = status === "published" ? "published" : status === "draft" ? "draft" : "ready";
  return <Pill $tone={tone}>{status === "media_ready" ? "Media ready" : status}</Pill>;
}

export function InterviewerStatusPill({ status }: { status: ExamInterviewer["status"] }) {
  const tone = status === "approved" ? "ready" : status === "rejected" ? "rejected" : "pending";
  return <Pill $tone={tone}>{status === "approved" ? "Hired" : status === "pending" ? "Review" : "Rejected"}</Pill>;
}
