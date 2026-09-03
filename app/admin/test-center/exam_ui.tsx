"use client";

import styled from "styled-components";

import type { ExamInterviewer, ExamMediaStatus, ExamSetStatus } from "../../lib/features/exam/types";

export const ExamPage = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 20px 56px;
  color: #050505;

  @media (max-width: 700px) {
    padding: 0 15px 38px;
  }
`;

export const ExamHeader = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: 0 0 26px;
  border-bottom: 2px solid #050505;
  padding: 0 0 18px;

  @media (max-width: 700px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

export const Eyebrow = styled.p`
  margin: 0 0 6px;
  color: #c84932;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

export const PageTitle = styled.h1`
  margin: 0;
  font-size: clamp(28px, 5vw, 44px);
  font-weight: 900;
  letter-spacing: -0.055em;
  line-height: 1;
`;

export const PageLead = styled.p`
  max-width: 650px;
  margin: 10px 0 0;
  color: rgba(5, 5, 5, 0.67);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.62;
`;

export const Button = styled.button<{ $tone?: "ink" | "cream" | "orange" }>`
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 9px 14px;
  background: ${({ $tone = "ink" }) => $tone === "ink" ? "#050505" : $tone === "orange" ? "#f47a4a" : "#fff8dc"};
  color: ${({ $tone = "ink" }) => $tone === "ink" ? "#fff" : "#050505"};
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;
  transition: transform 140ms ease, box-shadow 140ms ease;

  &:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 #050505; }
  &:disabled { cursor: wait; opacity: 0.6; }
  svg { width: 16px; height: 16px; }
`;

export const TextButton = styled.button`
  border: 0;
  padding: 2px 0;
  background: transparent;
  color: #050505;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
`;

export const Notice = styled.p<{ $error?: boolean }>`
  margin: 0 0 18px;
  border-left: 3px solid ${({ $error }) => $error ? "#c84932" : "#f47a4a"};
  padding: 7px 0 7px 10px;
  color: ${({ $error }) => $error ? "#9b2e1e" : "rgba(5, 5, 5, 0.7)"};
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
`;

export const Card = styled.article`
  border: 2px solid #050505;
  border-radius: 14px;
  background: #fff;
  box-shadow: 4px 4px 0 #050505;
`;

export const Loading = styled.div`
  display: grid;
  min-height: 300px;
  place-items: center;
  color: rgba(5, 5, 5, 0.65);
  font-size: 14px;
  font-weight: 800;
`;

const AvatarWrap = styled.div<{ $seed: string; $large?: boolean }>`
  display: grid;
  width: ${({ $large }) => $large ? "100%" : "52px"};
  aspect-ratio: ${({ $large }) => $large ? "16 / 10" : "1"};
  overflow: hidden;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid #050505;
  border-radius: ${({ $large }) => $large ? "10px" : "50%"};
  background:
    radial-gradient(circle at 50% 34%, #f6c9a9 0 15%, transparent 15.6%),
    radial-gradient(circle at 50% 33%, ${({ $seed }) => $seed.includes("elena") || $seed.includes("sofia") ? "#3c2823" : $seed.includes("robert") || $seed.includes("noah") ? "#2c2420" : "#263142"} 0 23%, transparent 23.6%),
    radial-gradient(ellipse at 50% 110%, ${({ $seed }) => $seed.includes("elena") ? "#f5e7ca" : $seed.includes("robert") ? "#383a40" : $seed.includes("david") ? "#141414" : "#d6e7d5"} 0 46%, transparent 46.5%),
    linear-gradient(135deg, #ffeab0, #f47a4a);
  box-shadow: inset 0 -18px 30px rgba(5, 5, 5, 0.08);
`;

const AvatarInitials = styled.span<{ $large?: boolean }>`
  margin-top: ${({ $large }) => $large ? "30%" : "24%"};
  border-radius: 999px;
  padding: ${({ $large }) => $large ? "6px 10px" : "3px 5px"};
  background: rgba(255, 255, 255, 0.78);
  color: #050505;
  font-size: ${({ $large }) => $large ? "16px" : "9px"};
  font-weight: 900;
  letter-spacing: 0.04em;
`;

export function ExamAvatar({ interviewer, large = false }: { interviewer: Pick<ExamInterviewer, "name" | "avatar_key">; large?: boolean }) {
  const initials = interviewer.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <AvatarWrap $seed={interviewer.avatar_key} $large={large} role="img" aria-label={`${interviewer.name} profile preview`}><AvatarInitials $large={large}>{initials}</AvatarInitials></AvatarWrap>;
}

const Scene = styled.div<{ $target?: string }>`
  position: relative;
  min-height: 195px;
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 12px;
  background: linear-gradient(#ffe9a5 0 54%, #88ba77 54% 100%);

  &::before {
    position: absolute;
    top: 32px;
    left: 9%;
    width: 54%;
    height: 49%;
    border: 5px solid #050505;
    border-bottom: 0;
    background: repeating-linear-gradient(90deg, transparent 0 27px, rgba(5,5,5,.8) 28px 31px);
    content: "";
  }

  &::after {
    position: absolute;
    right: 10%;
    bottom: 26px;
    width: 58px;
    height: 58px;
    border: 4px solid #050505;
    border-radius: 50% 50% 42% 42%;
    background: #f47a4a;
    box-shadow: -114px 18px 0 -11px #ebcd4e, -84px -4px 0 -9px #e75d43, -46px 23px 0 -12px #e99a35;
    content: "";
  }
`;

const SceneTarget = styled.p`
  position: absolute;
  z-index: 1;
  right: 12px;
  bottom: 11px;
  max-width: 160px;
  margin: 0;
  border: 1px solid #050505;
  border-radius: 999px;
  padding: 4px 8px;
  background: #fff;
  color: #050505;
  font-size: 10px;
  font-weight: 850;
  line-height: 1.15;
  text-align: center;
`;

export function GardenScene({ target }: { target?: string }) {
  return <Scene $target={target} aria-label="Community garden visual preview"><SceneTarget>{target || "Community garden scene"}</SceneTarget></Scene>;
}

const Pill = styled.span<{ $tone: "ready" | "pending" | "rejected" | "draft" | "published" }>`
  display: inline-flex;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 4px 7px;
  background: ${({ $tone }) => $tone === "ready" || $tone === "published" ? "#ccebc5" : $tone === "rejected" ? "#f7cac1" : $tone === "draft" ? "#fff0b9" : "#fff"};
  color: #050505;
  font-size: 10px;
  font-weight: 850;
  line-height: 1;
`;

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
