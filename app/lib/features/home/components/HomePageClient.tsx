"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styled, { createGlobalStyle, css, keyframes } from "styled-components";
import { colors } from "../../../constants/colors";
import React from "react";
// GNB and Footer are now handled by the layout

// Imports for Meetup Event Display
import { useRouter } from "next/navigation";
import { MeetupEvent } from "../../meetup/types/meetup_types";
import { fetchUpcomingMeetupEvents } from "../../meetup/services/meetup_service";
import {
  formatEventDateTime,
  formatEventTitleWithCountdown,
  isEventLocked,
} from "../../meetup/utils/meetup_helpers";
import { PinIcon, CalendarIcon } from "../../meetup/components/meetup_icons";
import { UserAvatarStack } from "../../meetup/components/user_avatar";
import StatsSection from "./StatsSection";
import { HomeStats } from "../services/stats_service";
import TopicsShowcase from "./TopicsShowcase";
import { HomeTopicArticle } from "../services/topics_service";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  PhotoIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../supabase/client";

// Bubble type definition
// interface Bubble {
//   x: number;
//   y: number;
//   radius: number;
//   dx: number;
//   dy: number;
//   color: string;
//   opacity: number;
//   pulseSpeed: number;
//   pulseAmount: number;
//   pulseOffset: number;
// }

// Local global style removed; fonts are injected via <head>
const GlobalStyle = createGlobalStyle``;

// Use shared colors

// Common section styles
const SectionBase = css`
  min-height: 450px;
  padding: 5rem 2rem;
  position: relative;
  overflow: hidden;
  margin-bottom: 0;

  @media (max-width: 768px) {
    padding: 3rem 1rem;
  }
`;

const MOBILE_NAV_GUTTER = "1rem";

// Hero Section
const HeroSection = styled.section`
  color: white;
  padding: clamp(6rem, 10vw, 7.5rem) clamp(1.5rem, 8vw, 10rem) clamp(4.5rem, 10vw, 6.5rem);
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;

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
    min-height: 100vh;
    padding: clamp(4rem, 14vw, 5.5rem) ${MOBILE_NAV_GUTTER}
      clamp(6rem, 30vw, 9rem);
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

// Gallery Section Styles
const GallerySection = styled.section`
  padding: clamp(3rem, 6vw, 4.5rem) 0 clamp(1.5rem, 3vw, 2rem);
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
  overflow: visible; /* Allow shadows to show */
`;

const GalleryInner = styled.div`
  padding: 0 1.5rem;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const GalleryTitle = styled.h2`
  font-size: clamp(1.8rem, 3.5vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: #1f2937;
  margin-bottom: clamp(2rem, 4vw, 3rem);
  text-align: center;
  font-family: "Noto Sans KR", sans-serif;

  @media (max-width: 768px) {
    font-size: 1.6rem;
    margin-bottom: 1.5rem;
  }
`;

const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 0.8fr;
  gap: 1rem;
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const GalleryImageBase = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }
`;

const GalleryImageLarge = styled(GalleryImageBase)`
  grid-row: span 2;
  aspect-ratio: 1 / 1;

  @media (max-width: 768px) {
    grid-row: span 1;
    aspect-ratio: 1 / 1;
  }
`;

const GalleryImageSmall = styled(GalleryImageBase)`
  aspect-ratio: 16 / 9;

  @media (max-width: 768px) {
    aspect-ratio: 16 / 9;
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 2;
  max-width: 960px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(2.4rem, 6vw, 3.4rem);
  padding: 0 clamp(0.75rem, 3vw, 2rem);

  > div {
    max-width: 640px;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
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

const memberProfiles: MemberProfile[] = [
  {
    id: "founder",
    label: "모임장 겸 개발자",
    bio: "5년 넘게 현업에서 경영진, 실무진을 가리지 않고 미팅만 수천번 통역한 영어 베테랑입니다. 현재는 인공지능 쪽으로 커리어를 전환하고자 학교에 복학했습니다.",
    highlights: [
      "(현) 고려대 컴퓨터학과 재학",
      "(전) CJ 제일제당 통역사",
      "(전) 센드버드 통역사",
      "(전) 한미연합사 통역병",
    ],
    linkedInUrl: "https://www.linkedin.com/in/sk-kyle-kim/",
    image: "/assets/homepage/member1.webp",
    background:
      "linear-gradient(135deg, rgba(17, 24, 39, 0.88) 0%, rgba(30, 64, 175, 0.78) 100%)",
    accent: "#3b82f6",
    accentSoft: "rgba(59, 130, 246, 0.18)",
    initials: "모임장",
    icon: UsersIcon,
  },
  {
    id: "professionals",
    label: "현업에서 일하시는 분들",
    bio: "이미 글로벌 커리어를 쌓아가고 계신 분이 많습니다. 제조업, IT, 건설, 외국계 등 다양한 업종과 법, 컨설팅 등 배경을 갖고 계신 분들이 있어 관점을 넓히기에 좋습니다.",
    highlights: [
      "대기업 및 외국계",
      "전문직, 컨설팅 출신",
    ],
    image: "/assets/homepage/member2.jpg",
    background:
      "linear-gradient(135deg, rgba(15, 118, 110, 0.88) 0%, rgba(22, 163, 74, 0.75) 100%)",
    accent: "#10b981",
    accentSoft: "rgba(16, 185, 129, 0.18)",
    initials: "프로",
    icon: BriefcaseIcon,
  },
  {
    id: "students",
    label: "대학교에 다니시는 분들",
    bio: "모임장의 배경으로 인해 고려대, IT 관련 전공자들이 꽤 많습니다. 하지만 다양한 대학교 및 전공자 분들도 대환영합니다.",
    highlights: [
      "고려대 재학 및 졸업생",
      "영미권 유학을 목표로 하는 석박사 과정생",
      "IT 전공자 외 다수",
      "Google Developer Group 멤버",
    ],
    image: "/assets/homepage/member3.jpg",
    background:
      "linear-gradient(135deg, rgba(76, 29, 149, 0.88) 0%, rgba(124, 58, 237, 0.72) 100%)",
    accent: "#a855f7",
    accentSoft: "rgba(168, 85, 247, 0.18)",
    initials: "학생",
    icon: AcademicCapIcon,
  },
];

const pricingBenefits: PricingBenefit[] = [
  {
    title: "월 4회 오프라인 밋업",
    description: "통역사가 직접 리딩하는 2시간 토론 세션으로 실전 영어 루틴을 완성합니다.",
  },
  {
    title: "고급 비즈니스 콘텐츠",
    description: "기업 임원들도 즐겨보는 기사를 바탕으로 밀도 있는 토론을 진행합니다.",
  },
  {
    title: "압도적인 가성비",
    description: "1시간 당 1,210원으로 어떤 영어 서비스나 모임도 따라올 수 없는 가성비를 자랑합니다.",
  },
];

const FAQ_ITEMS = [
  {
    question: "영어 한잔 밋업은 뭔가요?",
    answer:
      "영어 한잔 밋업은 통번역사 출신의 운영자가 직접 리딩하는 영어 모임입니다. 자세한 일정 및 참여 방법은 밋업 메뉴를 참고해 주세요.",
  },
  {
    question: "구독은 언제든 취소할 수 있나요?",
    answer:
      "네, 언제든지 구독을 취소할 수 있습니다. 구독 취소 시 다음 결제 주기부터 서비스가 중단됩니다.",
  },
  {
    question: "모바일에서도 이용 가능한가요?",
    answer:
      "네, 영어 한잔은 모바일, PC 환경을 모두 고려하여 개발했습니다. 모바일/태블릿 이용 시 카카오톡 인앱 브라우저보다 크롬, 사파리 브라우저에서 작동이 더 잘될 수 있습니다.",
  },
  {
    question: "회원가입 하려니 외국 웹사이트에서 코드인증을 하라는 문자가 날아와요. 괜찮은건가요?",
    answer:
      "저희는 Google의 인증 방식을 채택하여, 해당 문자는 Google 시스템을 통해 발송되는 것 입니다. 영어 한잔은 웹사이트 가입 시 휴대폰 번호 외의 어떤 개인정보도 받고 있지 않습니다. 안심하고 가입하셔도 됩니다.",
  },
  {
    question: "회원 탈퇴는 어떻게 하나요?",
    answer:
      "회원 탈퇴에 관한 문의는 영어한잔 카카오톡 채널을 통해 문의 주시면 탈퇴 진행을 도와드리겠습니다.",
  },
  {
    question: "서비스에 대한 문의 사항이 있어요",
    answer:
      "각종 문의는 영어한잔 카카오톡(링크 추가)로 연락 주시면 성심껏 응답하도록 하겠습니다.",
  },
];

const SectionTitle = styled.h2`
  font-size: 2.5rem;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: #1f2937;
  margin-bottom: 3rem;
  font-weight: 800;
  font-family: "Noto Sans KR", sans-serif;
  text-align: center;

  @media (max-width: 768px) {
    font-size: 1.8rem;
    padding: 0 10px;
    margin-bottom: 2rem;
  }
`;

// Members Section
const MembersSection = styled.section`
  ${SectionBase}
  background: #f8fafc;
  height: 900px;
  display: flex;
  align-items: flex-start;
  padding: 0;
  overflow: hidden;

  @media (max-width: 1024px) {
    height: auto;
    min-height: auto;
    padding: clamp(4.5rem, 8vw, 6rem) 0 clamp(4rem, 8vw, 6rem);
    overflow: visible;
    align-items: stretch;
  }
`;

const MembersInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: clamp(2rem, 4vw, 3rem);
  padding: 0 1.5rem;
  width: 100%;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const MembersHeading = styled(SectionTitle)`
  text-align: center;
  margin: 0;
  color: #0f172a;
`;

const MembersIntro = styled.p`
  font-size: 1rem;
  color: #6b7280;
  margin: 0.5rem auto 0;
  max-width: 640px;
  line-height: 1.5;
  text-align: center;
`;

const MembersLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  gap: clamp(1.5rem, 4vw, 3rem);
  align-items: start;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const MemberVisualPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const MemberVisualCard = styled.div<{ $background: string }>`
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  width: 100%;
  background: ${(props) => props.$background};
  display: flex;
  align-items: stretch;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
`;

const MemberVisualMedia = styled.div`
  position: relative;
  flex: 1;
`;

const MemberVisualImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const MemberVisualFallback = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(2rem, 5vw, 2.6rem);
  font-weight: 700;
  color: rgba(248, 250, 252, 0.9);
`;


const MembersAccordion = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const MemberAccordionItem = styled.div<{ $isActive: boolean }>`
  border-radius: 18px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid
    ${(props) => (props.$isActive ? colors.primary : "rgba(229, 231, 235, 1)")};
  box-shadow: ${(props) =>
    props.$isActive
      ? "0 18px 42px rgba(15, 23, 42, 0.12)"
      : "0 8px 22px rgba(15, 23, 42, 0.08)"};
  transition: all 0.25s ease;
`;

const MemberAccordionHeader = styled.button<{ $accent: string; $accentSoft: string; $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: ${(props) => (props.$isActive ? "1.5rem" : "1rem 1.5rem")};
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: padding 0.25s ease;

  @media (max-width: 768px) {
    padding: ${(props) => (props.$isActive ? "1.3rem" : "0.9rem 1.3rem")};
  }
`;

const MemberIconCircle = styled.span<{ $accent: string; $accentSoft: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${(props) => props.$accentSoft};
  color: ${(props) => props.$accent};

  svg {
    width: 20px;
    height: 20px;
  }
`;

const MemberHeaderTitle = styled.span`
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
  flex: 1;
`;

const MemberAccordionContent = styled.div<{ $isActive: boolean }>`
  max-height: ${(props) => (props.$isActive ? "550px" : "0")};
  overflow: hidden;
  transition: max-height 0.35s ease;
`;

const MemberAccordionBody = styled.div`
  padding: 0 1.5rem 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 768px) {
    padding: 0 1.3rem 1.3rem;
  }
`;

const MemberName = styled.h4`
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
`;

const MemberBio = styled.p`
  margin: 0;
  font-size: 0.95rem;
  color: #4b5563;
  line-height: 1.65;
`;

const MemberHighlights = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const MemberHighlight = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  font-size: 0.92rem;
  color: #1f2937;
  line-height: 1.5;
`;

const MemberHighlightIcon = styled.span<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.2rem;
  color: ${(props) => props.$accent};

  svg {
    width: 18px;
    height: 18px;
  }
`;

const LinkedInButton = styled.a<{ $accent: string; $accentSoft: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  background: ${(props) => props.$accentSoft};
  color: ${(props) => props.$accent};
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
  border: 1px solid ${(props) => props.$accent}33;

  &:hover {
    background: ${(props) => props.$accent};
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px ${(props) => props.$accent}40;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

// Pricing Section with Golden Ticket Theme
const PricingSection = styled.section`
  ${SectionBase}
  background: #000000;
  color: #f8fafc;
  padding: clamp(4.5rem, 9vw, 6.5rem) 0 clamp(4rem, 9vw, 6.5rem);
  position: relative;
  overflow: hidden;
`;

const PricingInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(1.5rem, 3vw, 2rem);
  text-align: center;
  padding: 0 1.5rem;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const PricingCard = styled.div`
  width: 100%;
  border-radius: 20px;
  padding: clamp(2.4rem, 6vw, 3rem);
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: clamp(1.8rem, 4vw, 2.5rem);
  position: relative;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
    border-color: #d1d5db;
  }
`;

const PricingHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
  position: relative;
  z-index: 1;
`;

const PricingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  align-self: center;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
  background: #fff7ed;
  color: #9a3412;
  border: 1px solid #fdba74;
`;

const PricingPrice = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.6rem;
  position: relative;
  z-index: 1;
`;

const PricingCurrency = styled.span`
  font-size: clamp(1.5rem, 4vw, 1.8rem);
  font-weight: 700;
  color: #111827;
`;

const PricingAmount = styled.span`
  font-size: clamp(2.5rem, 6vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #111827;
`;

const PricingPeriod = styled.span`
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
`;

const PricingTagline = styled.p`
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: #374151;
  line-height: 1.6;
`;

const PricingHighlights = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  position: relative;
  z-index: 1;
`;

const PricingHighlightItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  text-align: left;
`;

const PricingHighlightIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #e5edff;
  color: #1d4ed8;
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
  }
`;

const PricingHighlightText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const PricingHighlightTitle = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
`;

const PricingHighlightDescription = styled.span`
  font-size: 0.9rem;
  color: #4b5563;
  line-height: 1.55;
`;

const PricingButton = styled.button`
  align-self: stretch;
  padding: 0.875rem 1.5rem;
  border: 1px solid #111827;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #ffffff;
  font-family: inherit;
  background: #111827;

  &:hover {
    background: #000000;
    border-color: #000000;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }

  svg {
    width: 1rem;
    height: 1rem;
  }

  @media (max-width: 768px) {
    padding: 0.875rem 1.25rem;
    font-size: 0.9375rem;
  }
`;

const PricingDisclaimer = styled.p`
  font-size: 0.8125rem;
  color: #9ca3af;
  line-height: 1.6;
  text-align: center;
  margin: 0;
  max-width: 760px;

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const PricingSectionTitle = styled(SectionTitle)`
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
`;

// FAQ Section
const FAQSection = styled.section`
  ${SectionBase}
  background: transparent;
  padding: 5rem 0 0;
  margin-bottom: 0;
`;

const FAQInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

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
  max-width: 960px;
  margin: 3rem auto 0;
  padding: 0;
  width: 100%;

  @media (max-width: 768px) {
    margin: 2rem auto 0;
  }
`;

const CTAInner = styled.div`
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
`;

const CTATitle = styled.h3`
  font-size: 1.75rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 1rem;
  font-family: inherit;

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

const FAQContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const FAQItem = styled.div`
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;

  &:hover {
    border-color: #d1d5db;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
`;

interface FAQQuestionProps {
  $isOpen: boolean;
}

const FAQQuestion = styled.button<FAQQuestionProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 1.5rem;
  background: transparent;
  border: none;
  font-size: 1.05rem;
  font-weight: 600;
  color: #1f2937;
  cursor: pointer;
  font-family: "Noto Sans KR", sans-serif;
  text-align: left;
  transition: color 0.2s ease;

  &:hover {
    color: ${colors.primary};
  }

  span {
    font-size: 1.4rem;
    font-weight: 400;
    color: ${colors.primary};
    transition: transform 0.25s ease;
    transform: ${(props) => (props.$isOpen ? "rotate(180deg)" : "none")};
    flex-shrink: 0;
    margin-left: 1rem;
  }

  @media (max-width: 768px) {
    padding: 1.2rem;
    font-size: 0.95rem;
  }
`;

const FAQAnswer = styled.div<{ $isOpen: boolean }>`
  max-height: ${(props) => (props.$isOpen ? "500px" : "0")};
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  padding: ${(props) => (props.$isOpen ? "0 1.5rem 1.5rem" : "0 1.5rem")};
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.7;
  font-family: "Noto Sans KR", sans-serif;

  @media (max-width: 768px) {
    font-size: 0.9rem;
    padding: ${(props) => (props.$isOpen ? "0 1.2rem 1.2rem" : "0 1.2rem")};
  }
`;

// Define styled component for page wrapper
const PageWrapper = styled.div`
  padding-top: 0; /* Always 0 for homepage */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
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

  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }
`;

// --- START: Copied/Adapted Meetup Card Styles from meetup.tsx ---
const subtleGlow = keyframes`
  0% {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  50% {
    box-shadow: 0 4px 20px rgba(76, 175, 80, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  100% {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const CopiedEventCard = styled.div<{ $isPast?: boolean; $isClosest?: boolean }>`
  position: relative;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 14px 36px rgba(84, 103, 168, 0.22);
  width: 100%;
  opacity: ${(props) => (props.$isPast ? 0.6 : 1)};
  overflow: hidden;
  background: #ffffff; /* Solid white background */
  border: 1px solid rgba(220, 220, 220, 0.5); /* Subtle border */

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 18px 42px rgba(70, 92, 170, 0.28);
  }

  & > * {
    position: relative;
    z-index: 2;
  };
  text-align: left; // Ensure text is left-aligned

  ${(props) =>
    props.$isClosest
      ? css`
          animation: ${subtleGlow} 3s ease-in-out infinite;
          border: 1px solid rgba(76, 175, 80, 0.3);
        `
      : ""}

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    opacity: ${(props) => (props.$isPast ? 0.8 : 1)};
  }

  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 16px;
  }
`;

const CopiedEventContent = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 20px;

  @media (max-width: 768px) {
    gap: 12px;
  }
`;

const CopiedEventImageContainer = styled.div<{ $isPast?: boolean }>`
  width: 120px;
  height: 120px;
  border-radius: 20px;
  overflow: hidden;
  background-color: #000000;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: ${(props) => (props.$isPast ? "grayscale(50%)" : "none")};

  @media (max-width: 768px) {
    width: 80px;
    height: 80px;
    border-radius: 12px;
  }
`;

const CopiedEventImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const CopiedEventImagePlaceholder = styled.div`
  color: #d1d5db;
  font-size: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }

  svg {
    width: 42px;
    height: 42px;
  }
`;

const CopiedEventDetails = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const CopiedEventTitle = styled.h3<{ $isPast?: boolean }>`
  color: ${(props) =>
    props.$isPast ? "#999" : colors.text.dark}; // Use theme color
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px 0;
  line-height: 1.3;
  word-wrap: break-word;

  @media (max-width: 768px) {
    font-size: 15px;
    margin: 0 0 6px 0;
    line-height: 1.2;
  }
`;

// Using this for CountdownPrefix as it's identical to the one in meetup.tsx
const CopiedCountdownPrefix = styled.span<{ $isUrgent?: boolean }>`
  color: ${(props) => (props.$isUrgent ? "#DC143C" : "inherit")};
  font-weight: ${(props) => (props.$isUrgent ? "bold" : "inherit")};
`;

const CopiedEventInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  @media (max-width: 768px) {
    gap: 6px;
    margin-bottom: 4px;
  }
`;

const CopiedEventIcon = styled.span<{ $isPast?: boolean }>`
  color: ${(props) =>
    props.$isPast ? "#999" : colors.text.medium}; // Use theme color
  flex-shrink: 0;
  display: flex;
  align-items: center;

  svg {
    fill: currentColor; // Ensure SVG inherits color
  }
`;

const CopiedEventText = styled.span<{ $isPast?: boolean }>`
  color: ${(props) =>
    props.$isPast ? "#999" : colors.text.medium}; // Use theme color
  font-size: 16px;
  letter-spacing: 0;
  word-wrap: break-word;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

const CopiedEventBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px;
  min-height: 30px; /* Ensure consistent height */
  flex-wrap: nowrap;
  width: 100%;
  min-width: 0;
  overflow: hidden;

  @media (max-width: 768px) {
    margin-top: 4px;
    gap: 6px;
  }
`;

const CopiedAvatarStackSlot = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
`;

const CopiedStatusBadge = styled.span<{ $statusColor: string }>`
  display: inline-block;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  background-color: ${(props) => props.$statusColor};
  border-radius: 20px;
  text-align: center;
  min-width: 80px;
  flex-shrink: 0; /* Prevent badge from shrinking */
  max-width: 52%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap; /* Keep badge text on one line */
  transition: all 0.2s ease;

  @media (max-width: 768px) {
    font-size: 12px;
    padding: 6px 12px;
    min-width: 80px;
    max-width: 56%;
  }
`;
// --- END: Copied/Adapted Meetup Card Styles ---

// New Styled component for the enticing text/design element
const EventCardPrompt = styled.div`
  background: linear-gradient(135deg, ${colors.primaryPale} 0%, #ffffff 100%);
  color: ${colors.primaryDark};
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  margin-bottom: 1rem; // Space between this prompt and the card
  font-size: 1rem;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  border: 1px solid ${colors.primaryPale};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  text-align: center;
  width: 100%;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 0.9rem;
    padding: 0.6rem 1rem;
    line-height: 1.3;
  }

  svg {
    width: 1.15rem;
    height: 1.15rem;
    color: ${colors.primary};
    flex-shrink: 0;
  }
`;

// Wrapper for the copied event card in the hero section
const HeroMeetupCardContainer = styled.div`
  max-width: 550px;
  width: 100%;
  margin: 0 auto 0 auto;
  z-index: 2;
  position: relative;

  @media (max-width: 768px) {
    max-width: 90%;
  }
`;

interface HeroEventCardProps {
  meetup: MeetupEvent;
  maxAvatars: number;
  onNavigate: (eventId: string) => void;
}

const HeroEventCard = React.memo(
  React.forwardRef<HTMLDivElement, HeroEventCardProps>(function HeroEventCard(
    { meetup, maxAvatars, onNavigate },
    ref
  ) {
    const { countdownPrefix, eventTitle, isUrgent } =
      formatEventTitleWithCountdown(meetup);
    const lockStatus = isEventLocked(meetup);
    const isCurrentlyLocked = lockStatus.isLocked;
    const totalParticipants = meetup.leaders.length + meetup.participants.length;
    const isPast = false;

    const statusColor = isCurrentlyLocked
      ? lockStatus.reason === "full"
        ? "#ff4d4f"
        : "#888"
      : "#4CAF50";

    const getStatusText = () => {
      if (!isCurrentlyLocked) return "참가 가능";
      switch (lockStatus.reason) {
        case "started":
          return "진행중";
        case "full":
          return "정원 마감";
        case "lockdown":
          return "모집 종료";
        default:
          return "모집 종료";
      }
    };

    return (
      <CopiedEventCard
        ref={ref}
        onClick={() => onNavigate(meetup.id)}
        $isPast={isPast}
        $isClosest={true}
      >
        <CopiedEventContent>
          <CopiedEventImageContainer $isPast={isPast}>
            {meetup.image_urls && meetup.image_urls.length > 0 ? (
              <CopiedEventImage src={meetup.image_urls[0]} alt={meetup.title} />
            ) : (
              <CopiedEventImagePlaceholder>
                <PhotoIcon />
              </CopiedEventImagePlaceholder>
            )}
          </CopiedEventImageContainer>
          <CopiedEventDetails>
            <CopiedEventTitle $isPast={isPast}>
              {countdownPrefix && (
                <CopiedCountdownPrefix $isUrgent={isUrgent}>
                  {countdownPrefix}
                </CopiedCountdownPrefix>
              )}
              {eventTitle}
            </CopiedEventTitle>
            <CopiedEventInfo>
              <CopiedEventIcon $isPast={isPast}>
                <PinIcon width="16px" height="16px" />
              </CopiedEventIcon>
              <CopiedEventText $isPast={isPast}>
                {meetup.location_name}
              </CopiedEventText>
            </CopiedEventInfo>
            <CopiedEventInfo>
              <CopiedEventIcon $isPast={isPast}>
                <CalendarIcon width="16px" height="16px" />
              </CopiedEventIcon>
              <CopiedEventText $isPast={isPast}>
                {formatEventDateTime(meetup)}
              </CopiedEventText>
            </CopiedEventInfo>
            <CopiedEventBottom data-event-bottom>
              <CopiedAvatarStackSlot>
                <UserAvatarStack
                  uids={[...meetup.leaders, ...meetup.participants]}
                  maxAvatars={maxAvatars}
                  size={30}
                  isPast={isPast}
                />
              </CopiedAvatarStackSlot>
              <CopiedStatusBadge data-status-badge $statusColor={statusColor}>
                {getStatusText()} ({totalParticipants}/{meetup.max_participants})
              </CopiedStatusBadge>
            </CopiedEventBottom>
          </CopiedEventDetails>
        </CopiedEventContent>
      </CopiedEventCard>
    );
  })
);

HeroEventCard.displayName = "HeroEventCard";

interface HomePageClientProps {
  initialUpcomingEvents?: MeetupEvent[];
  initialStats?: HomeStats;
  initialTopics?: HomeTopicArticle[];
}

export default function HomePageClient({
  initialUpcomingEvents,
  initialStats,
  initialTopics,
}: HomePageClientProps) {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const handleEventNavigation = useCallback(
    (eventId: string) => {
      router.push(`/meetup/${eventId}`);
    },
    [router]
  );
  const [homeStats, setHomeStats] = useState<HomeStats | undefined>(
    initialStats
  );
  const [activeMemberIndex, setActiveMemberIndex] = useState(0);
  const memberRotationRef = useRef<NodeJS.Timeout | null>(null);
  const isMemberPointerActive = useRef(false);
  const isMemberFocusActive = useRef(false);

  const [closestEvent, setClosestEvent] = useState<MeetupEvent | null>(
    initialUpcomingEvents && initialUpcomingEvents.length > 0
      ? initialUpcomingEvents[0]
      : null
  );
  const [loadingEvent, setLoadingEvent] = useState(!initialUpcomingEvents);
  
  // Dynamically determine max avatars based on available space
  const [maxAvatars, setMaxAvatars] = useState(8);
  const eventCardRef = useRef<HTMLDivElement>(null);

  const startMemberRotation = useCallback(() => {
    if (memberRotationRef.current) {
      clearInterval(memberRotationRef.current);
    }

    memberRotationRef.current = setInterval(() => {
      setActiveMemberIndex((prevIndex) => (prevIndex + 1) % memberProfiles.length);
    }, 5000);
  }, [memberProfiles.length]);

  const pauseMemberRotation = useCallback(() => {
    if (memberRotationRef.current) {
      clearInterval(memberRotationRef.current);
      memberRotationRef.current = null;
    }
  }, []);

  const resumeMemberRotation = useCallback(() => {
    if (isMemberPointerActive.current || isMemberFocusActive.current) {
      return;
    }
    startMemberRotation();
  }, [startMemberRotation]);

  const handleMemberSelect = useCallback((index: number) => {
    setActiveMemberIndex(index);
  }, []);

  const handleMemberHover = useCallback((index: number) => {
    setActiveMemberIndex(index);
  }, []);

  const handleMemberFocus = useCallback(
    (index: number) => {
      setActiveMemberIndex(index);
      isMemberFocusActive.current = true;
      pauseMemberRotation();
    },
    [pauseMemberRotation]
  );

  const handleMemberBlur = useCallback(() => {
    isMemberFocusActive.current = false;
    resumeMemberRotation();
  }, [resumeMemberRotation]);

  const handleMemberMouseEnter = useCallback(() => {
    isMemberPointerActive.current = true;
    pauseMemberRotation();
  }, [pauseMemberRotation]);

  const handleMemberMouseLeave = useCallback(() => {
    isMemberPointerActive.current = false;
    resumeMemberRotation();
  }, [resumeMemberRotation]);

  useEffect(() => {
    startMemberRotation();

    return () => {
      if (memberRotationRef.current) {
        clearInterval(memberRotationRef.current);
      }
    };
  }, [startMemberRotation]);

  // Effect to dynamically calculate max avatars based on available space
  useEffect(() => {
    if (!eventCardRef.current || !closestEvent) return;

    const calculateMaxAvatars = () => {
      const eventBottomEl = eventCardRef.current?.querySelector('[data-event-bottom]') as HTMLElement;
      if (!eventBottomEl) return;

      const containerWidth = eventBottomEl.offsetWidth;
      const gap = 8; // Gap between avatar stack and badge
      
      // Measure the status badge width
      const badgeEl = eventBottomEl.querySelector('[data-status-badge]') as HTMLElement;
      const badgeWidth = badgeEl ? badgeEl.offsetWidth : 120; // Fallback to estimated width
      
      // Calculate available width for avatars
      const availableWidth = containerWidth - badgeWidth - gap - 20; // 20px buffer
      
      // Avatar calculations: size=30, overlap=60% (so each additional avatar adds 18px)
      const avatarSize = 30;
      const overlapFactor = 0.6;
      const avatarSpacing = avatarSize * overlapFactor;
      
      // Calculate how many avatars can fit
      // First avatar takes full width, each additional takes spacing width
      const totalParticipants = closestEvent.leaders.length + closestEvent.participants.length;
      
      if (totalParticipants === 0) {
        setMaxAvatars(0);
        return;
      }

      if (availableWidth < avatarSize) {
        setMaxAvatars(0);
        return;
      }

      let maxFit = 0;
      const maxVisibleAvatars = Math.min(totalParticipants, 10);

      for (let visibleCount = 1; visibleCount <= maxVisibleAvatars; visibleCount++) {
        const hasMoreIndicator = totalParticipants > visibleCount;
        const stackWidth =
          visibleCount * avatarSpacing +
          avatarSize * 0.4 +
          (hasMoreIndicator ? avatarSpacing : 0);

        if (stackWidth <= availableWidth) {
          maxFit = visibleCount;
        } else {
          break;
        }
      }

      setMaxAvatars(maxFit);
    };

    // Initial calculation
    const timeoutId = setTimeout(calculateMaxAvatars, 100);
    
    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      calculateMaxAvatars();
    });
    
    if (eventCardRef.current) {
      resizeObserver.observe(eventCardRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [closestEvent]);

  const activeMember = memberProfiles[activeMemberIndex];

  useEffect(() => {
    setHomeStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    let ignore = false;

    const fetchClientFallbackStats = async (): Promise<HomeStats | null> => {
      // Stats are now the `home_stats` VIEW (replaces the old cache/homeStats doc
      // + client-side collection counting). Read it directly.
      try {
        const { data, error } = await supabase
          .from("home_stats")
          .select("*")
          .maybeSingle();

        if (error || !data) {
          if (error) {
            console.error("Client fallback stats fetch failed:", error);
          }
          return null;
        }

        const derived: HomeStats = {
          totalMeetups: data.total_meetups ?? 0,
          totalMembers: data.total_members ?? 0,
          totalArticles: data.total_articles ?? 0,
        };

        if (derived.totalMeetups || derived.totalMembers || derived.totalArticles) {
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

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <PageWrapper>
      <GlobalStyle />
      <HeroSection>
        <video autoPlay loop muted playsInline ref={videoRef}>
          <source src="/assets/homepage/alphabet.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <VideoOverlay />
        <HeroContent>
          <div>
            <MarketingText>
              국내파 통역사가 직접 개발한
              <br />
              비즈니스 영어 커뮤니티
            </MarketingText>
            <MarketingSubText>
              저희 모임에서는 영어, 좋은 사람, 트렌드를
              <br />
              한꺼번에 얻어갈 수 있습니다
            </MarketingSubText>
          </div>
          {!loadingEvent && closestEvent && (
            <HeroMeetupCardContainer>
              <EventCardPrompt>
                <SparklesIcon />
                <span>
                  바로 지금! 통역사가 직접 리딩하는
                  <MobileBreak /> 영어 모임에 참여해보세요!
                </span>
              </EventCardPrompt>
              <HeroEventCard
                ref={eventCardRef}
                meetup={closestEvent}
                maxAvatars={maxAvatars}
                onNavigate={handleEventNavigation}
              />
            </HeroMeetupCardContainer>
          )}
        </HeroContent>
      </HeroSection>

      <MainContent>
        {/* Gallery Section */}
        <GallerySection>
          <GalleryInner>
            <GalleryTitle>
              매주 일요일 오전 11시,
              <br />
              통역사 출신이 리딩하는 영어 모임
            </GalleryTitle>
            <GalleryGrid>
              <GalleryImageLarge
                src="/assets/homepage/gallery1.webp"
                alt="영어 한잔 밋업 현장 1"
                loading="lazy"
              />
              <GalleryImageSmall
                src="/assets/homepage/gallery2.webp"
                alt="영어 한잔 밋업 현장 2"
                loading="lazy"
              />
              <GalleryImageSmall
                src="/assets/homepage/gallery3.webp"
                alt="영어 한잔 밋업 현장 3"
                loading="lazy"
              />
            </GalleryGrid>
          </GalleryInner>
        </GallerySection>

        <StatsSection stats={homeStats} />

        <TopicsShowcase topics={initialTopics || []} />

        <MembersSection>
          <MembersInner>
            <MembersHeading>모임에는 누가 참석하나요?</MembersHeading>
            <MembersLayout
              onMouseEnter={handleMemberMouseEnter}
              onMouseLeave={handleMemberMouseLeave}
              onTouchStart={handleMemberMouseEnter}
              onTouchEnd={handleMemberMouseLeave}
              onTouchCancel={handleMemberMouseLeave}
            >
              <MemberVisualPanel>
                <MemberVisualCard $background={activeMember.background}>
                  <MemberVisualMedia>
                    {activeMember.image ? (
                      <MemberVisualImage
                        src={activeMember.image}
                        alt={`${activeMember.label} 비주얼 이미지`}
                        loading="lazy"
                      />
                    ) : (
                      <MemberVisualFallback>{activeMember.initials}</MemberVisualFallback>
                    )}
                  </MemberVisualMedia>
                </MemberVisualCard>
              </MemberVisualPanel>

              <MembersAccordion>
                {memberProfiles.map((member, index) => {
                  const Icon = member.icon;
                  return (
                    <MemberAccordionItem
                      key={member.id}
                      $isActive={activeMemberIndex === index}
                    >
                      <MemberAccordionHeader
                        onClick={() => handleMemberSelect(index)}
                        onFocus={() => handleMemberFocus(index)}
                        onBlur={handleMemberBlur}
                        onMouseEnter={() => handleMemberHover(index)}
                        $accent={member.accent}
                        $accentSoft={member.accentSoft}
                        $isActive={activeMemberIndex === index}
                      >
                        <MemberIconCircle
                          $accent={member.accent}
                          $accentSoft={member.accentSoft}
                        >
                          <Icon />
                        </MemberIconCircle>
                        <MemberHeaderTitle>{member.label}</MemberHeaderTitle>
                      </MemberAccordionHeader>
                      <MemberAccordionContent $isActive={activeMemberIndex === index}>
                        <MemberAccordionBody>
                          <MemberBio>{member.bio}</MemberBio>
                          {member.linkedInUrl && (
                            <LinkedInButton
                              href={member.linkedInUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              $accent={member.accent}
                              $accentSoft={member.accentSoft}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                              LinkedIn 프로필 보기
                            </LinkedInButton>
                          )}
                          <MemberHighlights>
                            {member.highlights.map((highlight, highlightIndex) => (
                              <MemberHighlight key={highlightIndex}>
                                <MemberHighlightIcon $accent={member.accent}>
                                  <CheckCircleIcon />
                                </MemberHighlightIcon>
                                <span>{highlight}</span>
                              </MemberHighlight>
                            ))}
                          </MemberHighlights>
                        </MemberAccordionBody>
                      </MemberAccordionContent>
                    </MemberAccordionItem>
                  );
                })}
              </MembersAccordion>
            </MembersLayout>
          </MembersInner>
        </MembersSection>

        <PricingSection>
          <PricingInner>
            <PricingSectionTitle>멤버십 이용권 안내</PricingSectionTitle>
            <PricingCard>
              <PricingHeader>
                <PricingBadge>정기 멤버십</PricingBadge>
                <PricingPrice>
                  <PricingCurrency>₩</PricingCurrency>
                  <PricingAmount>9,700</PricingAmount>
                  <PricingPeriod>/월</PricingPeriod>
                </PricingPrice>
                <PricingTagline>
                  통역사가 직접 리딩하는 2시간 토론 세션, 고급 비즈니스 콘텐츠, 압도적인 가성비를 모두 경험하세요.
                </PricingTagline>
              </PricingHeader>

              <PricingHighlights>
                {pricingBenefits.map((benefit, index) => (
                  <PricingHighlightItem key={index}>
                    <PricingHighlightIcon>
                      <CheckBadgeIcon />
                    </PricingHighlightIcon>
                    <PricingHighlightText>
                      <PricingHighlightTitle>{benefit.title}</PricingHighlightTitle>
                      <PricingHighlightDescription>
                        {benefit.description}
                      </PricingHighlightDescription>
                    </PricingHighlightText>
                  </PricingHighlightItem>
                ))}
              </PricingHighlights>

              <PricingButton onClick={() => router.push("/payment")}>
                <RocketLaunchIcon />
                멤버십 신청하기
              </PricingButton>
            </PricingCard>
            <PricingDisclaimer>
              *1주에 1회 진행하는 밋업에 모두 참여 시 4회입니다. 운영진 귀책 사유로 밋업을 1주 진행하지 못할 경우 구독 기간을 2주 연장해드립니다. 멤버 분 귀책 사유로 밋업을 불참하실 경우 연장이 되지는 않습니다. 밋업 간 비매너 언행 시 강제 환불이 진행될 수 있습니다.
            </PricingDisclaimer>
          </PricingInner>
        </PricingSection>

        {/* FAQ Section */}
        <FAQSection>
          <FAQInner>
            <SectionTitle>자주 묻는 질문</SectionTitle>
            <FAQContainer>
              {FAQ_ITEMS.map(
                (faq: { question: string; answer: string }, index: number) => (
                  <FAQItem key={index}>
                    <FAQQuestion
                      onClick={() => toggleFAQ(index)}
                      $isOpen={openFAQ === index}
                    >
                      {faq.question}
                      <span>{openFAQ === index ? "−" : "+"}</span>
                    </FAQQuestion>
                    <FAQAnswer $isOpen={openFAQ === index}>
                      {faq.answer}
                    </FAQAnswer>
                  </FAQItem>
                )
              )}
            </FAQContainer>
          </FAQInner>
        </FAQSection>

        {/* CTA Section */}
        <CTAWrapper>
          <CTAInner>
            <CTASection>
              <CTAVideoBackground autoPlay loop muted playsInline>
                <source src="/assets/blog/manhattan.mp4" type="video/mp4" />
              </CTAVideoBackground>
              <CTAOverlay />
              <CTAContent>
                <CTATitle>영어 소통 능력을 키우고 싶다면?</CTATitle>
                <CTADescription>
                  통역사, 직장인, 대학생, 전문가 등 다양한 백그라운드를 가진 <br />
                  멤버들과 함께하는 영어 밋업에 참여해보세요.
                </CTADescription>
                <CTAButton onClick={() => router.push("/meetup")}>
                  <RocketLaunchIcon />
                  밋업 확인하기
                </CTAButton>
              </CTAContent>
            </CTASection>
          </CTAInner>
        </CTAWrapper>
      </MainContent>
    </PageWrapper>
  );
}
