"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styled, { createGlobalStyle, css, keyframes } from "styled-components";
import { colors } from "../lib/constants/colors";
import React from "react";
import Image from "next/image";
// GNB and Footer are now handled by the layout

// Imports for Meetup Event Display
import { useRouter } from "next/navigation";
import { MeetupEvent } from "../lib/features/meetup/types/meetup_types";
import { fetchUpcomingMeetupEvents } from "../lib/features/meetup/services/meetup_service";
import { fetchUserProfiles, UserProfile } from "../lib/features/meetup/services/user_service";
import {
  formatEventDateTime,
  formatEventTitleWithCountdown,
  isEventLocked,
} from "../lib/features/meetup/utils/meetup_helpers";
import { PinIcon, CalendarIcon } from "../lib/features/meetup/components/meetup_icons";
import { UserAvatarStack } from "../lib/features/meetup/components/user_avatar";
import StatsSection from "../lib/features/home/components/StatsSection";
import { HomeStats } from "../lib/features/home/services/stats_service";
import TopicsShowcase from "../lib/features/home/components/TopicsShowcase";
import { HomeTopicArticle } from "../lib/features/home/services/topics_service";
import {
  CheckCircleIcon,
  PhotoIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UsersIcon,
  MapPinIcon,
  CalendarIcon as CalendarIconOutline,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db as clientDb } from "../lib/firebase/firebase";
import MembershipSection from "./sections/MembershipSection";
import FaqSection from "./sections/FaqSection";
import CtaSection from "./sections/CtaSection";
import { useI18n } from "../lib/i18n/I18nProvider";

const GlobalStyle = createGlobalStyle<{ $machineMode: boolean }>`
  ${({ $machineMode }) =>
    $machineMode &&
    css`
      html,
      body {
        background: #000000 !important;
      }

      body nav,
      body footer {
        display: none !important;
      }
    `}

  body[data-home-image-guard="true"] img {
    -webkit-user-drag: none;
    user-select: none;
  }
`;

// Use shared colors

const MOBILE_NAV_GUTTER = "1rem";
const SUPPORT_URL = "https://pf.kakao.com/_DxlPIn/chat";
const JOB_CELEBRATION_STORAGE_KEY = "one-cup-sk-hynix-celebration-dismissed";

const MEMBER_COMPANY_LOGOS = [
  { label: "SK하이닉스", src: "/assets/homepage/logos/sk-hynix.webp", width: 260, height: 129, scale: 1.04 },
  { label: "쿠팡", src: "/assets/homepage/logos/coupang.webp", width: 320, height: 73, scale: 1.02 },
  { label: "SAP", src: "/assets/homepage/logos/sap.webp", width: 220, height: 109, scale: 0.94 },
  { label: "네슬레", src: "/assets/homepage/logos/nestle.webp", width: 165, height: 170, scale: 0.92 },
  { label: "고려대학교", src: "/assets/homepage/logos/korea-university.webp", width: 280, height: 93, scale: 1 },
  { label: "연세대학교 MBA", src: "/assets/homepage/logos/yonsei-university.webp", width: 280, height: 86, scale: 1 },
] as const;

const MEMBER_LOGO_GRID_LIMIT = 8;

type LeaderLocation = "anam" | "yeouido";
const LEADER_LOCATIONS: LeaderLocation[] = ["anam", "yeouido"];

const COMMUNITY_LEADERS = [
  {
    id: "sj",
    locations: ["yeouido"],
    name: "SJ",
    initials: "SJ",
    accent: "#f47a4a",
    imageSrc: "",
    linkedinUrl: "",
  },
  {
    id: "kyle",
    locations: ["anam", "yeouido"],
    name: "Kyle",
    initials: "K",
    accent: "#f47a4a",
    imageSrc: "/assets/homepage/member1.webp",
    linkedinUrl: "https://www.linkedin.com/in/sk-kyle-kim/",
  },
  {
    id: "joey",
    locations: ["anam", "yeouido"],
    name: "Joey",
    initials: "J",
    accent: "#800021",
    imageSrc: "/assets/homepage/joey.webp",
    linkedinUrl: "https://www.linkedin.com/in/sooojo/",
  },
  {
    id: "ey",
    locations: ["anam"],
    name: "EY",
    initials: "EY",
    accent: "#f47a4a",
    imageSrc: "",
    linkedinUrl: "",
  },
  {
    id: "jc",
    locations: ["anam"],
    name: "JC",
    initials: "JC",
    accent: "#a6c9d8",
    imageSrc: "",
    linkedinUrl: "",
  },
  {
    id: "ab",
    locations: ["anam"],
    name: "AB",
    initials: "AB",
    accent: "#800021",
    imageSrc: "",
    linkedinUrl: "",
  },
] as const;

const DISCUSSION_SEATS = [
  { id: "lead", top: "19%", left: "50%", accent: "#5a321f", delay: "0s", leader: true },
  { id: "member-a", top: "48%", left: "79%", accent: "#ef8a42", delay: "0.35s", leader: false },
  { id: "member-b", top: "81%", left: "68%", accent: "#a79880", delay: "0.7s", leader: false },
  { id: "member-c", top: "81%", left: "32%", accent: "#d6b995", delay: "1.05s", leader: false },
  { id: "member-d", top: "48%", left: "21%", accent: "#83906f", delay: "1.4s", leader: false },
] as const;

const NETWORKING_IMAGES = [
  { id: "member", src: "/assets/homepage/gallery1.webp", width: 900, height: 902, altKey: "member" },
  { id: "gallery-two", src: "/assets/homepage/gallery2.webp", width: 1100, height: 825, altKey: "galleryTwo" },
  { id: "gallery-three", src: "/assets/homepage/gallery3.webp", width: 1100, height: 825, altKey: "galleryThree", rotate: 90 },
  { id: "activity", src: "/assets/homepage/activity.webp", width: 768, height: 1024, altKey: "activity", objectPosition: "center 72%" },
] as const;

// Common section styles
const SectionBase = css`
  min-height: 450px;
  padding: 5rem 2rem;
  position: relative;
  overflow: hidden;
  margin-bottom: 0;

  @media (max-width: 768px) {
    padding: 3rem ${MOBILE_NAV_GUTTER};
    text-align: center;
  }
`;

// Hero Section
const HeroSection = styled.section`
  color: white;
  padding: clamp(6rem, 5vw, 7.5rem) 0; /* Reduced vertical padding */
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;

  video {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: translate(-50%, -50%);
    z-index: 0;
  }

  @media (max-width: 768px) {
    min-height: 100svh;
    padding: 0;
    display: flex;
  }
`;

const MainContent = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  background: #ffffff;
  isolation: isolate;
`;

const MemberBackgroundSection = styled.section`
  width: 100%;
  background: #111111;
  color: #ffffff;
  padding: clamp(3.5rem, 7vw, 5rem) 0 clamp(4rem, 8vw, 6rem);
`;

const MemberBackgroundHeader = styled.div`
  max-width: 48rem;
  margin-bottom: 3rem;

  @media (max-width: 768px) {
    margin: 0 auto 2.5rem;
    text-align: center;
  }
`;

const MemberBackgroundTitle = styled.h2`
  margin: 0;
  color: #ffffff;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: 0;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const MemberBackgroundTitleAccent = styled.span`
  color: #f47a4a;
`;

const MemberBackgroundLayout = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const MemberLogoViewport = styled.div`
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.8rem;

  @media (max-width: 520px) {
    padding: 0.5rem;
    border-radius: 18px;
  }
`;

const MemberLogoTrack = styled.div<{ $columns: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  gap: 0.8rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 520px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
`;

const MemberLogoTile = styled.div`
  display: flex;
  min-height: 116px;
  flex-direction: column;
  gap: 0.85rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: #ffffff;
  padding: 1.1rem 1rem 1rem;

  span {
    color: #222222;
    font-size: 0.78rem;
    font-weight: 760;
    line-height: 1.2;
    text-align: center;
  }

  @media (max-width: 768px) {
    min-height: 100px;
    gap: 0.7rem;
    padding: 0.9rem 0.75rem 0.8rem;
    border-radius: 12px;

    span {
      font-size: 0.72rem;
    }
  }
`;

const MemberLogoOverflow = styled.div`
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const MemberLogoOverflowTile = styled.div`
  display: inline-flex;
  min-height: 48px;
  min-width: 0;
  justify-content: center;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  padding: 0.45rem 0.7rem;

  img {
    display: block;
    width: auto;
    height: 22px;
    max-width: 72px;
    object-fit: contain;
  }

  span {
    color: #222222;
    font-size: 0.72rem;
    font-weight: 760;
    line-height: 1.2;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    min-height: 42px;
    padding: 0.4rem 0.58rem;

    img {
      height: 19px;
      max-width: 64px;
    }

    span {
      font-size: 0.68rem;
    }
  }
`;

const MemberLogoMark = styled.div<{ $scale: number }>`
  display: grid;
  width: 100%;
  height: 42px;
  place-items: center;
  overflow: hidden;

  img {
    display: block;
    width: auto;
    height: 34px;
    max-width: 132px;
    object-fit: contain;
    object-position: center;
    transform: scale(${({ $scale }) => $scale});
    transform-origin: center;
  }

  @media (max-width: 768px) {
    height: 34px;

    img {
      height: 28px;
      max-width: 112px;
    }
  }
`;

const MethodFlowWrapper = styled.div`
  position: relative;
  overflow: hidden;
  background: #f3f3f1;
  isolation: isolate;

  &::before {
    position: absolute;
    inset: 0;
    z-index: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0) 18%),
      radial-gradient(circle at 76% 18%, rgba(244, 122, 74, 0.06), transparent 24rem),
      radial-gradient(circle at 16% 62%, rgba(5, 5, 5, 0.045), transparent 28rem);
    content: "";
  }
`;

const MethodFlowRoute = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;

  svg {
    position: absolute;
    top: clamp(3rem, 5vw, 4.4rem);
    left: 50%;
    width: min(1120px, calc(100% - 2rem));
    height: calc(100% - clamp(6rem, 10vw, 8rem));
    overflow: visible;
    transform: translateX(-50%);
  }

  .mobile-route {
    display: none;
  }

  .route-shadow {
    fill: none;
    stroke: rgba(244, 122, 74, 0.11);
    stroke-width: 8;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 8px rgba(244, 122, 74, 0.11));
    vector-effect: non-scaling-stroke;
  }

  .route-line {
    fill: none;
    stroke: rgba(244, 122, 74, 0.28);
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 12 14;
    filter: drop-shadow(0 0 5px rgba(244, 122, 74, 0.13));
    vector-effect: non-scaling-stroke;
  }

  .route-anchor {
    display: none;
  }

  .route-anchor-core {
    display: none;
  }

  @media (max-width: 820px) {
    svg {
      top: 2.25rem;
      width: calc(100% - 1.5rem);
      height: calc(100% - 4rem);
    }

    .desktop-route {
      display: none;
    }

    .mobile-route {
      display: block;
    }

    .route-shadow {
      stroke-width: 7;
    }

    .route-line {
      stroke-width: 1.65;
      stroke-dasharray: 10 12;
    }
  }
`;

const TopicVideoSection = styled.section`
  position: relative;
  z-index: 1;
  width: 100%;
  color: #0f172a;
  padding: clamp(4rem, 7vw, 5.5rem) 0;
`;

const TopicVideoLayout = styled.div`
  position: relative;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: clamp(2rem, 5vw, 3.5rem);
  align-items: center;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    padding: 0 ${MOBILE_NAV_GUTTER};
    text-align: center;
  }
`;

const TopicVideoCopy = styled.div`
  max-width: 28rem;

  @media (max-width: 820px) {
    max-width: 100%;
  }
`;

const TopicVideoSectionTitle = styled.p`
  display: inline-flex;
  max-width: min(100%, 18rem);
  align-items: center;
  justify-content: center;
  margin: 0 0 0.85rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.34rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1.25;
  text-align: center;
  white-space: normal;
  word-break: keep-all;

  @media (max-width: 768px) {
    max-width: 100%;
  }
`;

const TopicVideoTitle = styled.h2`
  margin: 0;
  color: #0f172a;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
  white-space: pre-line;
  word-break: keep-all;
`;

const TopicVideoDescription = styled.p`
  margin: 1.2rem 0 0;
  color: #475569;
  font-size: clamp(0.98rem, 1.5vw, 1.08rem);
  font-weight: 560;
  line-height: 1.65;
  white-space: pre-line;
  word-break: keep-all;
`;

const TopicVideoCaveat = styled.p`
  margin: 0.75rem 0 0;
  color: rgba(100, 116, 139, 0.66);
  font-size: 0.76rem;
  font-weight: 520;
  line-height: 1.55;
  word-break: keep-all;
`;

const TopicVideoFrameGroup = styled.div`
  min-width: 0;
`;

const TopicVideoFrame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #0f172a;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.88);

  iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  @media (max-width: 768px) {
    border-radius: 14px;
  }
`;

const TopicVideoCaption = styled.div`
  margin-top: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  color: #334155;
  font-size: 0.84rem;
  font-weight: 760;
  text-align: right;

  @media (max-width: 768px) {
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 0.35rem;
    text-align: center;
  }
`;

const LeaderMethodSection = styled.section`
  position: relative;
  z-index: 1;
  width: 100%;
  color: #0f172a;
  padding: 0 0 clamp(4.5rem, 8vw, 6rem);
  overflow: hidden;
`;

const LeaderMethodLayout = styled.div`
  position: relative;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const LeaderMethodHeader = styled.div`
  display: grid;
  justify-items: end;
  margin-bottom: clamp(2rem, 5vw, 3rem);
  text-align: right;

  @media (max-width: 820px) {
    justify-items: center;
    text-align: center;
  }
`;

const LeaderMethodSectionTitle = styled.p`
  display: inline-flex;
  max-width: min(100%, 18rem);
  align-items: center;
  justify-content: center;
  margin: 0 0 0.85rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.34rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1.25;
  text-align: center;
  white-space: normal;
  word-break: keep-all;
`;

const LeaderMethodTitle = styled.h2`
  max-width: 35rem;
  margin: 0;
  color: #0f172a;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
  white-space: pre-line;
  word-break: keep-all;

  @media (max-width: 820px) {
    max-width: 100%;
    text-align: center;
  }
`;

const LeaderMethodContent = styled.div`
  display: grid;
  grid-template-columns: minmax(280px, 0.86fr) minmax(0, 1.14fr);
  gap: clamp(1.25rem, 4vw, 2rem);
  align-items: center;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const LeaderDiagramPanel = styled.div<{ $location: LeaderLocation }>`
  position: relative;
  width: min(100%, 420px, 72vw);
  aspect-ratio: 1 / 1;
  justify-self: center;
  align-self: center;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;

  &::before {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 50%;
    width: 78%;
    height: 78%;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 47% 53% 49% 51% / 56% 55% 45% 44%;
    background:
      radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.36), transparent 28%),
      linear-gradient(135deg, rgba(255, 246, 232, 0.98), rgba(245, 213, 174, 0.78));
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.64),
      0 18px 44px rgba(58, 33, 17, 0.08);
    transform: translate(-50%, -50%);
    content: "";
  }

  &::after {
    position: absolute;
    z-index: 0;
    right: 5%;
    bottom: 8%;
    left: 5%;
    height: 42%;
    border-radius: 0 0 26% 26%;
    background: ${({ $location }) =>
      $location === "anam"
        ? `
          linear-gradient(90deg, transparent 0 6%, rgba(128, 0, 33, 0.12) 6% 8%, transparent 8% 12%),
          linear-gradient(90deg, transparent 0 16%, rgba(128, 0, 33, 0.12) 16% 19%, transparent 19% 24%),
          linear-gradient(90deg, transparent 0 30%, rgba(128, 0, 33, 0.11) 30% 33%, transparent 33% 38%),
          linear-gradient(90deg, transparent 0 46%, rgba(128, 0, 33, 0.12) 46% 50%, transparent 50% 56%),
          linear-gradient(90deg, transparent 0 64%, rgba(128, 0, 33, 0.11) 64% 67%, transparent 67% 72%),
          linear-gradient(90deg, transparent 0 82%, rgba(128, 0, 33, 0.12) 82% 85%, transparent 85% 100%),
          linear-gradient(to top, rgba(128, 0, 33, 0.11), rgba(128, 0, 33, 0.03) 58%, transparent 59%)
        `
        : `
          linear-gradient(90deg, transparent 0 8%, rgba(15, 23, 42, 0.11) 8% 13%, transparent 13% 18%),
          linear-gradient(90deg, transparent 0 23%, rgba(15, 23, 42, 0.1) 23% 27%, transparent 27% 34%),
          linear-gradient(90deg, transparent 0 42%, rgba(15, 23, 42, 0.12) 42% 47%, transparent 47% 54%),
          linear-gradient(90deg, transparent 0 60%, rgba(15, 23, 42, 0.1) 60% 64%, transparent 64% 70%),
          linear-gradient(90deg, transparent 0 78%, rgba(15, 23, 42, 0.11) 78% 84%, transparent 84% 100%),
          linear-gradient(to top, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.03) 58%, transparent 59%)
        `};
    opacity: 0.9;
    filter: blur(0.2px);
    content: "";
  }
`;

const leaderChatPulse = keyframes`
  0%, 44%, 100% {
    opacity: 0.36;
    transform: translate(-50%, -50%) translateY(0) scale(0.96);
  }
  12%, 30% {
    opacity: 1;
    transform: translate(-50%, -50%) translateY(-4px) scale(1);
  }
`;

const LeaderDiagramTable = styled.div`
  position: absolute;
  top: 51%;
  left: 50%;
  z-index: 4;
  width: 17%;
  aspect-ratio: 1.16 / 1;
  border-radius: 0.2rem 0.18rem 42% 42%;
  background: #4b2a1b;
  transform: translate(-50%, -50%);
  box-shadow: 0 8px 16px rgba(58, 33, 17, 0.13);

  &::before {
    position: absolute;
    top: 18%;
    right: -34%;
    width: 38%;
    height: 50%;
    border: 0.3rem solid #4b2a1b;
    border-left: 0;
    border-radius: 0 999px 999px 0;
    background: transparent;
    content: "";
  }

  &::after {
    position: absolute;
    right: 10%;
    bottom: -9%;
    left: 10%;
    height: 12%;
    border-radius: 999px;
    background: #4b2a1b;
    content: "";
  }
`;

const LeaderDiagramSeat = styled.div<{
  $top: string;
  $left: string;
  $accent: string;
  $delay: string;
  $leader: boolean;
}>`
  position: absolute;
  top: ${({ $top }) => $top};
  left: ${({ $left }) => $left};
  z-index: ${({ $leader }) => ($leader ? 5 : 4)};
  width: ${({ $leader }) => ($leader ? "clamp(4.55rem, 8.6vw, 5.35rem)" : "clamp(3.65rem, 7vw, 4.35rem)")};
  aspect-ratio: 1;
  border: 5px solid #ffffff;
  border-radius: 999px;
  background:
    radial-gradient(circle at 38% 28%, rgba(255, 255, 255, 0.26), transparent 26%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(5, 5, 5, 0.12)),
    ${({ $accent }) => $accent};
  opacity: 1;
  box-shadow: 0 11px 26px rgba(58, 33, 17, 0.16);
  transform: translate(-50%, -50%);

  &::before {
    position: absolute;
    inset: -0.34rem;
    border: 1px solid rgba(58, 33, 17, 0.08);
    border-radius: inherit;
    content: "";
  }

  &::after {
    ${({ $leader }) =>
      $leader
        ? css`
            position: absolute;
            top: -1.45rem;
            left: 50%;
            width: 0.32rem;
            height: 0.9rem;
            border-radius: 999px;
            background: #8a5a36;
            box-shadow:
              -1rem 0.28rem 0 #8a5a36,
              1rem 0.28rem 0 #8a5a36;
            transform: translateX(-50%);
            content: "";
          `
        : css`
            display: none;
          `}
  }
`;

const LeaderChatBubble = styled.div<{
  $top: string;
  $left: string;
  $leader?: boolean;
  $delay: string;
}>`
  position: absolute;
  top: ${({ $top }) => $top};
  left: ${({ $left }) => $left};
  z-index: 3;
  display: flex;
  gap: 0.28rem;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  box-shadow: none;
  animation: ${leaderChatPulse} 4.8s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};
  transform: translate(-50%, -50%);
  pointer-events: none;

  span {
    width: ${({ $leader }) => ($leader ? "0.34rem" : "0.31rem")};
    height: ${({ $leader }) => ($leader ? "0.34rem" : "0.31rem")};
    border-radius: 999px;
    background: ${({ $leader }) => ($leader ? "#8a5a36" : "#4b2a1b")};
    box-shadow: 0 1px 3px rgba(58, 33, 17, 0.16);
  }
`;

const LeaderAccordionColumn = styled.div`
  display: grid;
  align-content: start;
  gap: 1rem;
`;

const LeaderLocationTabs = styled.div`
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(88px, 1fr));
  gap: 0.35rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.35rem;
  box-shadow: 3px 3px 0 #f47a4a;

  @media (max-width: 820px) {
    justify-self: center;
  }
`;

const LeaderLocationButton = styled.button<{ $active: boolean }>`
  min-height: 36px;
  border: 0;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? "#050505" : "transparent")};
  color: ${({ $active }) => ($active ? "#ffffff" : "#475569")};
  padding: 0.42rem 0.95rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease, transform 180ms ease;

  &:hover {
    color: ${({ $active }) => ($active ? "#ffffff" : "#0f172a")};
    transform: translateY(-1px);
  }
`;

const LeaderAccordionList = styled.div`
  display: grid;
  gap: 0.75rem;
`;

const LeaderAccordionItem = styled.article<{ $active: boolean; $accent: string }>`
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: ${({ $active }) =>
    $active ? "5px 5px 0 #f47a4a" : "3px 3px 0 rgba(5, 5, 5, 0.82)"};
  transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
`;

const LeaderAccordionButton = styled.button`
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.95rem 1rem;
  color: #0f172a;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid #f47a4a;
    outline-offset: -4px;
  }
`;

const LeaderAccordionSummary = styled.span`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: center;
`;

const LeaderAccordionInitial = styled.span<{ $accent: string }>`
  display: grid;
  width: 3.15rem;
  height: 3.15rem;
  place-items: center;
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 999px;
  background: ${({ $accent }) => $accent};
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 950;
  line-height: 1;
  box-shadow: 2px 2px 0 rgba(5, 5, 5, 0.9);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const LeaderAccordionName = styled.strong`
  display: block;
  color: #050505;
  font-size: 1rem;
  font-weight: 920;
  line-height: 1.22;

  span {
    color: rgba(5, 5, 5, 0.58);
    font-weight: 760;
  }
`;

const LeaderAccordionIcon = styled.span<{ $active: boolean }>`
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  place-items: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: #f3f3f1;
  color: #050505;
  font-size: 1.3rem;
  font-weight: 500;

  &::before {
    content: "${({ $active }) => ($active ? "−" : "+")}";
  }
`;

const LeaderAccordionPanel = styled.div<{ $active: boolean }>`
  display: grid;
  grid-template-rows: ${({ $active }) => ($active ? "1fr" : "0fr")};
  opacity: ${({ $active }) => ($active ? 1 : 0)};
  transition: grid-template-rows 240ms ease, opacity 180ms ease;
`;

const LeaderAccordionPanelInner = styled.div`
  min-height: 0;
  overflow: hidden;
`;

const LeaderAccordionContent = styled.div`
  padding: 0 1rem 1rem 5rem;

  @media (max-width: 520px) {
    padding-left: 1rem;
  }
`;

const LeaderLinkedInButton = styled.a<{ $disabled: boolean }>`
  margin-top: 0.95rem;
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px solid ${({ $disabled }) => ($disabled ? "rgba(15, 23, 42, 0.12)" : "#050505")};
  border-radius: 999px;
  background: ${({ $disabled }) =>
    $disabled ? "rgba(15, 23, 42, 0.04)" : "#0a66c2"};
  color: ${({ $disabled }) => ($disabled ? "#94a3b8" : "#ffffff")};
  padding: 0.5rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 880;
  text-decoration: none;
  pointer-events: ${({ $disabled }) => ($disabled ? "none" : "auto")};
  box-shadow: ${({ $disabled }) => ($disabled ? "none" : "3px 3px 0 #050505")};
  transition: background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;

  &:hover {
    background: ${({ $disabled }) =>
      $disabled ? "rgba(15, 23, 42, 0.04)" : "#004182"};
    color: ${({ $disabled }) => ($disabled ? "#94a3b8" : "#ffffff")};
    text-decoration: none;
    transform: ${({ $disabled }) => ($disabled ? "none" : "translate(-1px, -1px)")};
    box-shadow: ${({ $disabled }) => ($disabled ? "none" : "4px 4px 0 #050505")};
  }

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const LeaderEmptyState = styled.div`
  display: grid;
  min-height: 250px;
  place-items: center;
  border: 1px dashed rgba(15, 23, 42, 0.18);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.58);
  padding: 2rem;
  color: #64748b;
  text-align: center;
  font-weight: 720;
  line-height: 1.55;
`;

const LeaderStatList = styled.div`
  margin: 0;
  padding: 0;
`;

const LeaderCredentialList = styled.ul`
  display: grid;
  gap: 0.46rem;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const LeaderCredentialItem = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.48rem;
  align-items: start;
  color: rgba(5, 5, 5, 0.74);
  font-size: 0.86rem;
  font-weight: 720;
  line-height: 1.48;
  word-break: keep-all;
`;

const LeaderStatEmoji = styled.span`
  display: inline-flex;
  width: 1.25rem;
  justify-content: center;
`;

const LeaderReadingStyle = styled.div`
  margin-top: 0.9rem;
  border: 1px solid rgba(5, 5, 5, 0.12);
  border-radius: 10px;
  background: #f3f3f1;
  padding: 0.78rem 0.85rem;
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.84rem;
  font-weight: 680;
  line-height: 1.55;
  word-break: keep-all;

  strong {
    display: block;
    margin-bottom: 0.35rem;
    color: #050505;
    font-size: 0.74rem;
    font-weight: 920;
    letter-spacing: 0.04em;
  }
`;

const getLeaderBulletEmoji = (icon: string) => {
  if (icon === "work") {
    return "💼";
  }

  if (icon === "military") {
    return "🪖";
  }

  if (icon === "school") {
    return "🎓";
  }

  return "🇬🇧";
};

const NetworkingMethodSection = styled.section`
  position: relative;
  z-index: 1;
  width: 100%;
  color: #0f172a;
  padding: 0 0 clamp(2rem, 4vw, 3rem);
  overflow: hidden;
`;

const NetworkingMethodLayout = styled.div`
  position: relative;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const NetworkingMethodHeader = styled.div`
  max-width: 44rem;
  margin: 0 0 clamp(1.5rem, 4vw, 2.4rem);

  @media (max-width: 768px) {
    margin-right: auto;
    margin-left: auto;
    text-align: center;
  }
`;

const NetworkingMethodSectionTitle = styled.p`
  display: inline-flex;
  max-width: min(100%, 18rem);
  align-items: center;
  justify-content: center;
  margin: 0 0 0.85rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.34rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1.25;
  text-align: center;
  white-space: normal;
  word-break: keep-all;

  @media (max-width: 768px) {
    max-width: 100%;
  }
`;

const NetworkingMethodTitle = styled.h2`
  margin: 0;
  color: #0f172a;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
  white-space: pre-line;
  word-break: keep-all;
`;

const NetworkingMethodDescription = styled.p`
  max-width: 32rem;
  margin: 1rem 0 0;
  color: #64748b;
  font-size: 0.98rem;
  font-weight: 620;
  line-height: 1.65;
  word-break: keep-all;

  @media (max-width: 768px) {
    margin-right: auto;
    margin-left: auto;
    text-align: center;
  }
`;

const NetworkingGallery = styled.div`
  display: flex;
  max-width: 100%;
  gap: clamp(0.85rem, 2vw, 1.1rem);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 0 1rem;
  scroll-padding: 0;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
  scrollbar-color: rgba(15, 23, 42, 0.28) transparent;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.24);
  }
`;

const NetworkingImageCard = styled.figure<{ $objectPosition?: string; $rotate?: number }>`
  flex: 0 0 min(78vw, 420px);
  aspect-ratio: 4 / 3;
  margin: 0;
  overflow: hidden;
  border-radius: 14px;
  background: #ffffff;
  scroll-snap-align: start;
  box-shadow: 0 18px 52px rgba(15, 23, 42, 0.08);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: ${({ $objectPosition }) => $objectPosition ?? "center center"};
    transform: ${({ $rotate }) => ($rotate ? `rotate(${$rotate}deg) scale(1.34)` : "none")};
    transform-origin: center;
  }

  @media (max-width: 760px) {
    flex-basis: min(84vw, 340px);
    border-radius: 12px;
  }
`;


// New styled component for the video overlay
const VideoOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(4, 4, 20, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1;
`;

// Common style utilities
const breakpoints = {
  mobile: "768px",
};

const MobileBreak = styled.br`
  display: none;
  @media (max-width: ${breakpoints.mobile}) {
    display: block;
  }
`;

interface MemberProfile {
  id: string;
  label: string;
  bio: string;
  highlights: string[];
  linkedInUrl?: string;
  image?: string;
  background: string;
  accent: string;
  accentSoft: string;
  initials: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface PricingBenefit {
  title: string;
  description: string;
}

// --- New Membership Section Styles ---
const MembershipSectionContainer = styled.div`
  padding: 5rem 0;
  background: #0f172a;
  position: relative;
  overflow: hidden;
  color: white;
`;

const MembershipWrapper = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.25rem; /* 20px padding on left/right always */

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const MembershipGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  
  @media (min-width: 768px) {
    grid-template-columns: 1.1fr 0.9fr;
    align-items: center;
    gap: 4rem;
  }
`;

const LeftCol = styled.div`
  color: white;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
  z-index: 1;
`;

const RightCol = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  position: relative;
  z-index: 1;
  overflow: visible;

  @media (max-width: 768px) {
    margin-top: 1.5rem;
    align-items: center;
  }
`;

const CtaButton = styled.button`
  background: rgb(128, 0, 33);
  color: white;
  font-weight: 700;
  padding: 1rem 2.5rem;
  border-radius: 9999px;
  transition: all 0.2s;
  box-shadow: 0 10px 15px -3px rgba(128, 0, 33, 0.3);
  width: max-content;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;

  &:hover {
    background: rgb(150, 0, 40);
    transform: translateY(-2px);
    box-shadow: 0 15px 20px -3px rgba(128, 0, 33, 0.4);
  }
`;

const BulletList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const BulletItem = styled.p`
  font-size: 1.05rem;
  color: #ffb7c5;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.9rem;
  font-weight: 600;
  color: #9ca3af;
`;

const CostBarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const CostItem = styled.div<{ $delay: number }>`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  opacity: 0;
  transform: translateY(10px);
  animation: ${fadeInUp} 0.45s ease forwards;
  animation-delay: ${({ $delay }) => `${$delay}s`};
`;

const CostLabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #e5e7eb;
  font-weight: 500;
`;

const CostBarWrapper = styled.div`
  width: 100%;
  height: 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
`;

const growBar = keyframes`
  from { width: 0; }
  to { width: var(--target-width, 100%); }
`;

const shimmer = keyframes`
  0% { transform: translateX(-120%); opacity: 0; }
  30% { opacity: 0.8; }
  100% { transform: translateX(120%); opacity: 0; }
`;

const CostBar = styled.div<{ $color: string }>`
  position: relative;
  height: 100%;
  width: 0;
  background: ${props => props.$color};
  border-radius: 9999px;
  animation: ${growBar} 1.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--delay, 0s);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.18);
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 45%, rgba(255,255,255,0) 80%);
    transform: translateX(-120%);
    animation: ${shimmer} 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    animation-delay: calc(var(--delay, 0s) + 0.2s);
  }
`;

const CostValue = styled.span<{ $highlight?: boolean }>`
  color: ${props => props.$highlight ? 'rgb(255, 100, 130)' : '#9ca3af'};
  font-weight: ${props => props.$highlight ? '700' : '400'};
  font-size: 0.85rem;
`;

const ChartGridOverlay = styled.div`
  position: absolute;
  inset: 0;
  background-image: linear-gradient(0deg, rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 100% 28px, 48px 100%;
  opacity: 0.5;
  pointer-events: none;
`;

const floatOrb = keyframes`
  0% { transform: translate3d(0, 0, 0); opacity: 0.45; }
  100% { transform: translate3d(20px, -15px, 0); opacity: 0.75; }
`;

const ChartOrb = styled.div`
  position: absolute;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgba(255, 120, 150, 0.35), transparent 70%);
  filter: blur(6px);
  top: -40px;
  right: -60px;
  animation: ${floatOrb} 9s ease-in-out infinite alternate;
  pointer-events: none;
`;

const spinCycle = keyframes`
  0% { transform: perspective(1000px) rotateY(-5deg) scale(1); }
  5% { transform: perspective(1000px) rotateY(0deg) scale(1.02); }
  15% { transform: perspective(1000px) rotateY(360deg) scale(1.05); }
  25% { transform: perspective(1000px) rotateY(0deg) scale(1.02); }
  35% { transform: perspective(1000px) rotateY(-3deg) scale(1); }
  100% { transform: perspective(1000px) rotateY(-5deg) scale(1); }
`;

const ComparisonChart = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
  transform: perspective(1000px) rotateY(-5deg);
  transition: transform 0.5s ease;
  position: relative;
  overflow: hidden;
  animation: ${spinCycle} 5s ease-in-out infinite;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 60%);
    pointer-events: none;
    transform: rotate(45deg);
  }
  
  &:hover {
    transform: perspective(1000px) rotateY(0deg) scale(1.02);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  }
  
  @media (max-width: 768px) {
    transform: none;
    &:hover {
      transform: none;
    }
  }
`;

// --- Hero Section 2-Column Styles ---
const HeroGrid = styled.div`
  max-width: 960px; /* Changed from 1024px to 960px to match content width */
  width: 100%;
  margin: 0 auto;
  display: grid;
  gap: 3rem;
  align-items: center;
  position: relative;
  z-index: 2;
  padding: 0 1.5rem; /* Add horizontal padding (24px) */
  
  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
  }

  @media (max-width: 768px) {
    width: min(100%, 580px);
    padding: 0 clamp(1.15rem, 4.4vw, 1.75rem);
    display: flex;
    flex-direction: column;
    gap: clamp(1.35rem, 4.8vw, 1.9rem);
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 100svh;
  }
`;

const HeroLeft = styled.div`
  text-align: left;
  z-index: 10;
  
  @media (max-width: 768px) {
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(0.95rem, 3.5vw, 1.25rem);
    padding: clamp(4.3rem, 14vw, 5.8rem) 0 0;
  }
`;

const HeroTitle = styled.h1`
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.2;
  color: white;
  margin-bottom: 1.5rem;
  white-space: pre-wrap;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    font-size: clamp(2.08rem, 8.35vw, 2.65rem);
    font-weight: 760;
    line-height: 1.18;
    text-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    letter-spacing: 0;
    margin-bottom: 0;
    white-space: normal;
  }
`;

const HeroSubtitle = styled.p`
  font-size: clamp(1.05rem, 1.8vw, 1.25rem);
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2.5rem;
  font-weight: 500;
  line-height: 1.6;
  max-width: 500px;
  white-space: pre-wrap;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

  @media (max-width: 768px) {
    margin-bottom: 0;
    font-size: clamp(1.02rem, 3.85vw, 1.13rem);
    line-height: 1.56;
    max-width: 380px;
    white-space: normal;
  }
`;

const DesktopHeroTitle = styled(HeroTitle)`
  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileHeroTitle = styled(HeroTitle)`
  display: none;

  @media (max-width: 768px) {
    display: block;
    white-space: pre-wrap;
  }
`;

const DesktopHeroSubtitle = styled(HeroSubtitle)`
  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileHeroSubtitle = styled(HeroSubtitle)`
  display: none;

  @media (max-width: 768px) {
    display: block;
    white-space: pre-wrap;
  }
`;

const HeroRight = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 0 clamp(${MOBILE_NAV_GUTTER}, 3vw, 1.5rem);
  
  @media (max-width: 768px) {
    margin-top: 0;
    padding: 0;
    align-items: center;
    flex-direction: column;
    gap: 0;
  }
`;

const StackContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 380px;
  display: grid;
  grid-template-columns: 1fr;
  justify-items: stretch;
  
  @media (max-width: 768px) {
    max-width: 100%;
    padding: 0 14px 18px 0;
  }
`;

const StackCardWrapper = styled.div<{
  $position: number;
  $isAnimating?: boolean;
  $isInteractive?: boolean;
}>`
  position: relative;
  grid-area: 1 / 1;
  transform-origin: center top;
  transform: ${({ $position }) => {
    switch ($position) {
      case 0:
        return "translate(0px, 0px)";
      case 1:
        return "translate(18px, 18px)";
      default:
        return "translate(36px, 36px)";
    }
  }};

  @media (max-width: 768px) {
    transform: ${({ $position }) => {
      switch ($position) {
        case 0:
          return "translate(0px, 0px)";
        case 1:
          return "translate(7px, 9px)";
        default:
          return "translate(14px, 18px)";
      }
    }};
    opacity: ${({ $position }) => ($position === 0 ? 1 : $position === 1 ? 0.82 : 0.56)};
  }

  z-index: ${({ $position }) => 3 - $position};
  opacity: ${({ $position }) => ($position === 2 ? 0.75 : 1)};
  transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.6s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: ${({ $isInteractive }) =>
    $isInteractive ? "auto" : "none"};
  box-shadow: ${({ $position }) => {
    switch ($position) {
      case 0:
        return "0 35px 60px -22px rgba(15, 23, 42, 0.45)";
      case 1:
        return "0 28px 55px -25px rgba(15, 23, 42, 0.32)";
      default:
        return "0 22px 45px -30px rgba(15, 23, 42, 0.24)";
    }
  }};
  ${({ $isAnimating }) =>
    $isAnimating &&
    css`
      transform: translate(-18px, -22px);
      opacity: 0;
    `}
`;

const PlaceholderCardShell = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.99);
  box-shadow: inset 0 1px 8px rgba(0, 0, 0, 0.05);
`;

const MobileEventPrompt = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: inline-flex;
    width: min(100%, 470px);
    min-height: 38px;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.95);
    padding: 0.55rem 0.9rem;
    color: #0f172a;
    font-size: clamp(0.75rem, 2.6vw, 0.86rem);
    font-weight: 850;
    line-height: 1.35;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);

    svg {
      width: 15px;
      height: 15px;
      flex-shrink: 0;
    }
  }
`;

// ... [Existing FAQ and CTA Styles] ...

// Gradient shining sweep animation for CTA button
const gradientShine = keyframes`
  0% {
    background-position: -100% center;
  }
  100% {
    background-position: 100% center;
  }
`;

const CTAWrapper = styled.div`
  width: 100%;
  background: #f5f5f5;
  margin: 0;
  padding: 4rem 0;

  @media (max-width: 768px) {
    padding: 3rem 0;
  }
`;

const CTAInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const CTASection = styled.div`
  position: relative;
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  width: 100%;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 2rem;
  }
`;

const CTAVideoBackground = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const CTAOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1;
`;

const CTAContent = styled.div`
  position: relative;
  z-index: 2;
  max-width: 760px; /* Constrain width for better reading */
  margin: 0 auto;
`;

const CTATitle = styled.h3`
  font-size: 1.75rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 1rem;
  font-family: inherit;
  white-space: pre-wrap; /* Allow newlines */

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const CTADescription = styled.p`
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 1.5rem;
  line-height: 1.5;
  font-family: inherit;
  white-space: pre-wrap; /* Allow newlines */

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const CTAButton = styled.button`
  padding: 0.85rem 1.75rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
  color: white;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      120deg,
      rgba(255, 255, 255, 0) 15%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0) 85%
    );
    background-size: 200% 100%;
    animation: ${gradientShine} 2.5s linear infinite;
    pointer-events: none;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }

  svg {
    width: 1.1rem;
    height: 1.1rem;
  }

  @media (max-width: 768px) {
    padding: 0.875rem 1.5rem;
    font-size: 0.9rem;
    gap: 0.375rem;
  }
`;

const HeroCTAButton = styled(CTAButton)`
  min-height: 52px;
  padding: 0.875rem 1.9rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  font-size: 1rem;
  font-weight: 850;
  box-shadow: 5px 5px 0 #f47a4a;
  backdrop-filter: none;

  &::before {
    display: none;
  }

  &:hover {
    background: #fff8dc;
    border-color: #050505;
    box-shadow: 7px 7px 0 #f47a4a;
    transform: translate(-1px, -1px);
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    display: none;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

// Define styled component for page wrapper
const PageWrapper = styled.div<{ $machineMode?: boolean }>`
  padding-top: 0; /* Always 0 for homepage */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${({ $machineMode }) => ($machineMode ? "#000000" : "transparent")};

  img {
    -webkit-user-drag: none;
    user-select: none;
  }
`;

// New styled components for marketing text
const MarketingText = styled.h2`
  font-size: 2.8rem;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  margin-bottom: 1rem;
  line-height: 1.3;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  font-family: "Noto Sans KR", sans-serif;
  z-index: 2; /* Ensure it's above canvas */
  position: relative; /* For z-index to take effect */
  white-space: pre-wrap; /* Allow newlines from locale */

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const MarketingSubText = styled.p`
  font-size: 1.3rem;
  font-weight: 500;
  color: #e0e0e0; /* Lighter than pure white for subtlety */
  text-align: center;
  line-height: 1.6;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
  font-family: "Noto Sans KR", sans-serif;
  z-index: 2; /* Ensure it's above canvas */
  position: relative; /* For z-index to take effect */
  white-space: pre-wrap; /* Allow newlines from locale */

  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }
`;

// ... [EventCard styles omitted for brevity as they are unchanged] ...
// --- START: Copied/Adapted Meetup Card Styles from meetup.tsx ---
// (Styles removed as requested)

// Removed unused CopiedEvent styles

// --- Hero Scroll Card Styles ---
const ScrollCard = styled.div`
  width: 100%;
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  position: relative;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  @media (max-width: 768px) {
    min-height: clamp(126px, 30vw, 148px);
    height: auto;
    flex-direction: row;
    align-items: stretch;
    border: 1px solid rgba(255, 255, 255, 0.92);
    border-radius: 18px;
    box-shadow: 0 18px 34px rgba(16, 185, 129, 0.18),
      0 16px 40px rgba(0, 0, 0, 0.24);

    &:hover {
      transform: none;
    }
  }
`;

const ScrollCardImageArea = styled.div`
  width: 100%;
  position: relative;
  background: #f3f4f6;
  overflow: hidden;

  &::before {
    content: "";
    display: block;
    padding-top: 75%; /* 4:3 ratio (height / width = 0.75) */
  }
  
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 768px) {
    width: clamp(104px, 27vw, 132px);
    aspect-ratio: 1 / 1;
    align-self: center;
    flex: 0 0 clamp(104px, 27vw, 132px);
    margin-left: clamp(0.55rem, 2vw, 0.75rem);
    border-radius: 14px;
    background: #0f172a;

    &::before {
      display: none;
      padding-top: 0;
    }

    img {
      object-fit: cover;
    }
  }
`;

const ScrollCardBadge = styled.div`
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #111827;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  
  span {
    box-shadow: 0 0 0 2px rgba(255,255,255,0.5);
  }

  svg {
    width: 13px;
    height: 13px;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const ScrollCardContent = styled.div`
  flex: 1;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: white;

  @media (max-width: 768px) {
    min-width: 0;
    padding: clamp(0.78rem, 2.9vw, 0.95rem);
    gap: clamp(0.48rem, 1.8vw, 0.62rem);
    justify-content: center;
  }
`;

const ScrollCardTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.35;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  @media (max-width: 768px) {
    font-size: clamp(0.88rem, 3.25vw, 1rem);
    line-height: 1.28;
  }
`;

const ScrollCardMetaContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const ScrollCardMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 500;

  svg {
    width: 0.9rem;
    height: 0.9rem;
    color: #9ca3af;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    gap: 0.34rem;
    font-size: clamp(0.74rem, 2.7vw, 0.82rem);
    line-height: 1.25;

    svg {
      width: 0.78rem;
      height: 0.78rem;
    }
  }
`;

const ScrollCardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f3f4f6;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  flex-wrap: nowrap;

  @media (max-width: 768px) {
    margin-top: 0;
    padding-top: 0.56rem;
    gap: 0.45rem;
  }
`;

const ScrollAvatarStackSlot = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
`;

// Removed JoinCta and ParticipantCount since they are replaced by UrgencyButton

interface ScrollCardProps {
  meetup: MeetupEvent;
  maxAvatars?: number;
  onNavigate: (eventId: string) => void;
  userProfilesMap?: Record<string, UserProfile>;
}

type StackLayer =
  | { type: "event"; event: MeetupEvent; instanceKey: string }
  | { type: "placeholder"; id: string; instanceKey: string };

const PLACEHOLDER_IDS = ["placeholder-1", "placeholder-2", "placeholder-3"];

const buildStackLayers = (
  events: MeetupEvent[],
  offset: number
): StackLayer[] => {
  if (!events || events.length === 0) {
    return PLACEHOLDER_IDS.map((id, i) => ({ 
      type: "placeholder", 
      id, 
      instanceKey: `${id}-${i}` 
    }));
  }

  const count = events.length;
  const layers: StackLayer[] = [];

  for (let i = 0; i < 3; i++) {
    const absoluteIndex = offset + i;
    
    if (count === 1 && i > 0) {
      layers.push({ 
        type: "placeholder", 
        id: `${PLACEHOLDER_IDS[i - 1]}-${i}`,
        instanceKey: `placeholder-${i}-${absoluteIndex}`
      });
      continue;
    }

    if (count === 2 && i === 2) {
      layers.push({ 
        type: "placeholder", 
        id: `${PLACEHOLDER_IDS[2]}-${i}`,
        instanceKey: `placeholder-${i}-${absoluteIndex}`
      });
      continue;
    }

    const index = absoluteIndex % count;
    const event = events[index];
    layers.push({ 
      type: "event", 
      event,
      instanceKey: `${event.id}-${absoluteIndex}`
    });
  }

  return layers;
};

const UrgencyButton = styled.button<{ $isHigh?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 38px;
  background: ${(props) => (props.$isHigh ? "#fff8dc" : "#050505")};
  color: ${(props) => (props.$isHigh ? "#050505" : "#ffffff")};
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  border: 2px solid #050505;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease,
    color 160ms ease, transform 160ms ease;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 58%;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: none;

  &:hover {
    background: ${(props) => (props.$isHigh ? "#ffffff" : "#050505")};
    border-color: #050505;
    transform: translateY(-1px);
    box-shadow: none;
  }

  &:active {
    transform: translateY(0);
  }
  
  span {
    display: inline-block;
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${(props) => (props.$isHigh ? "#e11d48" : "#22c55e")};
    box-shadow: 0 0 0 3px
      ${(props) =>
        props.$isHigh ? "rgba(225, 29, 72, 0.13)" : "rgba(34, 197, 94, 0.16)"};
  }

  @media (max-width: 768px) {
    min-height: 32px;
    padding: 0.38rem 0.7rem;
    font-size: clamp(0.68rem, 2.45vw, 0.76rem);
    max-width: 62%;
  }
`;

const HeroScrollCard = ({ meetup, maxAvatars = 5, onNavigate, userProfilesMap }: ScrollCardProps) => {
  const { t } = useI18n();
  const spotsTaken = meetup.leaders.length + meetup.participants.length;
  const spotsTotal = meetup.max_participants;
  const spotsLeft = Math.max(0, spotsTotal - spotsTaken);
  const isUrgent = spotsLeft <= 5; // Urgency threshold

  return (
    <ScrollCard onClick={() => onNavigate(meetup.id)}>
      <ScrollCardImageArea>
        <img 
          src={meetup.image_urls?.[0] || "/images/placeholder.jpg"} 
          alt={meetup.title}
          width={360}
          height={270}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.style.backgroundColor = '#e5e7eb';
          }}
        />
        <ScrollCardBadge>
          <SparklesIcon />
          {t.home.meetupCard.join}
        </ScrollCardBadge>
      </ScrollCardImageArea>
      <ScrollCardContent>
        <div>
          <ScrollCardTitle>{meetup.title}</ScrollCardTitle>
          <ScrollCardMetaContainer style={{ marginTop: '0.5rem' }}>
            <ScrollCardMetaRow>
              <CalendarIconOutline />
              {formatEventDateTime(meetup)}
            </ScrollCardMetaRow>
            <ScrollCardMetaRow>
              <MapPinIcon />
              {meetup.location_name}
            </ScrollCardMetaRow>
          </ScrollCardMetaContainer>
        </div>
        <ScrollCardFooter>
           <ScrollAvatarStackSlot>
             <UserAvatarStack
                uids={[...meetup.leaders, ...meetup.participants]}
                maxAvatars={maxAvatars}
                size={32}
                userProfilesMap={userProfilesMap}
              />
           </ScrollAvatarStackSlot>
           <UrgencyButton $isHigh={isUrgent}>
             <span />
             {isUrgent
               ? t.home.meetupCard.almostFull
               : `${spotsTaken}/${spotsTotal} ${t.home.meetupCard.filled}`}
           </UrgencyButton>
        </ScrollCardFooter>
      </ScrollCardContent>
    </ScrollCard>
  );
};

// --- END: Hero Scroll Card Styles ---

interface HomePageClientProps {
  initialUpcomingEvents?: MeetupEvent[];
  initialStats?: HomeStats;
  initialTopics?: HomeTopicArticle[];
}

type RenderMode = "human" | "machine";

const FloatingModeToggle = styled.div`
  position: fixed;
  left: 50%;
  bottom: calc(1.5rem + env(safe-area-inset-bottom));
  z-index: 60;
  display: inline-flex;
  align-items: center;
  transform: translateX(-50%);
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 3px;
  white-space: nowrap;
  box-shadow: 4px 4px 0 #f47a4a;
  transition: border-color 360ms ease, background-color 360ms ease,
    box-shadow 360ms ease, filter 360ms ease;

  @media (max-width: 480px) {
    bottom: calc(0.9rem + env(safe-area-inset-bottom));
    padding: 3px;
    box-shadow: 3px 3px 0 #f47a4a;
  }
`;

const ModeToggleOptions = styled.div<{ $mode: RenderMode }>`
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(78px, 1fr));
  isolation: isolate;
  overflow: hidden;
  border-radius: 999px;

  &::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: -1;
    width: 50%;
    border-radius: 999px;
    background: #050505;
    box-shadow: none;
    content: "";
    transform: translateX(
      ${({ $mode }) => ($mode === "machine" ? "100%" : "0")}
    );
    transition: transform 420ms cubic-bezier(0.19, 1, 0.22, 1);
  }

  @media (max-width: 480px) {
    grid-template-columns: repeat(2, minmax(64px, 1fr));
  }
`;

const ModeToggleButton = styled.button<{ $active: boolean }>`
  min-width: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: ${({ $active }) => ($active ? "#ffffff" : "rgba(5, 5, 5, 0.66)")};
  padding: 0.5rem 0.72rem;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0;
  cursor: pointer;
  transition: color 280ms ease, transform 280ms ease;

  ${({ $active }) =>
    $active &&
    css`
      transform: translateY(-1px);
    `}

  &:hover {
    color: ${({ $active }) => ($active ? "#ffffff" : "#050505")};
  }

  @media (max-width: 480px) {
    padding: 0.46rem 0.58rem;
    font-size: 0.72rem;
  }
`;

const supportBob = keyframes`
  0%, 100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-4px) rotate(1deg);
  }
`;

const FloatingSupportLink = styled.a`
  position: fixed;
  right: clamp(1rem, 3vw, 1.5rem);
  bottom: calc(1.45rem + env(safe-area-inset-bottom));
  z-index: 61;
  display: inline-flex;
  align-items: center;
  gap: 0.48rem;
  min-height: 48px;
  padding: 0.55rem 0.78rem 0.55rem 0.6rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 900;
  text-decoration: none;
  box-shadow: 4px 4px 0 #f47a4a;
  animation: ${supportBob} 3.2s ease-in-out infinite;
  transition: background-color 180ms ease, box-shadow 180ms ease,
    transform 180ms ease;

  &:hover {
    background: #fff8dc;
    box-shadow: 6px 6px 0 #f47a4a;
    transform: translate(-1px, -1px);
  }

  &:focus-visible {
    outline: 3px solid rgba(244, 122, 74, 0.38);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @media (max-width: 620px) {
    right: calc(0.9rem + env(safe-area-inset-right));
    bottom: calc(0.9rem + env(safe-area-inset-bottom));
    box-sizing: border-box;
    padding: 0.5rem;
    width: 52px;
    height: 52px;
    justify-content: center;
    gap: 0;
    box-shadow: 3px 3px 0 #f47a4a;
    animation: none;
  }
`;

const FloatingSupportIcon = styled.span`
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;

  svg {
    width: 18px;
    height: 18px;
    stroke-width: 2.4;
  }

  &::after {
    content: "";
    position: absolute;
    top: 4px;
    right: 5px;
    width: 6px;
    height: 6px;
    border: 1.5px solid #050505;
    border-radius: 999px;
    background: #ffffff;
  }
`;

const FloatingSupportText = styled.span`
  white-space: nowrap;

  @media (max-width: 620px) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;

const jobCelebrationBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.25);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.85);
  }
`;

const JobCelebrationPopup = styled.aside`
  position: fixed;
  right: clamp(1rem, 3vw, 1.5rem);
  bottom: calc(5.6rem + env(safe-area-inset-bottom));
  z-index: 62;
  width: min(380px, calc(100vw - 2rem));
  border: 2px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  color: #050505;
  box-shadow: 5px 5px 0 #f47a4a;
  overflow: hidden;

  @media (max-width: 620px) {
    top: calc(4.8rem + env(safe-area-inset-top));
    right: 0.9rem;
    bottom: auto;
    left: 0.9rem;
    width: auto;
    border-radius: 14px;
    box-shadow: 4px 4px 0 #f47a4a;
  }
`;

const JobCelebrationInner = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  align-items: start;
  padding: 1rem;

  @media (max-width: 620px) {
    gap: 0.68rem;
    padding: 0.9rem;
  }
`;

const JobCelebrationIcon = styled.span`
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #ffffff;

  svg {
    width: 20px;
    height: 20px;
    stroke-width: 2.5;
  }
`;

const JobCelebrationCopy = styled.div`
  min-width: 0;

  strong {
    display: block;
    margin: 0 0 0.28rem;
    font-size: 0.98rem;
    line-height: 1.25;
    font-weight: 950;
  }

  p {
    margin: 0;
    color: rgba(5, 5, 5, 0.68);
    font-size: 0.84rem;
    line-height: 1.48;
    font-weight: 650;
  }
`;

const JobCelebrationClose = styled.button<{ $bursting: boolean }>`
  position: relative;
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  width: 100%;
  margin-top: 0.12rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #ffffff;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 900;
  cursor: pointer;
  overflow: visible;
  box-shadow: 3px 3px 0 #050505;
  transition: background-color 160ms ease, color 160ms ease, transform 160ms ease,
    box-shadow 160ms ease;

  &::before,
  &::after {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 94px;
    height: 94px;
    border-radius: 999px;
    background:
      radial-gradient(circle, #f47a4a 0 3px, transparent 3.5px) 50% 0 / 12px 12px no-repeat,
      radial-gradient(circle, #050505 0 2.5px, transparent 3px) 100% 50% / 12px 12px no-repeat,
      radial-gradient(circle, #f47a4a 0 3px, transparent 3.5px) 50% 100% / 12px 12px no-repeat,
      radial-gradient(circle, #050505 0 2.5px, transparent 3px) 0 50% / 12px 12px no-repeat,
      radial-gradient(circle, #f47a4a 0 2.5px, transparent 3px) 18% 18% / 12px 12px no-repeat,
      radial-gradient(circle, #050505 0 2px, transparent 2.5px) 82% 82% / 12px 12px no-repeat;
    content: "";
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(0.25);
  }

  &::after {
    width: 70px;
    height: 70px;
    transform: translate(-50%, -50%) rotate(24deg) scale(0.2);
  }

  &:hover {
    background: #050505;
    color: #ffffff;
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #f47a4a;
  }

  ${({ $bursting }) =>
    $bursting &&
    css`
      &::before {
        animation: ${jobCelebrationBurst} 560ms ease-out forwards;
      }

      &::after {
        animation: ${jobCelebrationBurst} 560ms 90ms ease-out forwards;
      }
    `}
`;

const MachineMarkdownView = styled.main`
  min-height: 100vh;
  background: #000000;
  color: #d7d7d7;
  padding: clamp(4rem, 7vw, 6.5rem) clamp(1.25rem, 12vw, 11rem)
    clamp(7rem, 9vw, 8rem);
  animation: ${keyframes`
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  `} 420ms ease both;

  @media (max-width: 768px) {
    padding: 2rem 1.1rem 6.5rem;
  }
`;

const MachineMarkdownBlock = styled.pre`
  width: 100%;
  max-width: none;
  margin: 0;
  border: 0;
  background: transparent;
  padding: 0;
  color: #d7d7d7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: clamp(1rem, 1.55vw, 1.45rem);
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
`;

const sanitizeMarkdownText = (value: string | number | undefined | null) => {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const formatStatValue = (value: number | undefined) => {
  return typeof value === "number" ? value.toLocaleString() : "0";
};

const formatMarkdownCurrency = (value: number, locale: string) => {
  return locale === "ko"
    ? `${value.toLocaleString("ko-KR")}원`
    : `${value.toLocaleString("en-US")} KRW`;
};

const formatMetricValue = (
  value: number | undefined,
  suffix: string | undefined,
) => {
  return `${formatStatValue(value)}${suffix ?? ""}`;
};

const buildWebsiteMarkdown = ({
  t,
  locale,
  stats,
  events,
  topics,
}: {
  t: ReturnType<typeof useI18n>["t"];
  locale: string;
  stats?: HomeStats;
  events: MeetupEvent[];
  topics: HomeTopicArticle[];
}) => {
  const pricingLabels = t.home.pricingNew.chart.labels;
  const pricingComparisons = [
    { label: pricingLabels.oneCup, value: 1212 },
    { label: pricingLabels.exchange, value: 5000 },
    { label: pricingLabels.phone, value: 20000, suffix: "~" },
    { label: pricingLabels.academy, value: 35000, suffix: "~" },
    { label: pricingLabels.premium, value: 60000, suffix: "~" },
  ];

  const lines: string[] = [
    "# 1 Cup English",
    "",
    "## Overview",
    sanitizeMarkdownText(t.home.hero.title),
    "",
    sanitizeMarkdownText(t.home.hero.subtitle),
    "",
    `**CTA:** ${sanitizeMarkdownText(t.home.cta.button)}`,
    "",
    "## Member Backgrounds",
    `**${sanitizeMarkdownText(t.home.memberLogos.titleLine1)} ${sanitizeMarkdownText(
      t.home.memberLogos.titleHighlight,
    )}${sanitizeMarkdownText(t.home.memberLogos.titleLine2Suffix)}**`,
    "",
    ...t.home.memberLogos.items.map((item) => `- ${sanitizeMarkdownText(item)}`),
    "",
    "## Meetup Method",
    "",
    `### ${sanitizeMarkdownText(t.home.topicVideo.sectionTitle)}`,
    sanitizeMarkdownText(t.home.topicVideo.title),
    "",
    sanitizeMarkdownText(t.home.topicVideo.description),
    "",
    `- Video reference: ${sanitizeMarkdownText(t.home.topicVideo.videoTitle)}`,
    `- Note: ${sanitizeMarkdownText(t.home.topicVideo.caveat)}`,
    "",
    `### ${sanitizeMarkdownText(t.home.leaderMethod.sectionTitle)}`,
    sanitizeMarkdownText(t.home.leaderMethod.title),
    "",
    ...COMMUNITY_LEADERS.map((leader) => [
      `#### ${sanitizeMarkdownText(`${t.home.leaderMethod.profiles[leader.id].name} | ${t.home.leaderMethod.profiles[leader.id].role}`)}`,
      ...t.home.leaderMethod.profiles[leader.id].bullets.map(
        (bullet) => `- ${getLeaderBulletEmoji(bullet.icon)} ${sanitizeMarkdownText(bullet.text)}`,
      ),
      `**${sanitizeMarkdownText(t.home.leaderMethod.readingStyleLabel)}:** ${sanitizeMarkdownText(t.home.leaderMethod.profiles[leader.id].readingStyle)}`,
      "",
    ]).flat(),
    `### ${sanitizeMarkdownText(t.home.networkingMethod.sectionTitle)}`,
    sanitizeMarkdownText(t.home.networkingMethod.title),
    "",
    sanitizeMarkdownText(t.home.networkingMethod.description),
    "",
    "## Proven Community",
    sanitizeMarkdownText(t.home.stats.growth.title),
    "",
    `- ${sanitizeMarkdownText(t.home.stats.growth.metrics.meetups)}: ${formatMetricValue(stats?.totalMeetups, t.home.stats.growth.valueSuffixes.meetups)}`,
    `- ${sanitizeMarkdownText(t.home.stats.growth.metrics.members)}: ${formatMetricValue(stats?.totalMembers, t.home.stats.growth.valueSuffixes.members)}`,
    `- ${sanitizeMarkdownText(t.home.stats.growth.metrics.retention)}: 90%+`,
    "",
    "## Weekly Topics",
    sanitizeMarkdownText(t.home.topicsShowcase.title),
    "",
    sanitizeMarkdownText(t.home.topicsShowcase.subtitle),
  ];

  lines.push("");

  if (topics.length > 0) {
    topics.slice(0, 6).forEach((topic) => {
      const title =
        locale === "ko" ? topic.titleKorean || topic.titleEnglish : topic.titleEnglish || topic.titleKorean;
      lines.push(`- **${sanitizeMarkdownText(title)}**`);
      if (topic.excerpt) {
        lines.push(`  - ${sanitizeMarkdownText(topic.excerpt)}`);
      }
      if (topic.keywords.length > 0) {
        lines.push(`  - Keywords: ${topic.keywords.map(sanitizeMarkdownText).join(", ")}`);
      }
    });
  } else {
    lines.push("- Featured articles are loaded from the article library.");
  }

  lines.push("", "## Upcoming Meetups");

  if (events.length > 0) {
    events.slice(0, 6).forEach((event) => {
      const title = sanitizeMarkdownText(event.title);
      const dateLabel = sanitizeMarkdownText(`${event.date} ${event.time}`);
      const location = sanitizeMarkdownText(event.location_name);
      const participantCount = event.leaders.length + event.participants.length;
      lines.push(
        `- **${title}**`,
        `  - Date: ${dateLabel}`,
        `  - Location: ${location}`,
        `  - Capacity: ${participantCount}/${event.max_participants}`,
      );
    });
  } else {
    lines.push(`- ${sanitizeMarkdownText(t.meetup.sections.noEvents)}`);
  }

  lines.push(
    "",
    "## Membership",
    `### ${sanitizeMarkdownText(t.home.pricingNew.sectionTitle)}`,
    sanitizeMarkdownText(t.home.pricingNew.leftTitle),
    "",
    `**${sanitizeMarkdownText(t.home.pricingNew.chart.header)} ${sanitizeMarkdownText(t.home.pricingNew.chart.unit)}**`,
    ...pricingComparisons.map(
      (item) =>
        `- ${sanitizeMarkdownText(item.label)}: ${formatMarkdownCurrency(item.value, locale)}${item.suffix ?? ""}`,
    ),
    "",
    `- ${sanitizeMarkdownText(t.home.pricingNew.referralDiscount)}`,
    `- ${sanitizeMarkdownText(t.home.pricingNew.caveats.line1)}`,
    `- ${sanitizeMarkdownText(t.home.pricingNew.caveats.line2)}`,
    `- ${sanitizeMarkdownText(t.home.pricingNew.caveats.line3)}`,
    `- ${sanitizeMarkdownText(t.home.pricingNew.caveats.line4)}`,
    "",
    "## FAQ",
  );

  t.home.faq.items.forEach((item) => {
    lines.push(`### ${sanitizeMarkdownText(item.q)}`, sanitizeMarkdownText(item.a), "");
  });

  lines.push(
    "## Final CTA",
    sanitizeMarkdownText(t.home.cta.title),
    "",
    sanitizeMarkdownText(t.home.cta.description),
    "",
    `**Action:** ${sanitizeMarkdownText(t.home.cta.button)}`,
    "",
    "## Support",
    `- ${sanitizeMarkdownText(t.home.support.label)}: ${SUPPORT_URL}`,
  );

  return lines.join("\n");
};

export default function NewHomeClient({
  initialUpcomingEvents,
  initialStats,
  initialTopics,
}: HomePageClientProps) {
  const [renderMode, setRenderMode] = useState<RenderMode>("human");
  const [displayMode, setDisplayMode] = useState<RenderMode>("human");
  const modeTransitionTimeoutRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { t, locale } = useI18n();
  const [selectedLeaderLocation, setSelectedLeaderLocation] =
    useState<LeaderLocation>("yeouido");
  const [activeLeaderId, setActiveLeaderId] = useState<string>("");
  const [showJobCelebration, setShowJobCelebration] = useState(false);
  const [isJobCelebrationBursting, setIsJobCelebrationBursting] = useState(false);
  const jobCelebrationCloseTimerRef = useRef<number | null>(null);

  const localizedLeaders = useMemo(
    () =>
      COMMUNITY_LEADERS.map((leader) => {
        const profile = t.home.leaderMethod.profiles[leader.id];
        const locationRoles =
          "locationRoles" in profile
            ? (profile.locationRoles as Partial<Record<LeaderLocation, string>>)
            : undefined;
        const role = locationRoles?.[selectedLeaderLocation] ?? profile.role;

        return {
          ...leader,
          name: profile.name,
          role,
          bullets: profile.bullets,
          readingStyle: profile.readingStyle,
        };
      }),
    [selectedLeaderLocation, t],
  );

  const networkingImages = useMemo(
    () =>
      NETWORKING_IMAGES.map((image) => ({
        ...image,
        alt: t.home.networkingMethod.images[image.altKey],
      })),
    [t],
  );

  const visibleLeaders = useMemo(
    () =>
      localizedLeaders.filter(
        (leader) =>
          (leader.locations as readonly LeaderLocation[]).includes(
            selectedLeaderLocation,
          ),
      ),
    [localizedLeaders, selectedLeaderLocation],
  );

  const activeLeader =
    visibleLeaders.find((leader) => leader.id === activeLeaderId) ?? null;

  const handleLeaderLocationChange = useCallback((location: LeaderLocation) => {
    setSelectedLeaderLocation(location);
    setActiveLeaderId("");
  }, []);

  const handleCloseJobCelebration = useCallback(() => {
    if (isJobCelebrationBursting) return;

    setIsJobCelebrationBursting(true);

    try {
      window.sessionStorage.setItem(JOB_CELEBRATION_STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures; the close action should still work.
    }

    jobCelebrationCloseTimerRef.current = window.setTimeout(() => {
      setShowJobCelebration(false);
      setIsJobCelebrationBursting(false);
      jobCelebrationCloseTimerRef.current = null;
    }, 620);
  }, [isJobCelebrationBursting]);

  useEffect(() => {
    let showTimer: number | null = null;

    try {
      if (window.sessionStorage.getItem(JOB_CELEBRATION_STORAGE_KEY) === "true") {
        return undefined;
      }
    } catch {
      // Continue without persistence when sessionStorage is unavailable.
    }

    showTimer = window.setTimeout(() => {
      setShowJobCelebration(true);
    }, 900);

    return () => {
      if (showTimer !== null) {
        window.clearTimeout(showTimer);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (modeTransitionTimeoutRef.current !== null) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
      }

      if (jobCelebrationCloseTimerRef.current !== null) {
        window.clearTimeout(jobCelebrationCloseTimerRef.current);
      }
    };
  }, []);

  const clearModeTransitionTimeout = useCallback(() => {
    if (modeTransitionTimeoutRef.current !== null) {
      window.clearTimeout(modeTransitionTimeoutRef.current);
      modeTransitionTimeoutRef.current = null;
    }
  }, []);

  const handleHumanMode = useCallback(() => {
    clearModeTransitionTimeout();
    setRenderMode("human");
    setDisplayMode("human");
  }, [clearModeTransitionTimeout]);

  const handleMachineMode = useCallback(() => {
    clearModeTransitionTimeout();
    setRenderMode("machine");
    modeTransitionTimeoutRef.current = window.setTimeout(() => {
      setDisplayMode("machine");
      modeTransitionTimeoutRef.current = null;
    }, 420);
  }, [clearModeTransitionTimeout]);

  const handleEventNavigation = useCallback(
    (eventId: string) => {
      router.push(`/meetup/${eventId}`);
    },
    [router]
  );
  const [homeStats, setHomeStats] = useState<HomeStats | undefined>(
    initialStats
  );
  
  // Cache for user profiles
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, UserProfile>>({});

  // --- Hero Card Scrolling Logic ---
  const [upcomingEvents, setUpcomingEvents] = useState<MeetupEvent[]>(
    initialUpcomingEvents || []
  );
  
  // Effect to fetch upcoming events if not provided initially
  useEffect(() => {
    // Helper to fetch user profiles for events
    const loadUserProfiles = async (events: MeetupEvent[]) => {
      const allUids = new Set<string>();
      events.forEach(event => {
        event.leaders.forEach(uid => allUids.add(uid));
        event.participants.forEach(uid => allUids.add(uid));
      });

      if (allUids.size > 0) {
        try {
          const profiles = await fetchUserProfiles(Array.from(allUids));
          const profileMap: Record<string, UserProfile> = {};
          profiles.forEach(p => {
            profileMap[p.uid] = p;
          });
          setUserProfilesMap(prev => ({ ...prev, ...profileMap }));
        } catch (error) {
          console.error("Failed to pre-fetch user profiles:", error);
        }
      }
    };

    // If we already have initial events, use them and fetch profiles
    if (initialUpcomingEvents && initialUpcomingEvents.length > 0) {
      setUpcomingEvents(initialUpcomingEvents);
      loadUserProfiles(initialUpcomingEvents);
      return;
    }

    const loadEvents = async () => {
      try {
        setLoadingEvent(true);
        const events = await fetchUpcomingMeetupEvents();
        if (events.length > 0) {
          setUpcomingEvents(events);
          setClosestEvent(events[0]);
          // Fetch profiles after events are loaded
          loadUserProfiles(events);
        }
      } catch (error) {
        console.error("Failed to fetch upcoming meetups for hero:", error);
      } finally {
        setLoadingEvent(false);
      }
    };
    loadEvents();
  }, [initialUpcomingEvents]);

  // Removed rotation effect


  const [closestEvent, setClosestEvent] = useState<MeetupEvent | null>(
    initialUpcomingEvents && initialUpcomingEvents.length > 0
      ? initialUpcomingEvents[0]
      : null
  );
  const [loadingEvent, setLoadingEvent] = useState(!initialUpcomingEvents);
  
  // Dynamically determine max avatars based on available space
  const [maxAvatars, setMaxAvatars] = useState(8);
  const [cardOffset, setCardOffset] = useState(0);
  const [isStackSwapping, setIsStackSwapping] = useState(false);
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const swapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stackLayers = useMemo(
    () => buildStackLayers(upcomingEvents, cardOffset),
    [upcomingEvents, cardOffset]
  );

  // Derived state for localized content

  useEffect(() => {
    const updateMaxAvatars = () => {
      setMaxAvatars(window.innerWidth <= 768 ? 3 : 8);
    };

    updateMaxAvatars();
    window.addEventListener("resize", updateMaxAvatars);

    return () => {
      window.removeEventListener("resize", updateMaxAvatars);
    };
  }, []);

  useEffect(() => {
    setCardOffset(0);
  }, [upcomingEvents.length]);

  useEffect(() => {
    if (upcomingEvents.length < 2) {
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
        rotationIntervalRef.current = null;
      }
      if (swapTimeoutRef.current) {
        clearTimeout(swapTimeoutRef.current);
        swapTimeoutRef.current = null;
      }
      setIsStackSwapping(false);
      return;
    }

    rotationIntervalRef.current = setInterval(() => {
      setIsStackSwapping(true);
      swapTimeoutRef.current = setTimeout(() => {
        setCardOffset((prev) => prev + 1);
        setIsStackSwapping(false);
      }, 450);
    }, 5000);

    return () => {
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
        rotationIntervalRef.current = null;
      }
      if (swapTimeoutRef.current) {
        clearTimeout(swapTimeoutRef.current);
        swapTimeoutRef.current = null;
      }
    };
  }, [upcomingEvents.length]);

  useEffect(() => {
    setHomeStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    let ignore = false;

    const fetchClientFallbackStats = async (): Promise<HomeStats | null> => {
      if (!clientDb) {
        return null;
      }

      const countCollections = async (names: string[]): Promise<number> => {
        for (const name of names) {
          try {
            const collRef = collection(clientDb, name);
            const countSnapshot = await getCountFromServer(collRef);
            const count = countSnapshot.data().count ?? 0;
            if (count > 0) {
              return count;
            }
          } catch (countError) {
            console.warn(`Client count failed for ${name}, attempting doc fetch.`, countError);
            try {
              const limitedSnapshot = await getDocs(query(collection(clientDb, name), limit(1)));
              if (!limitedSnapshot.empty) {
                const fullSnapshot = await getDocs(collection(clientDb, name));
                return fullSnapshot.size;
              }
            } catch (docError) {
              console.error(`Client fetch failed for ${name}:`, docError);
            }
          }
        }
        return 0;
      };

      try {
        const [meetups, members, articles] = await Promise.all([
          countCollections(["events", "meetups", "meetup"]),
          countCollections(["users", "members"]),
          countCollections(["articles", "articleEntries", "posts"]),
        ]);

        const derived: HomeStats = {
          totalMeetups: meetups,
          totalMembers: members,
          totalArticles: articles,
        };

        if (meetups || members || articles) {
          return derived;
        }

        return null;
      } catch (error) {
        console.error("Client fallback stats fetch failed:", error);
        return null;
      }
    };

    const fetchLiveStats = async () => {
      try {
        const response = await fetch("/api/home-stats", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch live stats: ${response.status}`);
        }
        const payload: HomeStats = await response.json();
        if (!ignore) {
          setHomeStats(payload);

          if (
            payload.totalMeetups === 0 &&
            payload.totalMembers === 0 &&
            payload.totalArticles === 0
          ) {
            const fallback = await fetchClientFallbackStats();
            if (fallback && !ignore) {
              setHomeStats(fallback);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch live home stats:", error);
        if (!ignore) {
          const fallback = await fetchClientFallbackStats();
          if (fallback) {
            setHomeStats(fallback);
          }
        }
      }
    };

    fetchLiveStats();

    return () => {
      ignore = true;
    };
  }, [initialStats?.totalMeetups, initialStats?.totalMembers, initialStats?.totalArticles]);

  // Effect to set video playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.8; // Set to 0.5 for 2x slower
    }
  }, []);

  // Effect to fetch upcoming events
  // Logic moved to the combined effect above
  /* 
  useEffect(() => {
    // If we already have initial events, don't fetch again
    if (initialUpcomingEvents && initialUpcomingEvents.length > 0) {
      return;
    }

    const loadClosestEvent = async () => {
      try {
        setLoadingEvent(true);
        const upcomingEvents = await fetchUpcomingMeetupEvents();
        if (upcomingEvents.length > 0) {
          setClosestEvent(upcomingEvents[0]);
        }
      } catch (error) {
        console.error("Failed to fetch upcoming meetups for hero:", error);
        setClosestEvent(null);
      } finally {
        setLoadingEvent(false);
      }
    };
    loadClosestEvent();
  }, [initialUpcomingEvents]);
  */

  const markdownContent = useMemo(
    () =>
      buildWebsiteMarkdown({
        t,
        locale,
        stats: homeStats,
        events: upcomingEvents,
        topics: initialTopics || [],
      }),
    [t, locale, homeStats, upcomingEvents, initialTopics],
  );
  const visibleMemberLogos = MEMBER_COMPANY_LOGOS.slice(0, MEMBER_LOGO_GRID_LIMIT);
  const overflowMemberLogos = MEMBER_COMPANY_LOGOS.slice(MEMBER_LOGO_GRID_LIMIT);
  const handleHomepageContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;

    if (target instanceof Element && target.closest("img, picture")) {
      event.preventDefault();
    }
  }, []);

  const handleHomepageDragStart = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target;

    if (target instanceof Element && target.closest("img, picture")) {
      event.preventDefault();
    }
  }, []);

  return (
    <PageWrapper
      $machineMode={displayMode === "machine"}
      onContextMenu={handleHomepageContextMenu}
      onDragStart={handleHomepageDragStart}
    >
      <GlobalStyle $machineMode={displayMode === "machine"} />
      {displayMode === "machine" ? (
        <MachineMarkdownView>
          <MachineMarkdownBlock>{markdownContent}</MachineMarkdownBlock>
        </MachineMarkdownView>
      ) : (
        <>
          <HeroSection>
            <video autoPlay loop muted playsInline ref={videoRef}>
              <source src="/assets/homepage/alphabet.mp4" type="video/mp4" />
              {t.home.hero.videoUnsupported}
            </video>
            <VideoOverlay />

            <HeroGrid>
              <HeroLeft>
                <DesktopHeroTitle>{t.home.hero.title}</DesktopHeroTitle>
                <MobileHeroTitle>
                  {t.home.hero.mobileTitle ?? t.home.hero.title}
                </MobileHeroTitle>
                <DesktopHeroSubtitle>{t.home.hero.subtitle}</DesktopHeroSubtitle>
                <MobileHeroSubtitle>
                  {t.home.hero.mobileSubtitle ?? t.home.hero.subtitle}
                </MobileHeroSubtitle>
                <HeroCTAButton onClick={() => router.push("/meetup")}>
                  <CalendarIconOutline />
                  {t.home.cta.button}
                </HeroCTAButton>
              </HeroLeft>

              <HeroRight>
                <StackContainer>
                  {stackLayers.map((layer, index) => (
                    <StackCardWrapper
                      key={layer.instanceKey}
                      $position={index}
                      $isAnimating={
                        isStackSwapping &&
                        index === 0 &&
                        upcomingEvents.length >= 2
                      }
                      $isInteractive={layer.type === "event" && index === 0}
                    >
                      {layer.type === "event" ? (
                        <HeroScrollCard
                          meetup={layer.event}
                          maxAvatars={maxAvatars}
                          onNavigate={handleEventNavigation}
                          userProfilesMap={userProfilesMap}
                        />
                      ) : (
                        <PlaceholderCardShell />
                      )}
                    </StackCardWrapper>
                  ))}
                </StackContainer>
              </HeroRight>
            </HeroGrid>
          </HeroSection>

          <MainContent>
            <MemberBackgroundSection>
              <MemberBackgroundLayout>
                <MemberBackgroundHeader>
                  <MemberBackgroundTitle>
                    {t.home.memberLogos.titleLine1}
                    <br />
                    <MemberBackgroundTitleAccent>
                      {t.home.memberLogos.titleHighlight}
                    </MemberBackgroundTitleAccent>
                    {t.home.memberLogos.titleLine2Suffix}
                  </MemberBackgroundTitle>
                </MemberBackgroundHeader>
                <MemberLogoViewport>
                  <MemberLogoTrack $columns={visibleMemberLogos.length <= 6 ? 3 : 4}>
                    {visibleMemberLogos.map((company, index) => (
                      <MemberLogoTile key={company.label}>
                        <MemberLogoMark $scale={company.scale}>
                          <Image
                            src={company.src}
                            alt={t.home.memberLogos.items[index] ?? company.label}
                            width={company.width}
                            height={company.height}
                            sizes="(max-width: 768px) 96px, 112px"
                            loading="lazy"
                          />
                        </MemberLogoMark>
                        <span>{t.home.memberLogos.items[index] ?? company.label}</span>
                      </MemberLogoTile>
                    ))}
                  </MemberLogoTrack>
                  {overflowMemberLogos.length > 0 ? (
                    <MemberLogoOverflow aria-label={t.home.memberLogos.additionalAria}>
                      {overflowMemberLogos.map((company, index) => (
                        <MemberLogoOverflowTile key={company.label}>
                          <Image
                            src={company.src}
                            alt={
                              t.home.memberLogos.items[
                                visibleMemberLogos.length + index
                              ] ?? company.label
                            }
                            width={company.width}
                            height={company.height}
                            sizes="72px"
                            loading="lazy"
                          />
                          <span>
                            {t.home.memberLogos.items[
                              visibleMemberLogos.length + index
                            ] ?? company.label}
                          </span>
                        </MemberLogoOverflowTile>
                      ))}
                    </MemberLogoOverflow>
                  ) : null}
                </MemberLogoViewport>
              </MemberBackgroundLayout>
            </MemberBackgroundSection>
            <MethodFlowWrapper>
              <MethodFlowRoute aria-hidden="true">
                <svg
                  className="desktop-route"
                  viewBox="0 0 1000 1680"
                  preserveAspectRatio="none"
                >
                  <path
                    className="route-shadow"
                    d="M 130 115 C 245 58 366 112 365 202 C 364 278 255 296 230 224 C 200 136 337 107 454 180 C 548 238 635 226 732 176 C 832 125 918 205 900 324 C 878 468 748 465 704 560 C 657 662 794 713 782 810 C 768 929 618 924 508 865 C 386 799 270 866 252 988 C 232 1118 372 1182 506 1132 C 646 1080 798 1168 768 1322 C 742 1457 579 1472 460 1438 C 350 1406 246 1432 176 1518"
                  />
                  <path
                    className="route-line"
                    d="M 130 115 C 245 58 366 112 365 202 C 364 278 255 296 230 224 C 200 136 337 107 454 180 C 548 238 635 226 732 176 C 832 125 918 205 900 324 C 878 468 748 465 704 560 C 657 662 794 713 782 810 C 768 929 618 924 508 865 C 386 799 270 866 252 988 C 232 1118 372 1182 506 1132 C 646 1080 798 1168 768 1322 C 742 1457 579 1472 460 1438 C 350 1406 246 1432 176 1518"
                  />
                </svg>
                <svg
                  className="mobile-route"
                  viewBox="0 0 360 1900"
                  preserveAspectRatio="none"
                >
                  <path
                    className="route-shadow"
                    d="M 178 92 C 94 172 96 300 176 352 C 260 406 270 532 184 596 C 92 665 106 820 204 884 C 290 940 284 1074 190 1138 C 96 1202 92 1364 190 1432 C 274 1490 278 1632 182 1716"
                  />
                  <path
                    className="route-line"
                    d="M 178 92 C 94 172 96 300 176 352 C 260 406 270 532 184 596 C 92 665 106 820 204 884 C 290 940 284 1074 190 1138 C 96 1202 92 1364 190 1432 C 274 1490 278 1632 182 1716"
                  />
                </svg>
              </MethodFlowRoute>
              <TopicVideoSection>
                <TopicVideoLayout>
                  <TopicVideoCopy>
                    <TopicVideoSectionTitle>
                      {t.home.topicVideo.sectionTitle}
                    </TopicVideoSectionTitle>
                    <TopicVideoTitle>{t.home.topicVideo.title}</TopicVideoTitle>
                    <TopicVideoDescription>
                      {t.home.topicVideo.description}
                    </TopicVideoDescription>
                    <TopicVideoCaveat>{t.home.topicVideo.caveat}</TopicVideoCaveat>
                  </TopicVideoCopy>
                  <TopicVideoFrameGroup>
                    <TopicVideoFrame>
                      <iframe
                        src="https://www.youtube-nocookie.com/embed/yKtw4of-j0E?start=2143&end=2203&rel=0&modestbranding=1"
                        title={t.home.topicVideo.videoTitle}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </TopicVideoFrame>
                    <TopicVideoCaption>
                      <span>{t.home.topicVideo.videoTitle}</span>
                    </TopicVideoCaption>
                  </TopicVideoFrameGroup>
                </TopicVideoLayout>
              </TopicVideoSection>
              <LeaderMethodSection>
                <LeaderMethodLayout>
                  <LeaderMethodHeader>
                    <div>
                      <LeaderMethodSectionTitle>
                        {t.home.leaderMethod.sectionTitle}
                      </LeaderMethodSectionTitle>
                      <LeaderMethodTitle>{t.home.leaderMethod.title}</LeaderMethodTitle>
                    </div>
                  </LeaderMethodHeader>

                  <LeaderMethodContent>
                    <LeaderDiagramPanel
                      aria-hidden="true"
                      $location={selectedLeaderLocation}
                    >
                      <LeaderDiagramTable />
                      {DISCUSSION_SEATS.map((seat) => (
                        <LeaderDiagramSeat
                          key={seat.id}
                          $top={seat.top}
                          $left={seat.left}
                          $accent={seat.accent}
                          $delay={seat.delay}
                          $leader={seat.leader}
                        />
                      ))}
                      <LeaderChatBubble $top="39%" $left="39%" $leader $delay="0s">
                        <span />
                        <span />
                        <span />
                      </LeaderChatBubble>
                      <LeaderChatBubble $top="39%" $left="62%" $delay="1.2s">
                        <span />
                        <span />
                        <span />
                      </LeaderChatBubble>
                      <LeaderChatBubble $top="63%" $left="39%" $delay="2.4s">
                        <span />
                        <span />
                        <span />
                      </LeaderChatBubble>
                      <LeaderChatBubble $top="63%" $left="62%" $delay="3.2s">
                        <span />
                        <span />
                        <span />
                      </LeaderChatBubble>
                    </LeaderDiagramPanel>

                    <LeaderAccordionColumn>
                      <LeaderLocationTabs aria-label={t.home.leaderMethod.locationTabsAria}>
                        {LEADER_LOCATIONS.map((location) => (
                          <LeaderLocationButton
                            key={location}
                            type="button"
                            $active={selectedLeaderLocation === location}
                            onClick={() => handleLeaderLocationChange(location)}
                          >
                            {t.home.leaderMethod.locations[location]}
                          </LeaderLocationButton>
                        ))}
                      </LeaderLocationTabs>

                      {visibleLeaders.length > 0 ? (
                        <LeaderAccordionList aria-label={t.home.leaderMethod.profilesAria}>
                          {visibleLeaders.map((leader) => {
                            const hasLeaderDetails =
                              leader.bullets.length > 0 ||
                              Boolean(leader.readingStyle) ||
                              Boolean(leader.linkedinUrl);
                            const isActive = activeLeader?.id === leader.id;

                            return (
                              <LeaderAccordionItem
                                key={leader.id}
                                $active={isActive}
                                $accent={leader.accent}
                              >
                                <LeaderAccordionButton
                                  type="button"
                                  aria-expanded={isActive}
                                  aria-disabled={!hasLeaderDetails}
                                  onClick={() =>
                                    hasLeaderDetails &&
                                    setActiveLeaderId(isActive ? "" : leader.id)
                                  }
                                >
                                  <LeaderAccordionSummary>
                                    <LeaderAccordionInitial $accent={leader.accent}>
                                      {leader.imageSrc ? (
                                        <Image
                                          src={leader.imageSrc}
                                          alt={leader.name}
                                          width={96}
                                          height={96}
                                          sizes="48px"
                                          loading="lazy"
                                        />
                                      ) : (
                                        leader.initials
                                      )}
                                    </LeaderAccordionInitial>
                                    <span>
                                      <LeaderAccordionName>
                                        {leader.name} <span>| {leader.role}</span>
                                      </LeaderAccordionName>
                                    </span>
                                    {hasLeaderDetails && (
                                      <LeaderAccordionIcon
                                        $active={isActive}
                                        aria-hidden="true"
                                      />
                                    )}
                                  </LeaderAccordionSummary>
                                </LeaderAccordionButton>
                                {hasLeaderDetails && (
                                  <LeaderAccordionPanel
                                    $active={isActive}
                                    aria-hidden={!isActive}
                                  >
                                    <LeaderAccordionPanelInner>
                                      <LeaderAccordionContent>
                                        {leader.bullets.length > 0 && (
                                          <LeaderStatList>
                                            <LeaderCredentialList>
                                              {leader.bullets.map((bullet) => (
                                                <LeaderCredentialItem key={bullet.text}>
                                                  <LeaderStatEmoji aria-hidden="true">
                                                    {getLeaderBulletEmoji(bullet.icon)}
                                                  </LeaderStatEmoji>
                                                  <span>{bullet.text}</span>
                                                </LeaderCredentialItem>
                                              ))}
                                            </LeaderCredentialList>
                                          </LeaderStatList>
                                        )}
                                        {leader.readingStyle && (
                                          <LeaderReadingStyle>
                                            <strong>{t.home.leaderMethod.readingStyleLabel}</strong>
                                            <span>{leader.readingStyle}</span>
                                          </LeaderReadingStyle>
                                        )}
                                        {leader.linkedinUrl && (
                                          <LeaderLinkedInButton
                                            href={leader.linkedinUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            $disabled={false}
                                          >
                                            LinkedIn
                                            <ArrowTopRightOnSquareIcon aria-hidden="true" />
                                          </LeaderLinkedInButton>
                                        )}
                                      </LeaderAccordionContent>
                                    </LeaderAccordionPanelInner>
                                  </LeaderAccordionPanel>
                                )}
                              </LeaderAccordionItem>
                            );
                          })}
                        </LeaderAccordionList>
                      ) : (
                        <LeaderEmptyState>
                          <div>
                            <strong>{t.home.leaderMethod.emptyTitle}</strong>
                            <br />
                            {t.home.leaderMethod.emptyDescription}
                          </div>
                        </LeaderEmptyState>
                      )}
                    </LeaderAccordionColumn>
                  </LeaderMethodContent>
                </LeaderMethodLayout>
              </LeaderMethodSection>
              <NetworkingMethodSection>
                <NetworkingMethodLayout>
                  <NetworkingMethodHeader>
                    <NetworkingMethodSectionTitle>
                      {t.home.networkingMethod.sectionTitle}
                    </NetworkingMethodSectionTitle>
                    <NetworkingMethodTitle>
                      {t.home.networkingMethod.title}
                    </NetworkingMethodTitle>
                    <NetworkingMethodDescription>
                      {t.home.networkingMethod.description}
                    </NetworkingMethodDescription>
                  </NetworkingMethodHeader>
                  <NetworkingGallery>
                    {networkingImages.map((image) => (
                      <NetworkingImageCard
                        key={image.id}
                        $objectPosition={
                          "objectPosition" in image ? image.objectPosition : undefined
                        }
                        $rotate={"rotate" in image ? image.rotate : undefined}
                      >
                        <Image
                          src={image.src}
                          alt={image.alt}
                          width={image.width}
                          height={image.height}
                          sizes="(max-width: 760px) 84vw, 420px"
                          loading="lazy"
                        />
                      </NetworkingImageCard>
                    ))}
                  </NetworkingGallery>
                </NetworkingMethodLayout>
              </NetworkingMethodSection>
              <StatsSection stats={homeStats} />
            </MethodFlowWrapper>
            <TopicsShowcase topics={initialTopics || []} />
            <MembershipSection />
            <FaqSection />
            <CtaSection />
          </MainContent>
        </>
      )}
      {displayMode === "human" && (
        <FloatingSupportLink
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          aria-label={t.home.support.ariaLabel}
        >
          <FloatingSupportIcon aria-hidden="true">
            <ChatBubbleOvalLeftEllipsisIcon />
          </FloatingSupportIcon>
          <FloatingSupportText>{t.home.support.label}</FloatingSupportText>
        </FloatingSupportLink>
      )}
      {displayMode === "human" && showJobCelebration && (
        <JobCelebrationPopup
          role="status"
          aria-label={t.home.jobCelebration.ariaLabel}
        >
          <JobCelebrationInner>
            <JobCelebrationIcon aria-hidden="true">
              <SparklesIcon />
            </JobCelebrationIcon>
            <JobCelebrationCopy>
              <strong>{t.home.jobCelebration.title}</strong>
              <p>{t.home.jobCelebration.description}</p>
            </JobCelebrationCopy>
            <JobCelebrationClose
              type="button"
              aria-label={t.home.jobCelebration.close}
              onClick={handleCloseJobCelebration}
              $bursting={isJobCelebrationBursting}
            >
              {t.home.jobCelebration.close}
            </JobCelebrationClose>
          </JobCelebrationInner>
        </JobCelebrationPopup>
      )}
      <FloatingModeToggle
        aria-label={t.home.renderMode.ariaLabel}
      >
        <ModeToggleOptions $mode={renderMode}>
          <ModeToggleButton
            type="button"
            $active={renderMode === "human"}
            onClick={handleHumanMode}
          >
            {t.home.renderMode.human}
          </ModeToggleButton>
          <ModeToggleButton
            type="button"
            $active={renderMode === "machine"}
            onClick={handleMachineMode}
          >
            {t.home.renderMode.machine}
          </ModeToggleButton>
        </ModeToggleOptions>
      </FloatingModeToggle>
    </PageWrapper>
  );
}
