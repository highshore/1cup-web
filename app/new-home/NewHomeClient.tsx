"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import React from "react";
import Image from "next/image";
import "./new-home.css";
// GNB and Footer are now handled by the layout

// Imports for Meetup Event Display
import { useRouter } from "next/navigation";
import { MeetupEvent } from "../lib/features/meetup/types/meetup_types";
import { subscribeToUpcomingEvents } from "../lib/features/meetup/services/meetup_service";
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
import { supabase } from "../lib/supabase/client";
import MembershipSection from "./sections/MembershipSection";
import FaqSection from "./sections/FaqSection";
import CtaSection from "./sections/CtaSection";
import { useI18n } from "../lib/i18n/I18nProvider";

// The old createGlobalStyle lives in ./new-home.css; machine mode toggles the
// `nh-machine-mode` class on <html> (see effect inside NewHomeClient).

const SUPPORT_URL = "https://pf.kakao.com/_DxlPIn/chat";

const MEMBER_COMPANY_LOGOS = [
  { label: "SK하이닉스", src: "/assets/homepage/logos/sk-hynix.webp", width: 260, height: 129, scale: 1.04 },
  { label: "Samsung Foundry", src: "/assets/homepage/logos/samsung-foundry.svg", width: 640, height: 228, scale: 0.98 },
  { label: "PwC", src: "/assets/homepage/logos/pwc.webp", width: 600, height: 455, scale: 0.9 },
  { label: "쿠팡", src: "/assets/homepage/logos/coupang.webp", width: 320, height: 73, scale: 1.02 },
  { label: "SAP", src: "/assets/homepage/logos/sap.webp", width: 220, height: 109, scale: 0.94 },
  { label: "네슬레", src: "/assets/homepage/logos/nestle.webp", width: 165, height: 170, scale: 0.92 },
  { label: "고려대학교 의과대학", src: "/assets/homepage/logos/ku_medicine.webp", width: 680, height: 128, scale: 1 },
  { label: "고려대학교", src: "/assets/homepage/logos/korea-university.webp", width: 280, height: 93, scale: 1 },
  { label: "연세대학교 MBA", src: "/assets/homepage/logos/yonsei-university.webp", width: 280, height: 86, scale: 1 },
] as const;

const MEMBER_COMPANY_LOGO_ROWS = [
  MEMBER_COMPANY_LOGOS.filter((_, index) => index % 2 === 0),
  [
    ...MEMBER_COMPANY_LOGOS.filter((_, index) => index % 2 === 1).slice(1),
    MEMBER_COMPANY_LOGOS[1],
  ],
] as const;

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

// Pentagon of speakers around the cup. One leader (top) stands out; the four
// members are speech bubbles whose tails point inward toward the cup. Tail
// geometry is precomputed so each notch sits on the edge nearest the centre.
const DISCUSSION_SEATS = [
  { id: "lead", top: "17%", left: "50%", accent: "#050505", delay: "0s", leader: true },
  { id: "member-a", top: "47%", left: "81%", accent: "#2f3e50", delay: "0.55s", leader: false },
  { id: "member-b", top: "80%", left: "68%", accent: "#e0992b", delay: "1.1s", leader: false },
  { id: "member-c", top: "80%", left: "32%", accent: "#2f8f86", delay: "1.65s", leader: false },
  { id: "member-d", top: "47%", left: "19%", accent: "#7d9b4e", delay: "2.2s", leader: false },
] as const;

const NETWORKING_IMAGES = [
  { id: "member", src: "/assets/homepage/gallery1.webp", width: 900, height: 902, altKey: "member" },
  { id: "gallery-two", src: "/assets/homepage/gallery2.webp", width: 1100, height: 825, altKey: "galleryTwo" },
  { id: "gallery-three", src: "/assets/homepage/gallery3.webp", width: 1100, height: 825, altKey: "galleryThree", rotate: 90 },
  { id: "activity", src: "/assets/homepage/activity.webp", width: 768, height: 1024, altKey: "activity", objectPosition: "center 72%" },
] as const;

// Section title pill shared by the "모임 진행 방식" sections.
const sectionPillClass =
  "inline-flex max-w-[min(100%,18rem)] items-center justify-center mt-0 mx-0 mb-[0.85rem] border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] px-[0.72rem] py-[0.34rem] text-[0.78rem] font-black tracking-[0.02em] leading-[1.25] text-center whitespace-normal break-keep";

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

const HeroScrollCard = ({ meetup, maxAvatars = 5, onNavigate, userProfilesMap }: ScrollCardProps) => {
  const { t } = useI18n();
  const spotsTaken = meetup.leaders.length + meetup.participants.length;
  const spotsTotal = meetup.max_participants;
  const spotsLeft = Math.max(0, spotsTotal - spotsTaken);
  const isUrgent = spotsLeft <= 5; // Urgency threshold

  return (
    <div
      className="w-full bg-white rounded-[20px] overflow-hidden shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] relative flex flex-col [transition:transform_0.2s_ease,box-shadow_0.2s_ease] cursor-pointer hover:[transform:translateY(-2px)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] max-[768px]:min-h-[clamp(126px,30vw,148px)] max-[768px]:h-auto max-[768px]:flex-row max-[768px]:items-stretch max-[768px]:border max-[768px]:border-[rgba(255,255,255,0.92)] max-[768px]:rounded-[18px] max-[768px]:shadow-[0_18px_34px_rgba(16,185,129,0.18),0_16px_40px_rgba(0,0,0,0.24)] max-[768px]:hover:[transform:none] max-[768px]:hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]"
      onClick={() => onNavigate(meetup.id)}
    >
      <div className="w-full relative bg-[#f3f4f6] overflow-hidden before:content-[''] before:block before:pt-[75%] max-[768px]:w-[clamp(104px,27vw,132px)] max-[768px]:aspect-square max-[768px]:self-center max-[768px]:flex-[0_0_clamp(104px,27vw,132px)] max-[768px]:ml-[clamp(0.55rem,2vw,0.75rem)] max-[768px]:rounded-[14px] max-[768px]:bg-[#0f172a] max-[768px]:before:hidden">
        <img
          className="absolute inset-0 w-full h-full object-cover"
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
        <div className="absolute top-3 left-3 bg-[rgba(255,255,255,0.95)] py-1 px-[0.6rem] rounded-full text-[0.7rem] font-bold text-[#111827] shadow-[0_2px_4px_rgba(0,0,0,0.1)] flex items-center gap-[0.35rem] [&_span]:shadow-[0_0_0_2px_rgba(255,255,255,0.5)] [&_svg]:w-[13px] [&_svg]:h-[13px] max-[768px]:hidden">
          <SparklesIcon />
          {t.home.meetupCard.join}
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-3 bg-white max-[768px]:min-w-0 max-[768px]:p-[clamp(0.78rem,2.9vw,0.95rem)] max-[768px]:gap-[clamp(0.48rem,1.8vw,0.62rem)] max-[768px]:justify-center">
        <div>
          <h3 className="text-[1.1rem] font-bold text-[#111827] leading-[1.35] m-0 line-clamp-2 text-left max-[768px]:text-[clamp(0.88rem,3.25vw,1rem)] max-[768px]:leading-[1.28]">
            {meetup.title}
          </h3>
          <div className="flex flex-col gap-[0.35rem]" style={{ marginTop: '0.5rem' }}>
            <div className="flex items-center gap-2 text-[0.85rem] text-[#6b7280] font-medium [&_svg]:w-[0.9rem] [&_svg]:h-[0.9rem] [&_svg]:text-[#9ca3af] [&_svg]:shrink-0 max-[768px]:gap-[0.34rem] max-[768px]:text-[clamp(0.74rem,2.7vw,0.82rem)] max-[768px]:leading-[1.25] max-[768px]:[&_svg]:w-[0.78rem] max-[768px]:[&_svg]:h-[0.78rem]">
              <CalendarIconOutline />
              {formatEventDateTime(meetup)}
            </div>
            <div className="flex items-center gap-2 text-[0.85rem] text-[#6b7280] font-medium [&_svg]:w-[0.9rem] [&_svg]:h-[0.9rem] [&_svg]:text-[#9ca3af] [&_svg]:shrink-0 max-[768px]:gap-[0.34rem] max-[768px]:text-[clamp(0.74rem,2.7vw,0.82rem)] max-[768px]:leading-[1.25] max-[768px]:[&_svg]:w-[0.78rem] max-[768px]:[&_svg]:h-[0.78rem]">
              <MapPinIcon />
              {meetup.location_name}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1 pt-3 border-t border-[#f3f4f6] gap-3 w-full min-w-0 overflow-hidden flex-nowrap max-[768px]:mt-0 max-[768px]:pt-[0.56rem] max-[768px]:gap-[0.45rem]">
           <div className="flex-auto min-w-0 overflow-hidden flex items-center">
             <UserAvatarStack
                uids={[...meetup.leaders, ...meetup.participants]}
                maxAvatars={maxAvatars}
                size={32}
                userProfilesMap={userProfilesMap}
              />
           </div>
           <button
             className={`inline-flex items-center justify-center gap-2 min-h-[38px] py-[0.55rem] px-[0.9rem] rounded-full border-2 border-[#050505] [font-family:inherit] text-[0.82rem] font-extrabold cursor-pointer [transition:background-color_160ms_ease,border-color_160ms_ease,color_160ms_ease,transform_160ms_ease] whitespace-nowrap shrink-0 max-w-[58%] overflow-hidden text-ellipsis shadow-none hover:border-[#050505] hover:[transform:translateY(-1px)] hover:shadow-none active:[transform:translateY(0)] max-[768px]:min-h-8 max-[768px]:py-[0.38rem] max-[768px]:px-[0.7rem] max-[768px]:text-[clamp(0.68rem,2.45vw,0.76rem)] max-[768px]:max-w-[62%] ${
               isUrgent
                 ? "bg-[#fff8dc] text-[#050505] hover:bg-white"
                 : "bg-[#050505] text-white hover:bg-[#050505]"
             }`}
           >
             <span
               className={`inline-block flex-none w-[7px] h-[7px] rounded-full ${
                 isUrgent
                   ? "bg-[#e11d48] shadow-[0_0_0_3px_rgba(225,29,72,0.13)]"
                   : "bg-[#22c55e] shadow-[0_0_0_3px_rgba(34,197,94,0.16)]"
               }`}
             />
             {isUrgent
               ? t.home.meetupCard.almostFull
               : `${spotsTaken}/${spotsTotal} ${t.home.meetupCard.filled}`}
           </button>
        </div>
      </div>
    </div>
  );
};

// --- END: Hero Scroll Card ---

interface HomePageClientProps {
  initialUpcomingEvents?: MeetupEvent[];
  initialStats?: HomeStats;
  initialTopics?: HomeTopicArticle[];
}

type RenderMode = "human" | "machine";

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

  // Replacement for the old styled-components createGlobalStyle with the
  // $machineMode prop: the global rules live in ./new-home.css scoped under
  // html.nh-machine-mode, toggled here while machine mode is displayed.
  useEffect(() => {
    const root = document.documentElement;
    if (displayMode === "machine") {
      root.classList.add("nh-machine-mode");
    } else {
      root.classList.remove("nh-machine-mode");
    }
    return () => {
      root.classList.remove("nh-machine-mode");
    };
  }, [displayMode]);

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

  // The server render is intentionally only the first paint. Subscribe immediately so
  // the hero card always reflects the same Supabase meetup and participant rows as the
  // event detail page, including joins made after the page was built.
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

    let active = true;
    setLoadingEvent(true);

    const unsubscribe = subscribeToUpcomingEvents((events) => {
      if (!active) return;
      setUpcomingEvents(events);
      setClosestEvent(events[0] ?? null);
      setLoadingEvent(false);
      void loadUserProfiles(events);
    });

    return () => {
      active = false;
      unsubscribe();
    };
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
    <div
      className={`pt-0 flex flex-col min-h-screen [&_img]:[-webkit-user-drag:none] [&_img]:select-none ${
        displayMode === "machine" ? "bg-black" : "bg-transparent"
      }`}
      onContextMenu={handleHomepageContextMenu}
      onDragStart={handleHomepageDragStart}
    >
      {displayMode === "machine" ? (
        <main className="min-h-screen bg-black text-[#d7d7d7] pt-[clamp(4rem,7vw,6.5rem)] px-[clamp(1.25rem,12vw,11rem)] pb-[clamp(7rem,9vw,8rem)] animate-[nh-fade-in-up_420ms_ease_both] max-[768px]:pt-8 max-[768px]:px-[1.1rem] max-[768px]:pb-[6.5rem]">
          <pre className="w-full max-w-none m-0 border-0 bg-transparent p-0 text-[#d7d7d7] font-[ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation_Mono','Courier_New',monospace] text-[clamp(1rem,1.55vw,1.45rem)] leading-[1.65] whitespace-pre-wrap [word-break:break-word]">
            {markdownContent}
          </pre>
        </main>
      ) : (
        <>
          <section className="text-white py-[clamp(6rem,5vw,7.5rem)] px-0 relative overflow-hidden min-h-screen flex justify-center items-center max-[768px]:min-h-[100svh] max-[768px]:py-0">
            <video
              className="absolute top-1/2 left-1/2 w-full h-full object-cover [transform:translate(-50%,-50%)] z-0"
              autoPlay
              loop
              muted
              playsInline
              ref={videoRef}
            >
              <source src="/assets/homepage/alphabet.mp4" type="video/mp4" />
              {t.home.hero.videoUnsupported}
            </video>
            <div className="absolute top-0 left-0 w-full h-full bg-[rgba(4,4,20,0.5)] backdrop-blur-[2px] z-[1]" />

            <div className="max-w-page w-full mx-auto grid gap-12 items-center relative z-[2] px-6 min-[769px]:grid-cols-2 min-[769px]:gap-16 max-[768px]:w-[min(100%,580px)] max-[768px]:px-[clamp(1.15rem,4.4vw,1.75rem)] max-[768px]:flex max-[768px]:flex-col max-[768px]:gap-[clamp(1.35rem,4.8vw,1.9rem)] max-[768px]:items-center max-[768px]:justify-center max-[768px]:text-center max-[768px]:min-h-[100svh]">
              <div className="text-left z-10 max-[768px]:w-full max-[768px]:text-center max-[768px]:flex max-[768px]:flex-col max-[768px]:items-center max-[768px]:justify-center max-[768px]:gap-[clamp(0.95rem,3.5vw,1.25rem)] max-[768px]:pt-[clamp(4.3rem,14vw,5.8rem)] max-[768px]:pb-0 max-[768px]:px-0">
                <h1 className="max-[768px]:hidden text-[clamp(1.9rem,3.4vw,3rem)] font-extrabold leading-[1.2] text-white mb-6 whitespace-pre-wrap [text-shadow:0_4px_12px_rgba(0,0,0,0.3)]">
                  {t.home.hero.title}
                </h1>
                <h1 className="hidden max-[768px]:block text-[clamp(2.08rem,8.35vw,2.65rem)] font-[760] leading-[1.18] text-white mb-0 whitespace-pre-wrap [text-shadow:0_6px_16px_rgba(0,0,0,0.45)] tracking-[0]">
                  {t.home.hero.mobileTitle ?? t.home.hero.title}
                </h1>
                <p className="max-[768px]:hidden text-[clamp(1.05rem,1.8vw,1.25rem)] text-[rgba(255,255,255,0.9)] mb-10 font-medium leading-[1.6] max-w-[500px] whitespace-pre-wrap [text-shadow:0_2px_8px_rgba(0,0,0,0.2)]">
                  {t.home.hero.subtitle}
                </p>
                <p className="hidden max-[768px]:block text-[clamp(1.02rem,3.85vw,1.13rem)] text-[rgba(255,255,255,0.9)] mb-0 font-medium leading-[1.56] max-w-[380px] whitespace-pre-wrap [text-shadow:0_2px_8px_rgba(0,0,0,0.2)]">
                  {t.home.hero.mobileSubtitle ?? t.home.hero.subtitle}
                </p>
                <button
                  className="max-[768px]:hidden inline-flex min-h-[52px] items-center justify-center gap-2 py-3.5 px-[1.9rem] border-2 border-[#050505] rounded-full bg-white text-[#050505] text-[1rem] font-[850] cursor-pointer [transition:all_0.25s_ease] relative overflow-hidden [font-family:inherit] shadow-[5px_5px_0_#f47a4a] hover:bg-[#fff8dc] hover:border-[#050505] hover:shadow-[7px_7px_0_#f47a4a] hover:[transform:translate(-1px,-1px)] active:[transform:translateY(0)] [&_svg]:w-[18px] [&_svg]:h-[18px]"
                  onClick={() => router.push("/meetup")}
                >
                  <CalendarIconOutline />
                  {t.home.cta.button}
                </button>
              </div>

              <div className="relative w-full flex justify-center items-start px-[clamp(1rem,3vw,1.5rem)] max-[768px]:mt-0 max-[768px]:p-0 max-[768px]:items-center max-[768px]:flex-col max-[768px]:gap-0">
                <div className="relative w-full max-w-[380px] grid grid-cols-1 justify-items-stretch max-[768px]:max-w-full max-[768px]:pt-0 max-[768px]:pr-[14px] max-[768px]:pb-[18px] max-[768px]:pl-0">
                  {stackLayers.map((layer, index) => {
                    const isAnimating =
                      isStackSwapping && index === 0 && upcomingEvents.length >= 2;
                    const isInteractive = layer.type === "event" && index === 0;
                    const positionClasses =
                      index === 0
                        ? "z-[3] shadow-[0_35px_60px_-22px_rgba(15,23,42,0.45)]"
                        : index === 1
                          ? "z-[2] shadow-[0_28px_55px_-25px_rgba(15,23,42,0.32)]"
                          : "z-[1] shadow-[0_22px_45px_-30px_rgba(15,23,42,0.24)]";
                    const motionClasses = isAnimating
                      ? "[transform:translate(-18px,-22px)] opacity-0"
                      : index === 0
                        ? "[transform:translate(0px,0px)] opacity-100"
                        : index === 1
                          ? "[transform:translate(18px,18px)] max-[768px]:[transform:translate(7px,9px)] opacity-100 max-[768px]:opacity-[0.82]"
                          : "[transform:translate(36px,36px)] max-[768px]:[transform:translate(14px,18px)] opacity-75 max-[768px]:opacity-[0.56]";
                    return (
                      <div
                        key={layer.instanceKey}
                        className={`relative [grid-area:1/1] rounded-[20px] max-[768px]:rounded-[18px] origin-top [transition:transform_0.6s_cubic-bezier(0.25,0.8,0.25,1),opacity_0.6s_cubic-bezier(0.25,0.8,0.25,1),box-shadow_0.6s_cubic-bezier(0.25,0.8,0.25,1)] ${
                          isInteractive ? "pointer-events-auto" : "pointer-events-none"
                        } ${positionClasses} ${motionClasses}`}
                      >
                        {layer.type === "event" ? (
                          <HeroScrollCard
                            meetup={layer.event}
                            maxAvatars={maxAvatars}
                            onNavigate={handleEventNavigation}
                            userProfilesMap={userProfilesMap}
                          />
                        ) : (
                          <div className="w-full h-full rounded-[20px] border border-[rgba(255,255,255,0.95)] bg-[rgba(255,255,255,0.99)] shadow-[inset_0_1px_8px_rgba(0,0,0,0.05)]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="relative flex flex-col flex-1 bg-white isolate">
            <section className="w-full bg-[#111111] text-white pt-[clamp(3.5rem,7vw,5rem)] px-0 pb-[clamp(4rem,8vw,6rem)]">
              <div className="max-w-page mx-auto px-5 max-[768px]:px-4">
                <div className="max-w-3xl mb-12 max-[768px]:mx-auto max-[768px]:mt-0 max-[768px]:mb-9 max-[768px]:text-center">
                  <h2 className="m-0 text-white font-['Noto_Sans_KR',sans-serif] text-[clamp(1.6rem,2.4vw,2.05rem)] font-black leading-[1.2] tracking-[0] max-[768px]:text-center">
                    {t.home.memberLogos.titleLine1}
                    <br />
                    <span className="text-[#f47a4a]">
                      {t.home.memberLogos.titleHighlight}
                    </span>
                    {t.home.memberLogos.titleLine2Suffix}
                  </h2>
                </div>
                <div
                  className="overflow-hidden relative grid gap-[1.05rem] m-0 p-0 [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)] max-[768px]:gap-[0.8rem] max-[768px]:[mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]"
                  aria-label={t.home.memberLogos.additionalAria}
                >
                  {MEMBER_COMPANY_LOGO_ROWS.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className={`flex w-max items-center gap-[clamp(2.1rem,5vw,4.6rem)] will-change-transform motion-reduce:animate-none ${
                        rowIndex === 1
                          ? "animate-[nh-logo-marquee-reverse_34s_linear_infinite]"
                          : "animate-[nh-logo-marquee-forward_38s_linear_infinite]"
                      }`}
                    >
                      {[...row, ...row].map((company, copyIndex) => {
                        const logoIndex = MEMBER_COMPANY_LOGOS.indexOf(company);
                        return (
                          <div
                            key={`${company.label}-${copyIndex}`}
                            className="flex box-border w-[clamp(10.5rem,17vw,13rem)] h-[clamp(5.2rem,9vw,6.4rem)] flex-none items-center justify-center rounded-xl bg-white py-[0.9rem] px-[1.3rem] max-[768px]:w-36 max-[768px]:h-[5.15rem] max-[768px]:rounded-[10px] max-[768px]:py-3 max-[768px]:px-4"
                          >
                            <div className="grid w-full h-full place-items-center min-w-0 [&_img]:block [&_img]:w-full [&_img]:max-w-full [&_img]:h-full [&_img]:max-h-[52px] [&_img]:object-contain [&_img]:object-center max-[768px]:[&_img]:max-h-[40px]">
                              <Image
                                src={company.src}
                                alt={t.home.memberLogos.items[logoIndex] ?? company.label}
                                width={company.width}
                                height={company.height}
                                sizes="(max-width: 768px) 108px, 152px"
                                loading="lazy"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <div className="relative overflow-hidden bg-[#f3f3f1] isolate before:absolute before:inset-0 before:z-0 before:content-[''] before:[background:linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0)_18%),radial-gradient(circle_at_76%_18%,rgba(244,122,74,0.06),transparent_24rem),radial-gradient(circle_at_16%_62%,rgba(5,5,5,0.045),transparent_28rem)]">
              <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
                <svg
                  className="desktop-route absolute top-[clamp(3rem,5vw,4.4rem)] left-1/2 w-[min(1120px,calc(100%_-_2rem))] h-[calc(100%_-_clamp(6rem,10vw,8rem))] overflow-visible [transform:translateX(-50%)] max-[820px]:hidden"
                  viewBox="0 0 1000 1680"
                  preserveAspectRatio="none"
                >
                  <path
                    className="route-shadow fill-none stroke-[rgba(244,122,74,0.11)] [stroke-width:8] [stroke-linecap:round] [stroke-linejoin:round] [filter:drop-shadow(0_0_8px_rgba(244,122,74,0.11))] [vector-effect:non-scaling-stroke]"
                    d="M 130 115 C 245 58 366 112 365 202 C 364 278 255 296 230 224 C 200 136 337 107 454 180 C 548 238 635 226 732 176 C 832 125 918 205 900 324 C 878 468 748 465 704 560 C 657 662 794 713 782 810 C 768 929 618 924 508 865 C 386 799 270 866 252 988 C 232 1118 372 1182 506 1132 C 646 1080 798 1168 768 1322 C 742 1457 579 1472 460 1438 C 350 1406 246 1432 176 1518"
                  />
                  <path
                    className="route-line fill-none stroke-[rgba(244,122,74,0.28)] [stroke-width:1.9] [stroke-linecap:round] [stroke-linejoin:round] [stroke-dasharray:12_14] [filter:drop-shadow(0_0_5px_rgba(244,122,74,0.13))] [vector-effect:non-scaling-stroke]"
                    d="M 130 115 C 245 58 366 112 365 202 C 364 278 255 296 230 224 C 200 136 337 107 454 180 C 548 238 635 226 732 176 C 832 125 918 205 900 324 C 878 468 748 465 704 560 C 657 662 794 713 782 810 C 768 929 618 924 508 865 C 386 799 270 866 252 988 C 232 1118 372 1182 506 1132 C 646 1080 798 1168 768 1322 C 742 1457 579 1472 460 1438 C 350 1406 246 1432 176 1518"
                  />
                </svg>
                <svg
                  className="mobile-route absolute left-1/2 overflow-visible [transform:translateX(-50%)] hidden max-[820px]:block max-[820px]:top-9 max-[820px]:w-[calc(100%_-_1.5rem)] max-[820px]:h-[calc(100%_-_4rem)]"
                  viewBox="0 0 360 1900"
                  preserveAspectRatio="none"
                >
                  <path
                    className="route-shadow fill-none stroke-[rgba(244,122,74,0.11)] [stroke-width:7] [stroke-linecap:round] [stroke-linejoin:round] [filter:drop-shadow(0_0_8px_rgba(244,122,74,0.11))] [vector-effect:non-scaling-stroke]"
                    d="M 178 92 C 94 172 96 300 176 352 C 260 406 270 532 184 596 C 92 665 106 820 204 884 C 290 940 284 1074 190 1138 C 96 1202 92 1364 190 1432 C 274 1490 278 1632 182 1716"
                  />
                  <path
                    className="route-line fill-none stroke-[rgba(244,122,74,0.28)] [stroke-width:1.65] [stroke-linecap:round] [stroke-linejoin:round] [stroke-dasharray:10_12] [filter:drop-shadow(0_0_5px_rgba(244,122,74,0.13))] [vector-effect:non-scaling-stroke]"
                    d="M 178 92 C 94 172 96 300 176 352 C 260 406 270 532 184 596 C 92 665 106 820 204 884 C 290 940 284 1074 190 1138 C 96 1202 92 1364 190 1432 C 274 1490 278 1632 182 1716"
                  />
                </svg>
              </div>
              <section className="relative z-[1] w-full text-[#0f172a] py-[clamp(4rem,7vw,5.5rem)] px-0">
                <div className="relative max-w-page mx-auto px-5 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-[clamp(2rem,5vw,3.5rem)] items-center max-[820px]:grid-cols-1 max-[820px]:px-4 max-[820px]:text-center">
                  <div className="max-w-md max-[820px]:max-w-full">
                    <p className={`${sectionPillClass} max-[768px]:max-w-full`}>
                      {t.home.topicVideo.sectionTitle}
                    </p>
                    <h2 className="m-0 text-[#0f172a] font-['Noto_Sans_KR',sans-serif] text-[clamp(1.6rem,2.4vw,2.05rem)] font-black leading-[1.18] tracking-[0] whitespace-pre-line break-keep">
                      {t.home.topicVideo.title}
                    </h2>
                    <p className="mt-[1.2rem] mb-0 mx-0 text-[#475569] text-[clamp(0.98rem,1.5vw,1.08rem)] font-[560] leading-[1.65] whitespace-pre-line break-keep">
                      {t.home.topicVideo.description}
                    </p>
                    <p className="mt-3 mb-0 mx-0 text-[rgba(100,116,139,0.66)] text-[0.76rem] font-[520] leading-[1.55] break-keep">
                      {t.home.topicVideo.caveat}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="relative w-full aspect-video overflow-hidden border-2 border-[#050505] rounded-[14px] bg-[#0f172a] shadow-[5px_5px_0_rgba(5,5,5,0.88)]">
                      <iframe
                        className="absolute inset-0 w-full h-full border-0"
                        src="https://www.youtube-nocookie.com/embed/yKtw4of-j0E?start=2143&end=2203&rel=0&modestbranding=1"
                        title={t.home.topicVideo.videoTitle}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <div className="mt-[0.9rem] flex items-center justify-end gap-4 text-[#334155] text-[0.84rem] font-[760] text-right max-[768px]:justify-center max-[768px]:items-center max-[768px]:flex-col max-[768px]:gap-[0.35rem] max-[768px]:text-center">
                      <span>{t.home.topicVideo.videoTitle}</span>
                    </div>
                  </div>
                </div>
              </section>
              <section className="relative z-[1] w-full text-[#0f172a] pt-0 px-0 pb-[clamp(4.5rem,8vw,6rem)] overflow-hidden">
                <div className="relative max-w-page mx-auto px-5 max-[768px]:px-4">
                  <div className="grid justify-items-end mb-[clamp(2rem,5vw,3rem)] text-right max-[820px]:justify-items-center max-[820px]:text-center">
                    <div>
                      <p className={sectionPillClass}>
                        {t.home.leaderMethod.sectionTitle}
                      </p>
                      <h2 className="max-w-[35rem] m-0 text-[#0f172a] font-['Noto_Sans_KR',sans-serif] text-[clamp(1.6rem,2.4vw,2.05rem)] font-black leading-[1.18] tracking-[0] whitespace-pre-line break-keep max-[820px]:max-w-full max-[820px]:text-center">
                        {t.home.leaderMethod.title}
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(280px,0.86fr)_minmax(0,1.14fr)] gap-[clamp(1.25rem,4vw,2rem)] items-center max-[860px]:grid-cols-1">
                    <div
                      className="relative w-[min(100%,420px,72vw)] aspect-square justify-self-center self-center overflow-visible"
                      aria-hidden="true"
                    >
                      <svg
                        className="absolute inset-0 z-0 w-full h-full overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {DISCUSSION_SEATS.map((seat) => (
                          <line
                            key={seat.id}
                            className="stroke-[#050505] [stroke-width:0.9] [stroke-dasharray:2.4_2.6] [stroke-linecap:round] opacity-50"
                            x1="50"
                            y1="52"
                            x2={parseFloat(seat.left)}
                            y2={parseFloat(seat.top)}
                          />
                        ))}
                      </svg>
                      <div className="absolute z-[3] top-[52%] left-1/2 grid place-items-center w-[33%] h-[33%] border-[3px] border-[#050505] rounded-full bg-white shadow-[5px_5px_0_#f47a4a] [transform:translate(-50%,-50%)]">
                        <svg className="w-[74%] h-[74%] overflow-visible" viewBox="0 0 64 64" fill="none">
                          <path
                            className="steam steam-1 [transform-box:fill-box] [transform-origin:center_bottom] animate-[nh-leader-steam-rise_2.8s_ease-in-out_infinite]"
                            d="M24 26 C21 22 27 20 24 16 C22 13 26 11 24 8"
                            stroke="#f47a4a"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                          <path
                            className="steam steam-2 [transform-box:fill-box] [transform-origin:center_bottom] animate-[nh-leader-steam-rise_2.8s_ease-in-out_infinite] [animation-delay:0.55s]"
                            d="M31 27 C28 22 34 20 31 15 C29 11 33 9 31 6"
                            stroke="#f47a4a"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                          <path
                            className="steam steam-3 [transform-box:fill-box] [transform-origin:center_bottom] animate-[nh-leader-steam-rise_2.8s_ease-in-out_infinite] [animation-delay:1.1s]"
                            d="M38 26 C35 22 41 20 38 16 C36 13 40 11 38 8"
                            stroke="#f47a4a"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                          <path
                            d="M15 32 H45 L40 52 Q30.5 56 21 52 Z"
                            fill="#ffffff"
                            stroke="#050505"
                            strokeWidth="3.4"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M45 36 C54 36 54 48 43 48"
                            fill="none"
                            stroke="#050505"
                            strokeWidth="3.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      {DISCUSSION_SEATS.map((seat) => (
                        <div
                          key={seat.id}
                          className={`absolute grid place-items-center aspect-square rounded-full border-solid border-[#050505] [transform:translate(-50%,-50%)] animate-[nh-leader-bubble-pop_0.7s_cubic-bezier(0.34,1.56,0.64,1)_both,nh-leader-bubble-bob_4.4s_ease-in-out_infinite] ${
                            seat.leader
                              ? "z-[6] w-[clamp(4.7rem,9.4vw,5.5rem)] border-[3px] bg-[#f47a4a] shadow-[4px_4px_0_#050505]"
                              : "z-[5] w-[clamp(3.9rem,7.6vw,4.6rem)] border-[2.5px] bg-white shadow-[3px_3px_0_#050505]"
                          }`}
                          style={{
                            top: seat.top,
                            left: seat.left,
                            animationDelay: `${seat.delay}, calc(${seat.delay} + 0.7s)`,
                          }}
                        >
                          {seat.leader && (
                            <span className="absolute z-[7] top-[-44%] left-1/2 w-[60%] [transform:translateX(-50%)] pointer-events-none">
                              <svg className="block w-full h-auto" viewBox="0 0 28 18" fill="none">
                                <path
                                  d="M3 16 L3 6 L9 11 L14 2 L19 11 L25 6 L25 16 Z"
                                  fill="#f47a4a"
                                  stroke="#050505"
                                  strokeWidth="2.2"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                          <span className="flex items-center gap-[0.18rem]">
                            <span
                              className={`rounded-full animate-[nh-leader-typing-bounce_1.4s_ease-in-out_infinite] ${
                                seat.leader ? "w-[0.36rem] h-[0.36rem]" : "w-[0.3rem] h-[0.3rem]"
                              }`}
                              style={{ background: seat.leader ? "#ffffff" : seat.accent }}
                            />
                            <span
                              className={`rounded-full animate-[nh-leader-typing-bounce_1.4s_ease-in-out_infinite] [animation-delay:0.2s] ${
                                seat.leader ? "w-[0.36rem] h-[0.36rem]" : "w-[0.3rem] h-[0.3rem]"
                              }`}
                              style={{ background: seat.leader ? "#ffffff" : seat.accent }}
                            />
                            <span
                              className={`rounded-full animate-[nh-leader-typing-bounce_1.4s_ease-in-out_infinite] [animation-delay:0.4s] ${
                                seat.leader ? "w-[0.36rem] h-[0.36rem]" : "w-[0.3rem] h-[0.3rem]"
                              }`}
                              style={{ background: seat.leader ? "#ffffff" : seat.accent }}
                            />
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid content-start gap-4">
                      <div
                        className="inline-grid grid-cols-[repeat(2,minmax(88px,1fr))] gap-[0.35rem] border-2 border-[#050505] rounded-full bg-white p-[0.35rem] shadow-[3px_3px_0_#f47a4a] max-[820px]:justify-self-center"
                        aria-label={t.home.leaderMethod.locationTabsAria}
                      >
                        {LEADER_LOCATIONS.map((location) => {
                          const active = selectedLeaderLocation === location;
                          return (
                            <button
                              key={location}
                              type="button"
                              className={`min-h-9 border-0 rounded-full py-[0.42rem] px-[0.95rem] [font-family:inherit] text-[0.84rem] font-extrabold cursor-pointer [transition:background_180ms_ease,color_180ms_ease,transform_180ms_ease] hover:[transform:translateY(-1px)] ${
                                active
                                  ? "bg-[#050505] text-white hover:text-white"
                                  : "bg-transparent text-[#475569] hover:text-[#0f172a]"
                              }`}
                              onClick={() => handleLeaderLocationChange(location)}
                            >
                              {t.home.leaderMethod.locations[location]}
                            </button>
                          );
                        })}
                      </div>

                      {visibleLeaders.length > 0 ? (
                        <div className="grid gap-3" aria-label={t.home.leaderMethod.profilesAria}>
                          {visibleLeaders.map((leader) => {
                            const hasLeaderDetails =
                              leader.bullets.length > 0 ||
                              Boolean(leader.readingStyle) ||
                              Boolean(leader.linkedinUrl);
                            const isActive = activeLeader?.id === leader.id;

                            return (
                              <article
                                key={leader.id}
                                className={`overflow-hidden border-2 border-[#050505] rounded-[14px] bg-white [transition:border-color_180ms_ease,box-shadow_180ms_ease,background_180ms_ease] ${
                                  isActive
                                    ? "shadow-[5px_5px_0_#f47a4a]"
                                    : "shadow-[3px_3px_0_rgba(5,5,5,0.82)]"
                                }`}
                              >
                                <button
                                  type="button"
                                  className="w-full border-0 bg-transparent py-[0.95rem] px-4 text-[#0f172a] [font-family:inherit] text-left cursor-pointer focus-visible:[outline:2px_solid_#f47a4a] focus-visible:[outline-offset:-4px]"
                                  aria-expanded={isActive}
                                  aria-disabled={!hasLeaderDetails}
                                  onClick={() =>
                                    hasLeaderDetails &&
                                    setActiveLeaderId(isActive ? "" : leader.id)
                                  }
                                >
                                  <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-[0.8rem] items-center">
                                    <span
                                      className="grid w-[3.15rem] h-[3.15rem] place-items-center overflow-hidden border-2 border-[#050505] rounded-full text-white text-[1.1rem] font-[950] leading-none shadow-[2px_2px_0_rgba(5,5,5,0.9)] [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                                      style={{ background: leader.accent }}
                                    >
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
                                    </span>
                                    <span>
                                      <strong className="block text-[#050505] text-[1rem] font-[920] leading-[1.22]">
                                        {leader.name}{" "}
                                        <span className="text-[rgba(5,5,5,0.58)] font-[760]">
                                          | {leader.role}
                                        </span>
                                      </strong>
                                    </span>
                                    {hasLeaderDetails && (
                                      <span
                                        className={`grid w-[1.8rem] h-[1.8rem] place-items-center border border-[rgba(15,23,42,0.08)] rounded-full bg-[#f3f3f1] text-[#050505] text-[1.3rem] font-medium ${
                                          isActive
                                            ? "before:content-['−']"
                                            : "before:content-['+']"
                                        }`}
                                        aria-hidden="true"
                                      />
                                    )}
                                  </span>
                                </button>
                                {hasLeaderDetails && (
                                  <div
                                    className={`grid [transition:grid-template-rows_240ms_ease,opacity_180ms_ease] ${
                                      isActive
                                        ? "grid-rows-[1fr] opacity-100"
                                        : "grid-rows-[0fr] opacity-0"
                                    }`}
                                    aria-hidden={!isActive}
                                  >
                                    <div className="min-h-0 overflow-hidden">
                                      <div className="pt-0 pr-4 pb-4 pl-20 max-[520px]:pl-4">
                                        {leader.bullets.length > 0 && (
                                          <div className="m-0 p-0">
                                            <ul className="grid gap-[0.46rem] m-0 p-0 list-none">
                                              {leader.bullets.map((bullet) => (
                                                <li
                                                  key={bullet.text}
                                                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-[0.48rem] items-start text-[rgba(5,5,5,0.74)] text-[0.86rem] font-[720] leading-[1.48] break-keep"
                                                >
                                                  <span
                                                    className="inline-flex w-5 justify-center"
                                                    aria-hidden="true"
                                                  >
                                                    {getLeaderBulletEmoji(bullet.icon)}
                                                  </span>
                                                  <span>{bullet.text}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {leader.readingStyle && (
                                          <div className="mt-[0.9rem] border border-[rgba(5,5,5,0.12)] rounded-[10px] bg-[#f3f3f1] py-[0.78rem] px-[0.85rem] text-[rgba(5,5,5,0.72)] text-[0.84rem] font-[680] leading-[1.55] break-keep">
                                            <strong className="block mb-[0.35rem] text-[#050505] text-[0.74rem] font-[920] tracking-[0.04em]">
                                              {t.home.leaderMethod.readingStyleLabel}
                                            </strong>
                                            <span>{leader.readingStyle}</span>
                                          </div>
                                        )}
                                        {leader.linkedinUrl && (
                                          <a
                                            href={leader.linkedinUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-[0.95rem] inline-flex min-h-[38px] items-center justify-center gap-2 border-2 border-[#050505] rounded-full bg-[#0a66c2] text-white py-2 px-[0.9rem] text-[0.82rem] font-[880] no-underline shadow-[3px_3px_0_#050505] [transition:background-color_180ms_ease,box-shadow_180ms_ease,transform_180ms_ease] hover:bg-[#004182] hover:text-white hover:no-underline hover:[transform:translate(-1px,-1px)] hover:shadow-[4px_4px_0_#050505] [&_svg]:w-4 [&_svg]:h-4"
                                          >
                                            LinkedIn
                                            <ArrowTopRightOnSquareIcon aria-hidden="true" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid min-h-[250px] place-items-center border border-dashed border-[rgba(15,23,42,0.18)] rounded-3xl bg-[rgba(255,255,255,0.58)] p-8 text-[#64748b] text-center font-[720] leading-[1.55]">
                          <div>
                            <strong>{t.home.leaderMethod.emptyTitle}</strong>
                            <br />
                            {t.home.leaderMethod.emptyDescription}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
              <section className="relative z-[1] w-full text-[#0f172a] pt-0 px-0 pb-[clamp(2rem,4vw,3rem)] overflow-hidden">
                <div className="relative max-w-page mx-auto px-5 max-[768px]:px-4">
                  <div className="max-w-[44rem] mt-0 mx-0 mb-[clamp(1.5rem,4vw,2.4rem)] max-[768px]:mx-auto max-[768px]:text-center">
                    <p className={`${sectionPillClass} max-[768px]:max-w-full`}>
                      {t.home.networkingMethod.sectionTitle}
                    </p>
                    <h2 className="m-0 text-[#0f172a] font-['Noto_Sans_KR',sans-serif] text-[clamp(1.6rem,2.4vw,2.05rem)] font-black leading-[1.18] tracking-[0] whitespace-pre-line break-keep">
                      {t.home.networkingMethod.title}
                    </h2>
                    <p className="max-w-lg mt-4 mb-0 mx-0 text-[#64748b] text-[0.98rem] font-[620] leading-[1.65] break-keep max-[768px]:mx-auto max-[768px]:text-center">
                      {t.home.networkingMethod.description}
                    </p>
                  </div>
                  <div className="flex max-w-full gap-[clamp(0.85rem,2vw,1.1rem)] overflow-x-auto overflow-y-hidden pt-0 px-0 pb-4 [scroll-padding:0] snap-x snap-mandatory [scrollbar-width:thin] [scrollbar-color:rgba(15,23,42,0.28)_transparent] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(15,23,42,0.24)]">
                    {networkingImages.map((image) => {
                      const objectPosition =
                        "objectPosition" in image ? image.objectPosition : undefined;
                      const rotate = "rotate" in image ? image.rotate : undefined;
                      return (
                        <figure
                          key={image.id}
                          className="flex-[0_0_min(78vw,420px)] aspect-[4/3] m-0 overflow-hidden rounded-[14px] bg-white snap-start shadow-[0_18px_52px_rgba(15,23,42,0.08)] max-[760px]:basis-[min(84vw,340px)] max-[760px]:rounded-xl"
                        >
                          <Image
                            className="block w-full h-full object-cover origin-center"
                            src={image.src}
                            alt={image.alt}
                            width={image.width}
                            height={image.height}
                            sizes="(max-width: 760px) 84vw, 420px"
                            loading="lazy"
                            style={{
                              objectPosition: objectPosition ?? "center center",
                              transform: rotate
                                ? `rotate(${rotate}deg) scale(1.34)`
                                : "none",
                            }}
                          />
                        </figure>
                      );
                    })}
                  </div>
                </div>
              </section>
              <StatsSection stats={homeStats} />
            </div>
            <TopicsShowcase topics={initialTopics || []} />
            <MembershipSection />
            <FaqSection />
            <CtaSection />
          </div>
        </>
      )}
      {displayMode === "human" && (
        <a
          className="fixed right-[clamp(1rem,3vw,1.5rem)] bottom-[calc(1.45rem_+_env(safe-area-inset-bottom))] z-[61] inline-flex items-center gap-[0.48rem] min-h-12 py-[0.55rem] pr-[0.78rem] pl-[0.6rem] border-2 border-[#050505] rounded-full bg-white text-[#050505] text-[0.82rem] font-black no-underline shadow-[4px_4px_0_#f47a4a] animate-[nh-support-bob_3.2s_ease-in-out_infinite] [transition:background-color_180ms_ease,box-shadow_180ms_ease,transform_180ms_ease] hover:bg-[#fff8dc] hover:shadow-[6px_6px_0_#f47a4a] hover:[transform:translate(-1px,-1px)] focus-visible:[outline:3px_solid_rgba(244,122,74,0.38)] focus-visible:[outline-offset:3px] motion-reduce:animate-none max-[620px]:right-[calc(0.9rem_+_env(safe-area-inset-right))] max-[620px]:bottom-[calc(0.9rem_+_env(safe-area-inset-bottom))] max-[620px]:box-border max-[620px]:p-2 max-[620px]:w-[52px] max-[620px]:h-[52px] max-[620px]:justify-center max-[620px]:gap-0 max-[620px]:shadow-[3px_3px_0_#f47a4a] max-[620px]:animate-none"
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          aria-label={t.home.support.ariaLabel}
        >
          <span
            className="relative inline-grid place-items-center w-8 h-8 flex-none border-2 border-[#050505] rounded-full bg-[#f47a4a] [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:[stroke-width:2.4] after:content-[''] after:absolute after:top-1 after:right-[5px] after:w-[6px] after:h-[6px] after:border-[1.5px] after:border-[#050505] after:rounded-full after:bg-white"
            aria-hidden="true"
          >
            <ChatBubbleOvalLeftEllipsisIcon />
          </span>
          <span className="whitespace-nowrap max-[620px]:absolute max-[620px]:w-px max-[620px]:h-px max-[620px]:p-0 max-[620px]:-m-px max-[620px]:overflow-hidden max-[620px]:[clip:rect(0,0,0,0)] max-[620px]:border-0">
            {t.home.support.label}
          </span>
        </a>
      )}
      <div
        className="fixed left-1/2 bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] z-[60] inline-flex items-center [transform:translateX(-50%)] border-2 border-[#050505] rounded-full bg-white p-[3px] whitespace-nowrap shadow-[4px_4px_0_#f47a4a] [transition:border-color_360ms_ease,background-color_360ms_ease,box-shadow_360ms_ease,filter_360ms_ease] max-[480px]:bottom-[calc(0.9rem_+_env(safe-area-inset-bottom))] max-[480px]:shadow-[3px_3px_0_#f47a4a]"
        aria-label={t.home.renderMode.ariaLabel}
      >
        <div
          className={`relative grid grid-cols-[repeat(2,minmax(78px,1fr))] isolate overflow-hidden rounded-full max-[480px]:grid-cols-[repeat(2,minmax(64px,1fr))] before:absolute before:top-0 before:bottom-0 before:left-0 before:z-[-1] before:w-1/2 before:rounded-full before:bg-[#050505] before:shadow-none before:content-[''] before:[transition:transform_420ms_cubic-bezier(0.19,1,0.22,1)] ${
            renderMode === "machine"
              ? "before:[transform:translateX(100%)]"
              : "before:[transform:translateX(0)]"
          }`}
        >
          <button
            type="button"
            className={`min-w-0 border-0 rounded-full bg-transparent py-2 px-[0.72rem] [font-family:inherit] text-[0.76rem] font-black tracking-[0] cursor-pointer [transition:color_280ms_ease,transform_280ms_ease] max-[480px]:py-[0.46rem] max-[480px]:px-[0.58rem] max-[480px]:text-[0.72rem] ${
              renderMode === "human"
                ? "text-white [transform:translateY(-1px)] hover:text-white"
                : "text-[rgba(5,5,5,0.66)] hover:text-[#050505]"
            }`}
            onClick={handleHumanMode}
          >
            {t.home.renderMode.human}
          </button>
          <button
            type="button"
            className={`min-w-0 border-0 rounded-full bg-transparent py-2 px-[0.72rem] [font-family:inherit] text-[0.76rem] font-black tracking-[0] cursor-pointer [transition:color_280ms_ease,transform_280ms_ease] max-[480px]:py-[0.46rem] max-[480px]:px-[0.58rem] max-[480px]:text-[0.72rem] ${
              renderMode === "machine"
                ? "text-white [transform:translateY(-1px)] hover:text-white"
                : "text-[rgba(5,5,5,0.66)] hover:text-[#050505]"
            }`}
            onClick={handleMachineMode}
          >
            {t.home.renderMode.machine}
          </button>
        </div>
      </div>
    </div>
  );
}
