"use client";

import Image from "next/image";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";

import type { ExamInterviewer, ExamMediaStatus, ExamSetStatus } from "../../lib/features/exam/types";
import { useI18n } from "../../lib/i18n/I18nProvider";

type UiProps = {
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>;

type PolymorphicTag = (props: Record<string, unknown>) => ReactNode;

const monoFont = "[font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace]";
const serifFont = "[font-family:Georgia,'Times_New_Roman',serif]";

export function ExamPage({ className = "", children, ...rest }: UiProps) {
  return <main className={`min-h-screen bg-[#fdfcf9] text-ink [font-family:'Noto_Sans_KR',system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] ${className}`} {...rest}>{children}</main>;
}

export function ExamContent({ className = "", children, ...rest }: UiProps) {
  return <div className={`mx-auto w-[min(1390px,calc(100%_-_104px))] pt-[54px] pb-20 max-[760px]:w-[min(100%_-_32px,1390px)] max-[760px]:pt-8 max-[760px]:pb-[56px] ${className}`} {...rest}>{children}</div>;
}

export function ExamPipelineTopbar({
  current,
  actionHref,
  actionLabel,
}: {
  current: "assets" | "sets" | "inspection";
  actionHref: string;
  actionLabel: string;
}) {
  const { t } = useI18n();
  const context = current === "assets"
    ? t.examCenter.interviewerAssets
    : current === "sets"
      ? t.examCenter.testOperations
      : t.examCenter.productionManifest;

  return <header className="grid min-h-[70px] grid-cols-[minmax(170px,1fr)_auto_minmax(170px,1fr)] items-center border-b border-[#1d0d08] bg-primary px-[34px] text-[#fffaf7] max-[720px]:min-h-[58px] max-[720px]:grid-cols-[1fr_auto] max-[720px]:px-[18px]">
    <Link href="/admin/test-center" aria-label={t.examCenter.pipelineTitle} className={`inline-flex w-max items-center gap-2.5 text-inherit no-underline ${monoFont} text-[10px] font-bold leading-[1.14] tracking-[.09em] hover:text-[#fffaf7] hover:no-underline`}>
      <span aria-hidden="true" className="flex h-[23px] w-[23px] items-end gap-[3px] [&_span]:w-[5px] [&_span]:rounded-[1px] [&_span]:bg-[#f47a4a] [&_span:nth-child(1)]:h-[11px] [&_span:nth-child(2)]:h-[19px] [&_span:nth-child(3)]:h-[15px]"><span /><span /><span /></span>
      <span>1 CUP<br />TEST PIPELINE</span>
    </Link>
    <div className={`flex items-center text-[#e8d9d0] ${monoFont} text-[10px] uppercase tracking-[.09em] max-[720px]:hidden`}><span className="mr-2 mb-px h-[6px] w-[6px] rounded-full bg-[#f47a4a]" />{t.examCenter.workspace}<span className="mx-3 h-[11px] border-l border-[#7b594c]" />{context}</div>
    <Link href={actionHref} className={`justify-self-end border border-[#a57e70] px-[11px] py-2 text-[#fffaf7] ${monoFont} text-[9px] font-bold uppercase tracking-[.07em] no-underline hover:border-[#f47a4a] hover:bg-[#412218] hover:text-[#fffaf7] hover:no-underline`}>{actionLabel}</Link>
  </header>;
}

export function PipelineEyebrow({ className = "", children, ...rest }: UiProps) {
  return <p className={`m-0 text-[#74645d] ${monoFont} text-[10px] font-semibold uppercase leading-[1.35] tracking-[.1em] ${className}`} {...rest}>{children}</p>;
}

export function PipelineTitle({ className = "", children, ...rest }: UiProps) {
  return <h1 className={`m-0 mt-2.5 text-ink ${serifFont} text-[clamp(42px,5vw,62px)] font-medium leading-[.98] tracking-[-.062em] ${className}`} {...rest}>{children}</h1>;
}

export function PipelinePeriod({ className = "", children, ...rest }: UiProps) {
  return <span className={`text-[#f47a4a] ${className}`} {...rest}>{children}</span>;
}

export function PipelineLead({ className = "", children, ...rest }: UiProps) {
  return <p className={`m-0 mt-3.5 max-w-[700px] text-[#6f625c] text-[14px] leading-[1.58] ${className}`} {...rest}>{children}</p>;
}

export type ButtonTone = "ink" | "cream" | "orange";

const buttonToneClass: Record<ButtonTone, string> = {
  ink: "border-primary bg-primary text-white shadow-[3px_3px_0_#2c1810] [&:hover:not(:disabled)]:bg-[#43251b] [&:hover:not(:disabled)]:shadow-[4px_4px_0_#2c1810]",
  orange: "border-[#d95f32] bg-[#f47a4a] text-white shadow-[3px_3px_0_#2c1810] [&:hover:not(:disabled)]:bg-[#dd6538] [&:hover:not(:disabled)]:shadow-[4px_4px_0_#2c1810]",
  cream: "border-[#bbaaa2] bg-[#fffdfb] text-[#4b3026] shadow-none [&:hover:not(:disabled)]:bg-[#fff5ef] [&:hover:not(:disabled)]:shadow-[2px_2px_0_#ead8cf]",
};

export function Button({
  as = "button",
  $tone = "ink",
  className = "",
  children,
  ...rest
}: { as?: ElementType; $tone?: ButtonTone } & UiProps) {
  const Tag = as as unknown as PolymorphicTag;
  return (
    <Tag
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-[7px] border px-[13px] py-[9px] text-[12px] font-extrabold leading-none no-underline [transition:transform_130ms_ease,background_130ms_ease,box-shadow_130ms_ease] [&:hover:not(:disabled)]:[transform:translate(-1px,-1px)] disabled:cursor-wait disabled:opacity-[.56] disabled:shadow-none [&_svg]:h-4 [&_svg]:w-4 ${buttonToneClass[$tone]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Notice({ $error = false, className = "", children, ...rest }: { $error?: boolean } & UiProps) {
  return <div className={`mt-5 flex min-h-9 items-center border px-3 py-2 text-[12px] leading-[1.5] ${$error ? "border-[#edb8a9] bg-[#fff3ee] text-[#9f4229]" : "border-[#eccfbf] bg-[#fff8f3] text-[#664333]"} ${className}`} {...rest}>{children}</div>;
}

export function Loading({ className = "", children, ...rest }: UiProps) {
  return <div className={`grid min-h-[60vh] place-items-center text-[#7c6a62] text-[14px] font-[650] ${className}`} {...rest}>{children}</div>;
}

export function ExamAvatar({ interviewer, large = false }: { interviewer: Pick<ExamInterviewer, "name" | "avatar_key" | "image_url">; large?: boolean }) {
  const initials = interviewer.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const seed = interviewer.avatar_key;
  const hair = seed.includes("elena") || seed.includes("sofia") ? "#3c2823" : seed.includes("robert") || seed.includes("noah") ? "#2c2420" : "#263142";
  const outfit = seed.includes("elena") ? "#f5e7ca" : seed.includes("robert") ? "#383a40" : seed.includes("david") ? "#141414" : "#d6e7d5";
  const background = [
    "radial-gradient(circle at 50% 34%, #f6c9a9 0 15%, transparent 15.6%)",
    `radial-gradient(circle at 50% 33%, ${hair} 0 23%, transparent 23.6%)`,
    `radial-gradient(ellipse at 50% 110%, ${outfit} 0 46%, transparent 46.5%)`,
    "linear-gradient(135deg, #f4e8d2, #d6a18c)",
  ].join(", ");
  return <div
    className={`relative grid flex-none place-items-center overflow-hidden [&_img]:object-cover ${large ? "aspect-[16/10] w-full rounded-none" : "aspect-square w-11 rounded-full"}`}
    style={{ background }}
    role="img"
    aria-label={`${interviewer.name} profile preview`}
  >
    {interviewer.image_url ? <Image src={interviewer.image_url} alt="" fill sizes={large ? "(max-width: 760px) 100vw, 260px" : "44px"} /> : <span className={`rounded-full bg-[rgba(255,255,255,.84)] text-ink-medium font-extrabold tracking-[.04em] ${large ? "mt-[30%] px-2.5 py-1.5 text-[16px]" : "mt-[24%] px-[5px] py-[3px] text-[9px]"}`}>{initials}</span>}
  </div>;
}

const sceneBaseClass = "relative min-h-40 overflow-hidden border border-[#e8d7ce] bg-[linear-gradient(#f4ead3_0_54%,#b6d1ad_54%_100%)]";

const sceneDecorClass = "before:absolute before:top-8 before:left-[9%] before:h-[49%] before:w-[54%] before:border-[3px] before:border-b-0 before:border-[#775e54] before:bg-[repeating-linear-gradient(90deg,transparent_0_27px,rgba(119,94,84,.75)_28px_31px)] before:content-[''] after:absolute after:right-[10%] after:bottom-[22px] after:h-[54px] after:w-[54px] after:rounded-[50%_50%_42%_42%] after:bg-[#d98a63] after:shadow-[-104px_18px_0_-11px_#dbc86d,-75px_-4px_0_-9px_#d47d68,-40px_23px_0_-12px_#d9a56a] after:content-['']";

export function GardenScene({ target, imageUrl }: { target?: string; imageUrl?: string | null }) {
  const { t } = useI18n();

  if (imageUrl) return <div className={sceneBaseClass} aria-label="Listen and Repeat visual preview"><Image src={imageUrl} alt="" fill sizes="(max-width: 760px) 100vw, 520px" style={{ objectFit: "cover" }} /></div>;
  return <div className={`${sceneBaseClass} ${sceneDecorClass}`} aria-label="Listen and Repeat visual preview"><p className="absolute right-2.5 bottom-[9px] m-0 max-w-40 bg-[rgba(255,255,255,.88)] px-[7px] py-1 text-center text-[#4b3026] text-[10px] font-bold leading-[1.2]">{target || t.examCenter.mediaNeedsMediaLabel}</p></div>;
}

type PillTone = "ready" | "pending" | "failed" | "rejected" | "draft" | "published";

function Pill({ $tone, children }: { $tone: PillTone; children: ReactNode }) {
  const border = $tone === "ready" || $tone === "published" ? "border-[#e8b6a2]" : $tone === "failed" || $tone === "rejected" ? "border-[#eeb6a9]" : "border-[#e6d8d0]";
  const background = $tone === "ready" || $tone === "published" ? "bg-[#fff0eb]" : $tone === "failed" || $tone === "rejected" ? "bg-[#fff1ee]" : $tone === "draft" ? "bg-[#f8eee9]" : "bg-[#faf7f5]";
  const color = $tone === "failed" || $tone === "rejected" ? "text-[#a54432]" : "text-[#7d4733]";
  return <span className={`inline-flex items-center border px-1.5 py-[3px] ${monoFont} text-[9px] font-bold uppercase leading-[1.1] tracking-[.05em] ${border} ${background} ${color}`}>{children}</span>;
}

export function MediaPill({ status, label }: { status: ExamMediaStatus; label?: string }) {
  const { t } = useI18n();
  const tone = status === "ready" ? "ready" : status === "failed" ? "failed" : "pending";
  const defaultLabel = status === "ready" ? t.examCenter.mediaReadyLabel : status === "generating" ? t.examCenter.mediaGeneratingLabel : status === "failed" ? t.examCenter.mediaNeedsAttentionLabel : t.examCenter.mediaNeedsMediaLabel;
  return <Pill $tone={tone}>{label || defaultLabel}</Pill>;
}

export function SetStatusPill({ status }: { status: ExamSetStatus }) {
  const { t } = useI18n();
  const tone = status === "published" ? "published" : status === "draft" ? "draft" : "ready";
  const label = status === "media_ready" ? t.examCenter.statusMediaReady : status === "published" ? t.examCenter.statusPublished : t.examCenter.statusDraft;
  return <Pill $tone={tone}>{label}</Pill>;
}

export function InterviewerStatusPill({ status }: { status: ExamInterviewer["status"] }) {
  const { t } = useI18n();
  const tone = status === "approved" ? "ready" : status === "rejected" ? "rejected" : "pending";
  return <Pill $tone={tone}>{status === "approved" ? t.examCenter.statusActive : status === "pending" ? t.examCenter.statusReview : t.examCenter.statusExcluded}</Pill>;
}
