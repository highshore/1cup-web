"use client";

import Image from "next/image";
import Link from "next/link";
import styled from "styled-components";

import type { ExamInterviewer, ExamMediaStatus, ExamSetStatus } from "../../lib/features/exam/types";
import { useI18n } from "../../lib/i18n/I18nProvider";

const accent = "#f47a4a";

export const ExamPage = styled.main`
  min-height: 100vh;
  background: #fdfcf9;
  color: #2c1810;
  font-family: "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
`;

export const ExamContent = styled.div`
  width: min(1390px, calc(100% - 104px));
  margin: 0 auto;
  padding: 54px 0 80px;

  @media (max-width: 760px) {
    width: min(100% - 32px, 1390px);
    padding: 32px 0 56px;
  }
`;

const Topbar = styled.header`
  display: grid;
  grid-template-columns: minmax(170px, 1fr) auto minmax(170px, 1fr);
  align-items: center;
  min-height: 70px;
  padding: 0 34px;
  border-bottom: 1px solid #1d0d08;
  background: #2c1810;
  color: #fffaf7;

  @media (max-width: 720px) {
    grid-template-columns: 1fr auto;
    min-height: 58px;
    padding: 0 18px;
  }
`;

const Brand = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .09em;
  line-height: 1.14;
  text-decoration: none;

  &:hover { color: #fffaf7; text-decoration: none; }
`;

const BrandMark = styled.span`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 23px;
  height: 23px;

  span { width: 5px; border-radius: 1px; background: ${accent}; }
  span:nth-child(1) { height: 11px; }
  span:nth-child(2) { height: 19px; }
  span:nth-child(3) { height: 15px; }
`;

const TopbarContext = styled.div`
  display: flex;
  align-items: center;
  color: #e8d9d0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  letter-spacing: .09em;
  text-transform: uppercase;

  @media (max-width: 720px) { display: none; }
`;

const LiveDot = styled.span`
  width: 6px;
  height: 6px;
  margin: 0 8px 1px 0;
  border-radius: 999px;
  background: ${accent};
`;

const TopbarDivider = styled.span`
  height: 11px;
  margin: 0 12px;
  border-left: 1px solid #7b594c;
`;

const TopbarAction = styled(Link)`
  justify-self: end;
  border: 1px solid #a57e70;
  padding: 8px 11px;
  color: #fffaf7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .07em;
  text-decoration: none;
  text-transform: uppercase;

  &:hover { border-color: ${accent}; color: #fffaf7; background: #412218; text-decoration: none; }
`;

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

  return <Topbar>
    <Brand href="/admin/test-center" aria-label={t.examCenter.pipelineTitle}>
      <BrandMark aria-hidden="true"><span /><span /><span /></BrandMark>
      <span>1 CUP<br />TEST PIPELINE</span>
    </Brand>
    <TopbarContext><LiveDot />{t.examCenter.workspace}<TopbarDivider />{context}</TopbarContext>
    <TopbarAction href={actionHref}>{actionLabel}</TopbarAction>
  </Topbar>;
}

export const PipelineEyebrow = styled.p`
  margin: 0;
  color: #74645d;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .1em;
  line-height: 1.35;
  text-transform: uppercase;
`;

export const PipelineTitle = styled.h1`
  margin: 10px 0 0;
  color: #2c1810;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(42px, 5vw, 62px);
  font-weight: 500;
  letter-spacing: -.062em;
  line-height: .98;
`;

export const PipelinePeriod = styled.span`
  color: ${accent};
`;

export const PipelineLead = styled.p`
  max-width: 700px;
  margin: 14px 0 0;
  color: #6f625c;
  font-size: 14px;
  line-height: 1.58;
`;

export const Button = styled.button<{ $tone?: "ink" | "cream" | "orange" }>`
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid ${({ $tone = "ink" }) => $tone === "cream" ? "#bbaaa2" : $tone === "orange" ? "#d95f32" : "#2c1810"};
  padding: 9px 13px;
  background: ${({ $tone = "ink" }) => $tone === "cream" ? "#fffdfb" : $tone === "orange" ? accent : "#2c1810"};
  box-shadow: ${({ $tone = "ink" }) => $tone === "cream" ? "none" : "3px 3px 0 #2c1810"};
  color: ${({ $tone = "ink" }) => $tone === "cream" ? "#4b3026" : "#fff"};
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition: transform 130ms ease, background 130ms ease, box-shadow 130ms ease;

  &:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: ${({ $tone = "ink" }) => $tone === "cream" ? "2px 2px 0 #ead8cf" : "4px 4px 0 #2c1810"}; background: ${({ $tone = "ink" }) => $tone === "cream" ? "#fff5ef" : $tone === "orange" ? "#dd6538" : "#43251b"}; }
  &:disabled { cursor: wait; opacity: .56; box-shadow: none; }
  svg { width: 16px; height: 16px; }
`;

export const Notice = styled.div<{ $error?: boolean }>`
  display: flex;
  align-items: center;
  min-height: 36px;
  margin: 20px 0 0;
  border: 1px solid ${({ $error }) => $error ? "#edb8a9" : "#eccfbf"};
  padding: 8px 12px;
  background: ${({ $error }) => $error ? "#fff3ee" : "#fff8f3"};
  color: ${({ $error }) => $error ? "#9f4229" : "#664333"};
  font-size: 12px;
  line-height: 1.5;
`;

export const Loading = styled.div`
  display: grid;
  min-height: 60vh;
  place-items: center;
  color: #7c6a62;
  font-size: 14px;
  font-weight: 650;
`;

const AvatarWrap = styled.div<{ $seed: string; $large?: boolean }>`
  position: relative;
  display: grid;
  width: ${({ $large }) => $large ? "100%" : "44px"};
  aspect-ratio: ${({ $large }) => $large ? "16 / 10" : "1"};
  overflow: hidden;
  flex: 0 0 auto;
  place-items: center;
  border-radius: ${({ $large }) => $large ? "0" : "50%"};
  background:
    radial-gradient(circle at 50% 34%, #f6c9a9 0 15%, transparent 15.6%),
    radial-gradient(circle at 50% 33%, ${({ $seed }) => $seed.includes("elena") || $seed.includes("sofia") ? "#3c2823" : $seed.includes("robert") || $seed.includes("noah") ? "#2c2420" : "#263142"} 0 23%, transparent 23.6%),
    radial-gradient(ellipse at 50% 110%, ${({ $seed }) => $seed.includes("elena") ? "#f5e7ca" : $seed.includes("robert") ? "#383a40" : $seed.includes("david") ? "#141414" : "#d6e7d5"} 0 46%, transparent 46.5%),
    linear-gradient(135deg, #f4e8d2, #d6a18c);

  img { object-fit: cover; }
`;

const AvatarInitials = styled.span<{ $large?: boolean }>`
  margin-top: ${({ $large }) => $large ? "30%" : "24%"};
  border-radius: 999px;
  padding: ${({ $large }) => $large ? "6px 10px" : "3px 5px"};
  background: rgba(255, 255, 255, .84);
  color: #4a2f23;
  font-size: ${({ $large }) => $large ? "16px" : "9px"};
  font-weight: 800;
  letter-spacing: .04em;
`;

export function ExamAvatar({ interviewer, large = false }: { interviewer: Pick<ExamInterviewer, "name" | "avatar_key" | "image_url">; large?: boolean }) {
  const initials = interviewer.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <AvatarWrap $seed={interviewer.avatar_key} $large={large} role="img" aria-label={`${interviewer.name} profile preview`}>
    {interviewer.image_url ? <Image src={interviewer.image_url} alt="" fill sizes={large ? "(max-width: 760px) 100vw, 260px" : "44px"} /> : <AvatarInitials $large={large}>{initials}</AvatarInitials>}
  </AvatarWrap>;
}

const Scene = styled.div<{ $hasImage?: boolean }>`
  position: relative;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid #e8d7ce;
  background: linear-gradient(#f4ead3 0 54%, #b6d1ad 54% 100%);

  &::before {
    display: ${({ $hasImage }) => $hasImage ? "none" : "block"};
    position: absolute;
    top: 32px;
    left: 9%;
    width: 54%;
    height: 49%;
    border: 3px solid #775e54;
    border-bottom: 0;
    background: repeating-linear-gradient(90deg, transparent 0 27px, rgba(119, 94, 84, .75) 28px 31px);
    content: "";
  }

  &::after {
    display: ${({ $hasImage }) => $hasImage ? "none" : "block"};
    position: absolute;
    right: 10%;
    bottom: 22px;
    width: 54px;
    height: 54px;
    border-radius: 50% 50% 42% 42%;
    background: #d98a63;
    box-shadow: -104px 18px 0 -11px #dbc86d, -75px -4px 0 -9px #d47d68, -40px 23px 0 -12px #d9a56a;
    content: "";
  }
`;

const SceneTarget = styled.p`
  position: absolute;
  right: 10px;
  bottom: 9px;
  max-width: 160px;
  margin: 0;
  padding: 4px 7px;
  background: rgba(255, 255, 255, .88);
  color: #4b3026;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
`;

export function GardenScene({ target, imageUrl }: { target?: string; imageUrl?: string | null }) {
  const { t } = useI18n();

  if (imageUrl) return <Scene $hasImage aria-label="Listen and Repeat visual preview"><Image src={imageUrl} alt="" fill sizes="(max-width: 760px) 100vw, 520px" style={{ objectFit: "cover" }} /></Scene>;
  return <Scene aria-label="Listen and Repeat visual preview"><SceneTarget>{target || t.examCenter.mediaNeedsMediaLabel}</SceneTarget></Scene>;
}

const Pill = styled.span<{ $tone: "ready" | "pending" | "failed" | "rejected" | "draft" | "published" }>`
  display: inline-flex;
  align-items: center;
  border: 1px solid ${({ $tone }) => $tone === "ready" || $tone === "published" ? "#e8b6a2" : $tone === "failed" || $tone === "rejected" ? "#eeb6a9" : "#e6d8d0"};
  padding: 3px 6px;
  background: ${({ $tone }) => $tone === "ready" || $tone === "published" ? "#fff0eb" : $tone === "failed" || $tone === "rejected" ? "#fff1ee" : $tone === "draft" ? "#f8eee9" : "#faf7f5"};
  color: ${({ $tone }) => $tone === "failed" || $tone === "rejected" ? "#a54432" : "#7d4733"};
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .05em;
  line-height: 1.1;
  text-transform: uppercase;
`;

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
