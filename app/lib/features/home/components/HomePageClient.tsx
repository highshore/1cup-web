"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import "./home.css";
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
      "프로필 페이지 맨 아래 '계정 삭제' 버튼으로 직접 탈퇴하실 수 있습니다. 정기결제를 이용 중이시라면 먼저 결제를 중단해 주세요. 진행이 어려우시면 영어한잔 카카오톡 채널로 문의 주시면 도와드리겠습니다.",
  },
  {
    question: "서비스에 대한 문의 사항이 있어요",
    answer:
      "각종 문의는 영어한잔 카카오톡(링크 추가)로 연락 주시면 성심껏 응답하도록 하겠습니다.",
  },
];

// Common section title style (SectionTitle)
const sectionTitleClass =
  "mb-12 text-center font-['Noto_Sans_KR',sans-serif] text-[2.5rem] font-extrabold leading-[1.3] tracking-[-0.02em] text-[#1f2937] max-[768px]:mb-8 max-[768px]:px-[10px] max-[768px]:text-[1.8rem]";

// Gallery image base (GalleryImageBase)
const galleryImageBaseClass =
  "h-full w-full rounded-2xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-300 ease-[ease] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)]";

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

    const isClosest = true;
    const pastTextClass = isPast ? "text-[#999]" : "text-ink";
    const pastMediumTextClass = isPast ? "text-[#999]" : "text-ink-medium";

    return (
      <div
        ref={ref}
        onClick={() => onNavigate(meetup.id)}
        className={`relative mb-6 w-full cursor-pointer overflow-hidden rounded-[20px] border bg-white p-4 text-left shadow-[0_14px_36px_rgba(84,103,168,0.22)] transition-all duration-200 ease-[ease] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)] [&>*]:relative [&>*]:z-[2] max-[768px]:rounded-2xl max-[768px]:p-4 ${
          isPast ? "opacity-60 hover:opacity-80" : "opacity-100 hover:opacity-100"
        } ${
          isClosest
            ? "animate-[home-subtle-glow_3s_ease-in-out_infinite] border-[rgba(76,175,80,0.3)]"
            : "border-[rgba(220,220,220,0.5)]"
        }`}
      >
        <div className="flex items-start gap-5 max-[768px]:gap-3">
          <div
            className={`flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-black max-[768px]:h-20 max-[768px]:w-20 max-[768px]:rounded-xl ${
              isPast ? "[filter:grayscale(50%)]" : "[filter:none]"
            }`}
          >
            {meetup.image_urls && meetup.image_urls.length > 0 ? (
              <img
                className="h-full w-full object-contain"
                src={meetup.image_urls[0]}
                alt={meetup.title}
              />
            ) : (
              <div className="flex items-center justify-center text-[2.5rem] text-[#d1d5db] max-[768px]:text-[1.5rem] [&_svg]:h-[42px] [&_svg]:w-[42px]">
                <PhotoIcon />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <h3
              className={`m-0 mb-2 text-[18px] font-bold leading-[1.3] [word-wrap:break-word] max-[768px]:mb-1.5 max-[768px]:text-[15px] max-[768px]:leading-[1.2] ${pastTextClass}`}
            >
              {countdownPrefix && (
                <span className={isUrgent ? "font-bold text-[#DC143C]" : ""}>
                  {countdownPrefix}
                </span>
              )}
              {eventTitle}
            </h3>
            <div className="mb-2 flex items-center gap-2 max-[768px]:mb-1 max-[768px]:gap-1.5">
              <span
                className={`flex shrink-0 items-center [&_svg]:fill-current ${pastMediumTextClass}`}
              >
                <PinIcon width="16px" height="16px" />
              </span>
              <span
                className={`text-[16px] tracking-[0] [word-wrap:break-word] max-[768px]:text-[13px] ${pastMediumTextClass}`}
              >
                {meetup.location_name}
              </span>
            </div>
            <div className="mb-2 flex items-center gap-2 max-[768px]:mb-1 max-[768px]:gap-1.5">
              <span
                className={`flex shrink-0 items-center [&_svg]:fill-current ${pastMediumTextClass}`}
              >
                <CalendarIcon width="16px" height="16px" />
              </span>
              <span
                className={`text-[16px] tracking-[0] [word-wrap:break-word] max-[768px]:text-[13px] ${pastMediumTextClass}`}
              >
                {formatEventDateTime(meetup)}
              </span>
            </div>
            <div
              data-event-bottom
              className="mt-2 flex min-h-[30px] w-full min-w-0 flex-nowrap items-center justify-between gap-2 overflow-hidden max-[768px]:mt-1 max-[768px]:gap-1.5"
            >
              <div className="flex min-w-0 flex-[1_1_auto] items-center overflow-hidden">
                <UserAvatarStack
                  uids={[...meetup.leaders, ...meetup.participants]}
                  maxAvatars={maxAvatars}
                  size={30}
                  isPast={isPast}
                />
              </div>
              <span
                data-status-badge
                className="inline-block max-w-[52%] min-w-20 shrink-0 overflow-hidden rounded-[20px] px-4 py-2 text-center text-[14px] font-bold text-ellipsis whitespace-nowrap text-white transition-all duration-200 ease-[ease] max-[768px]:max-w-[56%] max-[768px]:min-w-20 max-[768px]:px-3 max-[768px]:py-1.5 max-[768px]:text-[12px]"
                style={{ backgroundColor: statusColor }}
              >
                {getStatusText()} ({totalParticipants}/{meetup.max_participants})
              </span>
            </div>
          </div>
        </div>
      </div>
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
    <div className="flex min-h-screen flex-col pt-0">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-[clamp(6rem,10vw,7.5rem)] px-[clamp(1.5rem,8vw,10rem)] pb-[clamp(4.5rem,10vw,6.5rem)] text-center text-white max-[768px]:min-h-screen max-[768px]:pt-[clamp(4rem,14vw,5.5rem)] max-[768px]:px-4 max-[768px]:pb-[clamp(6rem,30vw,9rem)] [&_video]:absolute [&_video]:top-1/2 [&_video]:left-1/2 [&_video]:z-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_video]:[transform:translate(-50%,-50%)]">
        <video autoPlay loop muted playsInline ref={videoRef}>
          <source src="/assets/homepage/alphabet.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute top-0 left-0 z-[1] h-full w-full bg-[rgba(4,4,20,0.5)] backdrop-blur-[2px]" />
        <div className="relative z-[2] flex w-full max-w-page flex-col items-center gap-[clamp(2.4rem,6vw,3.4rem)] px-[clamp(0.75rem,3vw,2rem)] max-[768px]:px-4 [&>div]:mx-auto [&>div]:max-w-[640px]">
          <div>
            <h2 className="relative z-[2] mb-4 text-center font-['Noto_Sans_KR',sans-serif] text-[2.8rem] font-bold leading-[1.3] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.5)] max-[768px]:text-[2rem]">
              국내파 통역사가 직접 개발한
              <br />
              비즈니스 영어 커뮤니티
            </h2>
            <p className="relative z-[2] mx-auto max-w-[600px] text-center font-['Noto_Sans_KR',sans-serif] text-[1.3rem] font-medium leading-[1.6] text-[#e0e0e0] [text-shadow:0_1px_6px_rgba(0,0,0,0.4)] max-[768px]:mb-2 max-[768px]:text-[1rem]">
              저희 모임에서는 영어, 좋은 사람, 트렌드를
              <br />
              한꺼번에 얻어갈 수 있습니다
            </p>
          </div>
          {!loadingEvent && closestEvent && (
            <div className="relative z-[2] mx-auto my-0 w-full max-w-[550px] max-[768px]:max-w-[90%]">
              <div className="mb-4 flex w-full items-center justify-center gap-[0.55rem] rounded-xl border border-primary-pale bg-[linear-gradient(135deg,#F5EBE6_0%,#ffffff_100%)] px-5 py-3 text-center text-[1rem] font-semibold text-primary-dark shadow-[0_2px_10px_rgba(0,0,0,0.08)] max-[768px]:px-4 max-[768px]:py-[0.6rem] max-[768px]:text-[0.9rem] max-[768px]:leading-[1.3] [&_svg]:h-[1.15rem] [&_svg]:w-[1.15rem] [&_svg]:shrink-0 [&_svg]:text-primary">
                <SparklesIcon />
                <span>
                  바로 지금! 통역사가 직접 리딩하는
                  <br className="hidden max-[768px]:block" /> 영어 모임에 참여해보세요!
                </span>
              </div>
              <HeroEventCard
                ref={eventCardRef}
                meetup={closestEvent}
                maxAvatars={maxAvatars}
                onNavigate={handleEventNavigation}
              />
            </div>
          )}
        </div>
      </section>

      <div className="relative isolate flex flex-1 flex-col bg-white">
        {/* Gallery Section */}
        <section className="mx-auto w-full max-w-page overflow-visible pt-[clamp(3rem,6vw,4.5rem)] pb-[clamp(1.5rem,3vw,2rem)]">
          <div className="px-gutter max-[768px]:px-4">
            <h2 className="mb-[clamp(2rem,4vw,3rem)] text-center font-['Noto_Sans_KR',sans-serif] text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold leading-[1.3] tracking-[-0.02em] text-[#1f2937] max-[768px]:mb-6 max-[768px]:text-[1.6rem]">
              매주 일요일 오전 11시,
              <br />
              통역사 출신이 리딩하는 영어 모임
            </h2>
            <div className="grid w-full grid-cols-[1fr_0.8fr] gap-4 max-[768px]:grid-cols-1 max-[768px]:gap-3">
              <img
                className={`${galleryImageBaseClass} row-span-2 aspect-square max-[768px]:row-span-1`}
                src="/assets/homepage/gallery1.webp"
                alt="영어 한잔 밋업 현장 1"
                loading="lazy"
              />
              <img
                className={`${galleryImageBaseClass} aspect-video`}
                src="/assets/homepage/gallery2.webp"
                alt="영어 한잔 밋업 현장 2"
                loading="lazy"
              />
              <img
                className={`${galleryImageBaseClass} aspect-video`}
                src="/assets/homepage/gallery3.webp"
                alt="영어 한잔 밋업 현장 3"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <StatsSection stats={homeStats} />

        <TopicsShowcase topics={initialTopics || []} />

        <section className="relative mb-0 flex h-[900px] min-h-[450px] items-start overflow-hidden bg-[#f8fafc] p-0 max-[1024px]:h-auto max-[1024px]:min-h-[auto] max-[1024px]:items-stretch max-[1024px]:overflow-visible max-[1024px]:px-0 max-[1024px]:pt-[clamp(4.5rem,8vw,6rem)] max-[1024px]:pb-[clamp(4rem,8vw,6rem)]">
          <div className="mx-auto flex w-full max-w-page flex-col gap-[clamp(2rem,4vw,3rem)] px-gutter max-[768px]:px-4">
            <h2 className="m-0 text-center font-['Noto_Sans_KR',sans-serif] text-[2.5rem] font-extrabold leading-[1.3] tracking-[-0.02em] text-[#0f172a] max-[768px]:px-[10px] max-[768px]:text-[1.8rem]">
              모임에는 누가 참석하나요?
            </h2>
            <div
              className="grid grid-cols-[1fr_1.05fr] items-start gap-[clamp(1.5rem,4vw,3rem)] max-[1024px]:grid-cols-1"
              onMouseEnter={handleMemberMouseEnter}
              onMouseLeave={handleMemberMouseLeave}
              onTouchStart={handleMemberMouseEnter}
              onTouchEnd={handleMemberMouseLeave}
              onTouchCancel={handleMemberMouseLeave}
            >
              <div className="flex flex-col gap-5">
                <div
                  className="relative flex aspect-square w-full items-stretch overflow-hidden rounded-3xl shadow-[0_24px_48px_rgba(15,23,42,0.2)]"
                  style={{ background: activeMember.background }}
                >
                  <div className="relative flex-1">
                    {activeMember.image ? (
                      <img
                        className="h-full w-full object-cover"
                        src={activeMember.image}
                        alt={`${activeMember.label} 비주얼 이미지`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[clamp(2rem,5vw,2.6rem)] font-bold text-[rgba(248,250,252,0.9)]">
                        {activeMember.initials}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {memberProfiles.map((member, index) => {
                  const Icon = member.icon;
                  const isActive = activeMemberIndex === index;
                  return (
                    <div
                      key={member.id}
                      className={`overflow-hidden rounded-[18px] border bg-white transition-all duration-[250ms] ease-[ease] ${
                        isActive
                          ? "border-primary shadow-[0_18px_42px_rgba(15,23,42,0.12)]"
                          : "border-[rgba(229,231,235,1)] shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                      }`}
                    >
                      <button
                        className={`flex w-full cursor-pointer items-center gap-4 border-none bg-transparent text-left transition-[padding] duration-[250ms] ease-[ease] ${
                          isActive
                            ? "p-6 max-[768px]:p-[1.3rem]"
                            : "px-6 py-4 max-[768px]:px-[1.3rem] max-[768px]:py-[0.9rem]"
                        }`}
                        onClick={() => handleMemberSelect(index)}
                        onFocus={() => handleMemberFocus(index)}
                        onBlur={handleMemberBlur}
                        onMouseEnter={() => handleMemberHover(index)}
                      >
                        <span
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-5 [&_svg]:w-5"
                          style={{
                            background: member.accentSoft,
                            color: member.accent,
                          }}
                        >
                          <Icon />
                        </span>
                        <span className="flex-1 text-[1rem] font-bold leading-[1.4] text-[#111827]">
                          {member.label}
                        </span>
                      </button>
                      <div
                        className={`overflow-hidden transition-[max-height] duration-[350ms] ease-[ease] ${
                          isActive ? "max-h-[550px]" : "max-h-0"
                        }`}
                      >
                        <div className="flex flex-col gap-4 px-6 pb-[1.6rem] max-[768px]:px-[1.3rem] max-[768px]:pb-[1.3rem]">
                          <p className="m-0 text-[0.95rem] leading-[1.65] text-[#4b5563]">
                            {member.bio}
                          </p>
                          {member.linkedInUrl && (
                            <a
                              href={member.linkedInUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-[var(--m-accent-33)] bg-[var(--m-accent-soft)] px-4 py-[0.6rem] text-[0.9rem] font-semibold text-[var(--m-accent)] no-underline transition-all duration-200 ease-[ease] hover:-translate-y-px hover:bg-[var(--m-accent)] hover:text-white hover:no-underline hover:shadow-[0_4px_12px_var(--m-accent-40)] [&_svg]:h-[18px] [&_svg]:w-[18px]"
                              style={
                                {
                                  "--m-accent": member.accent,
                                  "--m-accent-soft": member.accentSoft,
                                  "--m-accent-33": `${member.accent}33`,
                                  "--m-accent-40": `${member.accent}40`,
                                } as React.CSSProperties
                              }
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                              LinkedIn 프로필 보기
                            </a>
                          )}
                          <ul className="m-0 flex list-none flex-col gap-3 p-0">
                            {member.highlights.map((highlight, highlightIndex) => (
                              <li
                                key={highlightIndex}
                                className="flex items-start gap-[0.65rem] text-[0.92rem] leading-[1.5] text-[#1f2937]"
                              >
                                <span
                                  className="mt-[0.2rem] inline-flex items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]"
                                  style={{ color: member.accent }}
                                >
                                  <CheckCircleIcon />
                                </span>
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="relative mb-0 min-h-[450px] overflow-hidden bg-black px-0 pt-[clamp(4.5rem,9vw,6.5rem)] pb-[clamp(4rem,9vw,6.5rem)] text-[#f8fafc] max-[768px]:px-4 max-[768px]:py-12">
          <div className="relative z-[1] mx-auto flex max-w-page flex-col items-center gap-[clamp(1.5rem,3vw,2rem)] px-gutter text-center max-[768px]:px-4">
            <h2 className="relative z-[1] mb-12 text-center font-['Noto_Sans_KR',sans-serif] text-[2.5rem] font-extrabold leading-[1.3] tracking-[-0.02em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.3)] max-[768px]:mb-8 max-[768px]:px-[10px] max-[768px]:text-[1.8rem]">
              멤버십 이용권 안내
            </h2>
            <div className="relative flex w-full flex-col gap-[clamp(1.8rem,4vw,2.5rem)] rounded-[20px] border border-[#e5e7eb] bg-white p-[clamp(2.4rem,6vw,3rem)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)] transition-[box-shadow,border-color] duration-200 ease-[ease] hover:border-[#d1d5db] hover:shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)]">
              <div className="relative z-[1] flex flex-col gap-4 text-center">
                <span className="inline-flex items-center justify-center gap-2 self-center rounded-full border border-[#fdba74] bg-[#fff7ed] px-4 py-2 text-[0.875rem] font-semibold text-[#9a3412]">
                  정기 멤버십
                </span>
                <div className="relative z-[1] flex items-baseline justify-center gap-[0.6rem]">
                  <span className="text-[clamp(1.5rem,4vw,1.8rem)] font-bold text-[#111827]">₩</span>
                  <span className="text-[clamp(2.5rem,6vw,3.5rem)] font-extrabold tracking-[-0.02em] text-[#111827]">
                    9,700
                  </span>
                  <span className="text-[1rem] font-medium text-[#6b7280]">/월</span>
                </div>
                <p className="m-0 text-[1rem] font-medium leading-[1.6] text-[#374151]">
                  통역사가 직접 리딩하는 2시간 토론 세션, 고급 비즈니스 콘텐츠, 압도적인 가성비를 모두 경험하세요.
                </p>
              </div>

              <ul className="relative z-[1] m-0 flex list-none flex-col gap-[1.1rem] p-0">
                {pricingBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-4 text-left">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5edff] text-[#1d4ed8] [&_svg]:h-5 [&_svg]:w-5">
                      <CheckBadgeIcon />
                    </span>
                    <div className="flex flex-col gap-[0.35rem]">
                      <span className="text-[1rem] font-semibold text-[#111827]">{benefit.title}</span>
                      <span className="text-[0.9rem] leading-[1.55] text-[#4b5563]">
                        {benefit.description}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                className="inline-flex cursor-pointer items-center justify-center gap-2 self-stretch rounded-xl border border-[#111827] bg-[#111827] px-6 py-[0.875rem] text-[1rem] font-semibold text-white [font-family:inherit] transition-all duration-150 ease-[ease] hover:-translate-y-px hover:border-black hover:bg-black hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)] active:translate-y-0 max-[768px]:px-5 max-[768px]:py-[0.875rem] max-[768px]:text-[0.9375rem] [&_svg]:h-4 [&_svg]:w-4"
                onClick={() => router.push("/payment")}
              >
                <RocketLaunchIcon />
                멤버십 신청하기
              </button>
            </div>
            <p className="m-0 max-w-[760px] text-center text-[0.8125rem] leading-[1.6] text-[#9ca3af] max-[768px]:text-[0.75rem]">
              *1주에 1회 진행하는 밋업에 모두 참여 시 4회입니다. 운영진 귀책 사유로 밋업을 1주 진행하지 못할 경우 구독 기간을 2주 연장해드립니다. 멤버 분 귀책 사유로 밋업을 불참하실 경우 연장이 되지는 않습니다. 밋업 간 비매너 언행 시 강제 환불이 진행될 수 있습니다.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="relative mb-0 min-h-[450px] overflow-hidden bg-transparent px-0 pt-20 pb-0 max-[768px]:px-4 max-[768px]:py-12">
          <div className="mx-auto max-w-page px-gutter max-[768px]:px-4">
            <h2 className={sectionTitleClass}>자주 묻는 질문</h2>
            <div className="flex w-full flex-col gap-[1.2rem]">
              {FAQ_ITEMS.map(
                (faq: { question: string; answer: string }, index: number) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white transition-all duration-200 ease-[ease] hover:border-[#d1d5db] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                  >
                    <button
                      onClick={() => toggleFAQ(index)}
                      className={`flex w-full cursor-pointer items-center justify-between border-none bg-transparent p-6 text-left font-['Noto_Sans_KR',sans-serif] text-[1.05rem] font-semibold text-[#1f2937] transition-colors duration-200 ease-[ease] hover:text-primary max-[768px]:p-[1.2rem] max-[768px]:text-[0.95rem] [&_span]:ml-4 [&_span]:shrink-0 [&_span]:text-[1.4rem] [&_span]:font-normal [&_span]:text-primary [&_span]:transition-transform [&_span]:duration-[250ms] [&_span]:ease-[ease] ${
                        openFAQ === index ? "[&_span]:rotate-180" : ""
                      }`}
                    >
                      {faq.question}
                      <span>{openFAQ === index ? "−" : "+"}</span>
                    </button>
                    <div
                      className={`overflow-hidden font-['Noto_Sans_KR',sans-serif] text-[0.95rem] leading-[1.7] text-[#6b7280] transition-[max-height,padding] duration-300 ease-[ease] max-[768px]:text-[0.9rem] ${
                        openFAQ === index
                          ? "max-h-[500px] px-6 pt-0 pb-6 max-[768px]:px-[1.2rem] max-[768px]:pb-[1.2rem]"
                          : "max-h-0 px-6 py-0 max-[768px]:px-[1.2rem]"
                      }`}
                    >
                      {faq.answer}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <div className="mx-auto mt-12 mb-0 w-full max-w-page p-0 max-[768px]:mt-8">
          <div className="px-gutter max-[768px]:px-4">
            <div className="relative w-full overflow-hidden rounded-[20px] p-12 text-center max-[768px]:p-8">
              <video
                className="absolute top-0 left-0 z-0 h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              >
                <source src="/assets/blog/manhattan.mp4" type="video/mp4" />
              </video>
              <div className="absolute top-0 left-0 z-[1] h-full w-full bg-[rgba(0,0,0,0.7)]" />
              <div className="relative z-[2]">
                <h3 className="mb-4 text-[1.75rem] font-semibold text-white [font-family:inherit] max-[768px]:text-[1.25rem]">
                  영어 소통 능력을 키우고 싶다면?
                </h3>
                <p className="mb-6 text-[1rem] leading-[1.5] text-[rgba(255,255,255,0.85)] [font-family:inherit] max-[768px]:text-[0.9rem]">
                  통역사, 직장인, 대학생, 전문가 등 다양한 백그라운드를 가진 <br />
                  멤버들과 함께하는 영어 밋업에 참여해보세요.
                </p>
                <button
                  className="relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[20px] border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] px-7 py-[0.85rem] text-[1rem] font-bold text-white [font-family:inherit] backdrop-blur-[10px] transition-all duration-[250ms] ease-[ease] before:pointer-events-none before:absolute before:inset-0 before:animate-[home-gradient-shine_2.5s_linear_infinite] before:bg-[linear-gradient(120deg,rgba(255,255,255,0)_15%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0)_85%)] before:bg-[length:200%_100%] before:content-[''] hover:border-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.2)] max-[768px]:gap-1.5 max-[768px]:px-6 max-[768px]:py-[0.875rem] max-[768px]:text-[0.9rem] [&_svg]:h-[1.1rem] [&_svg]:w-[1.1rem]"
                  onClick={() => router.push("/meetup")}
                >
                  <RocketLaunchIcon />
                  밋업 확인하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
