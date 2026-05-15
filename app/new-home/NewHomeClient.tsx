"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styled, { createGlobalStyle, css, keyframes } from "styled-components";
import { colors } from "../lib/constants/colors";
import React from "react";
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
  AcademicCapIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  PhotoIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UsersIcon,
  MapPinIcon,
  CalendarIcon as CalendarIconOutline,
  ClockIcon,
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
import { SectionTitle, Highlight } from "./components/SectionHeading";
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
`;

// Use shared colors

const MOBILE_NAV_GUTTER = "1rem";

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
  border: 1px solid rgba(255, 255, 255, 0.94);
  border-radius: 999px;
  background: #ffffff;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 850;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
  backdrop-filter: none;

  &::before {
    display: none;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.92);
    border-color: rgba(255, 255, 255, 0.98);
    box-shadow: 0 18px 38px rgba(0, 0, 0, 0.28);
    transform: translateY(-1px);
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
  background: ${(props) => (props.$isHigh ? "#fff1f2" : "#0f172a")};
  color: ${(props) => (props.$isHigh ? "#9f1239" : "#ffffff")};
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  border: 1px solid ${(props) => (props.$isHigh ? "#fecdd3" : "#0f172a")};
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease,
    box-shadow 160ms ease, color 160ms ease, transform 160ms ease;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 58%;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: ${(props) =>
    props.$isHigh
      ? "0 7px 16px rgba(159, 18, 57, 0.1)"
      : "0 7px 16px rgba(15, 23, 42, 0.14)"};

  &:hover {
    background: ${(props) => (props.$isHigh ? "#ffe4e6" : "#020617")};
    border-color: ${(props) => (props.$isHigh ? "#fda4af" : "#020617")};
    transform: translateY(-1px);
    box-shadow: ${(props) =>
      props.$isHigh
        ? "0 10px 22px rgba(159, 18, 57, 0.14)"
        : "0 10px 24px rgba(15, 23, 42, 0.2)"};
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

const humanToggleGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(251, 191, 36, 0.2),
      0 0 14px rgba(245, 158, 11, 0.48),
      0 0 28px rgba(251, 191, 36, 0.22),
      0 14px 32px rgba(0, 0, 0, 0.42);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(251, 191, 36, 0.34),
      0 0 22px rgba(245, 158, 11, 0.76),
      0 0 42px rgba(251, 191, 36, 0.34),
      0 14px 32px rgba(0, 0, 0, 0.42);
  }
`;

const machineToggleGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(56, 189, 248, 0.2),
      0 0 14px rgba(14, 165, 233, 0.5),
      0 0 28px rgba(37, 99, 235, 0.28),
      0 14px 32px rgba(0, 0, 0, 0.46);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(56, 189, 248, 0.36),
      0 0 24px rgba(14, 165, 233, 0.86),
      0 0 48px rgba(37, 99, 235, 0.44),
      0 14px 32px rgba(0, 0, 0, 0.46);
  }
`;

const FloatingModeToggle = styled.div<{ $mode: RenderMode }>`
  position: fixed;
  left: 50%;
  bottom: calc(1.5rem + env(safe-area-inset-bottom));
  z-index: 60;
  display: inline-flex;
  align-items: center;
  transform: translateX(-50%);
  border: 2px solid
    ${({ $mode }) => ($mode === "machine" ? "#0b6fff" : "#f59e0b")};
  border-radius: 999px;
  background: rgba(9, 9, 10, 0.94);
  backdrop-filter: blur(16px);
  padding: 3px;
  white-space: nowrap;
  animation: ${({ $mode }) =>
      $mode === "machine" ? machineToggleGlow : humanToggleGlow}
    2.3s ease-in-out infinite;
  transition: border-color 360ms ease, background-color 360ms ease,
    filter 360ms ease;

  @media (max-width: 480px) {
    bottom: calc(1rem + env(safe-area-inset-bottom));
    padding: 2px;
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
    background: #2b2b2d;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
  color: ${({ $active }) => ($active ? "#ffffff" : "#9ca3af")};
  padding: 0.46rem 0.68rem;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 280ms ease, transform 280ms ease;

  ${({ $active }) =>
    $active &&
    css`
      transform: translateY(-1px);
    `}

  &:hover {
    color: #ffffff;
  }

  @media (max-width: 480px) {
    padding: 0.42rem 0.52rem;
    font-size: 0.62rem;
  }
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
  const lines: string[] = [
    "# 1 Cup English",
    "",
    "## Hero",
    sanitizeMarkdownText(t.home.hero.title),
    "",
    sanitizeMarkdownText(t.home.hero.subtitle),
    "",
    `**Primary CTA:** ${sanitizeMarkdownText(t.home.cta.button)}`,
    "",
    "## Stats",
    `- ${sanitizeMarkdownText(t.home.stats.growth.metrics.meetups)}: ${formatStatValue(stats?.totalMeetups)}`,
    `- ${sanitizeMarkdownText(t.home.stats.growth.metrics.members)}: ${formatStatValue(stats?.totalMembers)}`,
    `- Articles: ${formatStatValue(stats?.totalArticles)}`,
    "",
    "## Positioning",
    `### ${sanitizeMarkdownText(t.home.stats.header.title)}`,
    "",
    `### ${sanitizeMarkdownText(t.home.stats.insights.title)}`,
    sanitizeMarkdownText(t.home.stats.insights.description),
    "",
    `### ${sanitizeMarkdownText(t.home.stats.leader.title)}`,
    sanitizeMarkdownText(t.home.stats.leader.description),
    "",
    `### ${sanitizeMarkdownText(t.home.stats.topics.title)}`,
    sanitizeMarkdownText(t.home.stats.topics.description),
    "",
    "## Upcoming Meetups",
  ];

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

  lines.push("", "## Discussion Topics");

  if (topics.length > 0) {
    topics.slice(0, 6).forEach((topic) => {
      const title =
        locale === "ko" ? topic.titleKorean || topic.titleEnglish : topic.titleEnglish || topic.titleKorean;
      lines.push(
        `- **${sanitizeMarkdownText(title)}**`,
        `  - ${sanitizeMarkdownText(topic.excerpt)}`,
      );
      if (topic.keywords.length > 0) {
        lines.push(`  - Keywords: ${topic.keywords.map(sanitizeMarkdownText).join(", ")}`);
      }
    });
  } else {
    lines.push("- Featured articles are loaded from the article library.");
  }

  lines.push(
    "",
    "## Membership",
    `### ${sanitizeMarkdownText(t.home.pricingNew.sectionTitle)}`,
    sanitizeMarkdownText(t.home.pricingNew.leftTitle),
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

  useEffect(() => {
    return () => {
      if (modeTransitionTimeoutRef.current !== null) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
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

  return (
    <PageWrapper $machineMode={displayMode === "machine"}>
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
              Your browser does not support the video tag.
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
            <StatsSection stats={homeStats} />
            <TopicsShowcase topics={initialTopics || []} />
            <MembershipSection />
            <FaqSection />
            <CtaSection />
          </MainContent>
        </>
      )}
      <FloatingModeToggle
        aria-label={t.home.renderMode.ariaLabel}
        $mode={renderMode}
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
