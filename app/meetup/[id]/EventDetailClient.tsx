"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import "./event-detail.css";
import {
  MeetupEvent,
  Article,
} from "../../lib/features/meetup/types/meetup_types";
import {
  subscribeToEvent,
  joinEventAsRole,
  cancelParticipation,
  fetchArticlesByIds,
  removeParticipant,
  changeUserRole,
  deleteMeetupEvent,
} from "../../lib/features/meetup/services/meetup_service";
import { supabase, invokeFunction } from "../../lib/supabase/client";
import {
  formatEventDateTime,
  isEventLocked,
  sampleTopics,
  formatEventTitleWithCountdown,
} from "../../lib/features/meetup/utils/meetup_helpers";
import { UserAvatar } from "../../lib/features/meetup/components/user_avatar";
import { hasActiveSubscription } from "../../lib/features/meetup/services/user_service";
import { useAuth } from "../../lib/contexts/auth_context";
import AdminEventDialog from "../../lib/features/meetup/components/admin_event_dialog";
import {
  PinIcon,
  CalendarIcon,
  ClockIcon,
  JoinIcon,
  CancelIcon,
} from "../../lib/features/meetup/components/meetup_icons";
import { naverMapsScriptSrc } from "../../lib/constants/naver_maps";
import GlobalLoadingScreen from "../../lib/components/GlobalLoadingScreen";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragOverlay } from "@dnd-kit/core";
import {
  PencilSquareIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  PhotoIcon,
  UsersIcon,
  MegaphoneIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// TypeScript declarations for Naver Maps
declare global {
  interface Window {
    naver: any;
    initNaverMaps?: () => void;
    navermap_authFailure?: () => void;
  }
}

// Interface for user data including phone numbers
interface UserWithDetails {
  uid: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  phoneLast4?: string;
}

// Interface for seating arrangement
interface SeatingAssignment {
  sessionNumber: 1 | 2;
  leaderUid: string;
  leaderDetails: UserWithDetails;
  participants: UserWithDetails[];
  transcriptId?: string; // Optional transcript ID if one has been created
}

// Interface for saved seating data
interface SavedSeatingArrangement {
  assignments: SeatingAssignment[];
  generatedAt: Date;
  generatedBy: string;
}

// Presentational components (Tailwind) - Day Mode Theme
type DivProps = React.ComponentPropsWithRef<"div">;
type SpanProps = React.ComponentPropsWithRef<"span">;
type ButtonProps = React.ComponentPropsWithRef<"button">;

const Container: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`min-h-screen w-full bg-transparent pt-3 pb-[clamp(2.5rem,5vw,3rem)] text-[#333] max-[768px]:overflow-x-hidden max-[768px]:pt-2 max-[768px]:pb-[clamp(2rem,6vw,2.5rem)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SliderImage: React.FC<
  React.ComponentPropsWithRef<"img"> & { $active: boolean }
> = ({ $active, className = "", ...rest }) => (
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  <img
    className={`absolute top-0 left-0 h-full w-full object-contain [transition:opacity_0.3s_ease-in-out] ${
      $active ? "opacity-100" : "opacity-0"
    } ${className}`}
    {...rest}
  />
);

const categoryTagStyle = (category: string): React.CSSProperties => {
  switch (category.toLowerCase()) {
    case "discussion":
      return { backgroundColor: "#e3f2fd", color: "#1976d2" };
    case "movie night":
      return { backgroundColor: "#ffebee", color: "#d32f2f" };
    case "picnic":
      return { backgroundColor: "#e8f5e8", color: "#388e3c" };
    case "socializing":
      return { backgroundColor: "#fff3e0", color: "#f57c00" };
    default:
      return { backgroundColor: "#f5f5f5", color: "#666" };
  }
};

const CategoryTag: React.FC<DivProps & { $category: string }> = ({
  $category,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-4 inline-flex items-center gap-2 rounded-[20px] px-4 py-2 text-[14px] font-semibold max-[768px]:mb-3 max-[768px]:rounded-[12px] max-[768px]:px-3 max-[768px]:py-1.5 max-[768px]:text-[12px] ${className}`}
    style={categoryTagStyle($category)}
    {...rest}
  >
    {children}
  </div>
);

const CountdownPrefix: React.FC<SpanProps & { $isUrgent?: boolean }> = ({
  $isUrgent,
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`${$isUrgent ? "font-bold text-[#DC143C]" : ""} ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const SectionTitle: React.FC<React.ComponentPropsWithRef<"h2">> = ({
  className = "",
  children,
  ...rest
}) => (
  <h2
    className={`mx-0 mt-6 mb-4 text-[24px] font-bold text-[#333] max-[768px]:mt-5 max-[768px]:mb-3 max-[768px]:text-[20px] ${className}`}
    {...rest}
  >
    {children}
  </h2>
);

const DetailRow: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-[8px] flex items-start gap-[8px] max-[768px]:mb-[6px] max-[768px]:gap-[6px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const DetailIcon: React.FC<SpanProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`mt-[3px] flex shrink-0 items-center text-[#666] max-[768px]:mt-[2px] ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const DetailText: React.FC<SpanProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`break-words text-[16px] leading-[1.4] text-[#333] max-[768px]:text-[14px] max-[768px]:leading-[1.3] ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const MapLoadingPlaceholder: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`my-4 flex h-[300px] items-center justify-center rounded-[12px] border border-solid border-[#e0e0e0] bg-[#f5f5f5] text-[1rem] text-[#999] max-[768px]:my-3 max-[768px]:h-[250px] max-[768px]:rounded-[8px] max-[768px]:text-[0.875rem] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ParticipantsGrid: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`my-2 flex flex-wrap gap-[8px] max-[768px]:my-1.5 max-[768px]:gap-[6px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ArticleTopicCard: React.FC<DivProps & { $gdg?: boolean }> = ({
  $gdg,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`my-2 flex cursor-pointer items-center gap-2 rounded-[12px] p-4 [transition:all_0.2s] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:[transform:translateY(-1px)] max-[768px]:my-1.5 max-[768px]:rounded-[8px] max-[768px]:p-3 ${
      $gdg
        ? "border-2 border-solid border-transparent [background:linear-gradient(#ffffff,#ffffff)_padding-box,linear-gradient(45deg,#4285f4,#db4437)_border-box]"
        : "border border-solid border-[#e0e0e0] bg-white"
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ArticleTopicNumber: React.FC<SpanProps & { $isGdg?: boolean }> = ({
  $isGdg,
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`mr-2 aspect-square h-[24px] w-[24px] shrink-0 rounded-full bg-[#333] text-center text-[12px] font-semibold text-white max-[768px]:h-[20px] max-[768px]:w-[20px] max-[768px]:text-[11px] ${
      $isGdg
        ? "inline-flex items-center justify-center leading-[normal]"
        : "inline-block leading-[24px] max-[768px]:leading-[20px]"
    } ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const ArticleTopicTitle: React.FC<SpanProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`text-[16px] font-semibold text-[#333] max-[768px]:text-[14px] ${className}`}
    {...rest}
  >
    {children}
  </span>
);

// Google "G" icon for GDG topic
const GoogleGIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width={size}
    height={size}
    xmlnsXlink="http://www.w3.org/1999/xlink"
    style={{ display: "block" }}
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    ></path>
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    ></path>
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    ></path>
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    ></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);

const TopicCard: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`my-2 cursor-pointer rounded-[12px] border border-solid border-[#e0e0e0] bg-white p-4 [transition:all_0.2s] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] max-[768px]:my-1.5 max-[768px]:rounded-[8px] max-[768px]:p-3 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const TopicTitle: React.FC<React.ComponentPropsWithRef<"h3">> = ({
  className = "",
  children,
  ...rest
}) => (
  <h3
    className={`mx-0 mt-0 mb-2 flex items-center justify-between text-[16px] font-semibold text-[#333] max-[768px]:mb-1.5 max-[768px]:text-[14px] ${className}`}
    {...rest}
  >
    {children}
  </h3>
);

const TopicContent: React.FC<DivProps & { $expanded: boolean }> = ({
  $expanded,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`overflow-hidden [transition:max-height_0.3s_ease-in-out] ${
      $expanded ? "max-h-[1000px]" : "max-h-0"
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const DiscussionPoint: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`my-2 flex items-start gap-[8px] text-[14px] text-[#666] max-[768px]:my-1.5 max-[768px]:gap-[6px] max-[768px]:text-[13px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ActionButtons: React.FC<DivProps & { $isFloating: boolean }> = ({
  $isFloating,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`flex gap-4 max-w-[calc(960px-(1.5rem*2))] [transition:opacity_0.3s_ease-in-out] max-[768px]:max-w-none max-[768px]:flex-col max-[768px]:gap-3 ${
      $isFloating
        ? "fixed bottom-[30px] left-[max(1.5rem,calc((100vw-960px)/2+1.5rem))] right-[max(1.5rem,calc((100vw-960px)/2+1.5rem))] z-[1050] m-0 w-auto pb-0 max-[768px]:bottom-[calc(20px+env(safe-area-inset-bottom))] max-[768px]:left-2 max-[768px]:right-2"
        : "static z-[1000] mx-auto mt-8 mb-0 w-full pb-0 max-[768px]:mt-6"
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const AdminButtons: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-4 flex flex-wrap gap-[8px] max-[768px]:mb-3 max-[768px]:gap-[6px] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const AdminButton: React.FC<
  ButtonProps & { $variant?: "default" | "danger" }
> = ({ $variant, className = "", children, ...rest }) => (
  <button
    className={`inline-flex cursor-pointer items-center gap-[0.35rem] rounded-[15px] border-0 px-4 py-2 text-[12px] font-semibold text-white [transition:all_0.2s] enabled:hover:shadow-[0_2px_8px_rgba(255,255,255,0.3)] enabled:hover:[transform:translateY(-1px)] disabled:cursor-not-allowed disabled:opacity-60 max-[768px]:flex-1 max-[768px]:justify-center max-[768px]:rounded-[12px] max-[768px]:px-3 max-[768px]:py-1.5 max-[768px]:text-[11px] [&_svg]:h-[16px] [&_svg]:w-[16px] ${
      $variant === "danger"
        ? "bg-[#7f1d1d] hover:bg-[#991b1b]"
        : "bg-[#181818] hover:bg-[#181818]"
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const ActionButton: React.FC<
  ButtonProps & { $variant: "join" | "cancel" | "locked"; $saved?: boolean }
> = ({ $variant, $saved, className = "", children, ...rest }) => {
  const variantClasses =
    $variant === "locked"
      ? "cursor-not-allowed bg-[#e0e0e0] text-[#999]"
      : $variant === "cancel"
      ? "cursor-pointer bg-[#990033] text-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:[transform:translateY(-2px)] max-[768px]:hover:[transform:translateY(-1px)]"
      : "cursor-pointer text-white bg-[linear-gradient(90deg,#000000_0%,#000000_25%,#1a0808_35%,#2a0808_45%,#3a1010_50%,#2a0808_55%,#1a0808_65%,#000000_75%,#000000_100%)] bg-[length:200%_100%] animate-[meetup-gradient-shine_3s_ease-in-out_infinite] shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:[transform:translateY(-2px)] max-[768px]:hover:[transform:translateY(-1px)]";
  return (
    <button
      className={`relative flex flex-1 items-center justify-center gap-[8px] overflow-hidden rounded-[20px] border-0 p-4 text-[16px] font-bold [transition:all_0.2s] max-[768px]:gap-[6px] max-[768px]:rounded-[16px] max-[768px]:p-3.5 max-[768px]:text-[14px] ${variantClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

// Dialog components
const DialogOverlay: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`fixed inset-0 z-[1050] flex items-center justify-center bg-[rgba(0,0,0,0.6)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const DialogBox: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`flex w-[90%] max-w-[400px] flex-col gap-4 rounded-[12px] bg-white p-8 text-center shadow-[0_5px_15px_rgba(0,0,0,0.3)] [&_h3]:mt-0 [&_h3]:text-[1.5rem] [&_h3]:text-[#333] [&_p]:mb-4 [&_p]:text-[1rem] [&_p]:text-[#555] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const DialogButton: React.FC<ButtonProps & { $primary?: boolean }> = ({
  $primary,
  className = "",
  children,
  ...rest
}) => (
  <button
    className={`cursor-pointer rounded-[8px] border border-solid px-4 py-3 text-[1rem] font-semibold [transition:all_0.2s_ease] hover:opacity-80 ${
      $primary
        ? "border-[#000] bg-[#000] text-white"
        : "border-[#ccc] bg-white text-[#333]"
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

// Seating arrangement components
const SeatingButton: React.FC<ButtonProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <button
    className={`flex cursor-pointer items-center gap-2 rounded-[8px] border-0 bg-[#333] px-6 py-3 text-[14px] font-semibold text-white [transition:all_0.2s] enabled:hover:bg-[#555] enabled:hover:[transform:translateY(-1px)] disabled:cursor-not-allowed disabled:bg-[#ccc] max-[768px]:rounded-[6px] max-[768px]:px-5 max-[768px]:py-2.5 max-[768px]:text-[13px] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const GroupCard: React.FC<DivProps & { $hasTranscript?: boolean }> = ({
  $hasTranscript,
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`relative mb-4 cursor-pointer overflow-hidden rounded-[25px] border-2 border-solid p-6 [transition:all_0.3s_ease] hover:[transform:translateY(-2px)] active:[transform:translateY(0)] max-[768px]:mb-3 max-[768px]:rounded-[20px] max-[768px]:p-4 ${
      $hasTranscript
        ? "border-[#10b981] [background:linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] shadow-[0_2px_8px_rgba(16,185,129,0.15)] hover:border-[#059669] hover:shadow-[0_8px_24px_rgba(16,185,129,0.25)]"
        : "border-[#e0e0e0] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#333] hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
    } ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const LeaderInfo: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`mb-3 flex items-center gap-3 border-b border-solid border-[#eee] pb-3 max-[768px]:mb-2 max-[768px]:gap-2 max-[768px]:pb-2 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const LeaderBadge: React.FC<SpanProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`rounded-[12px] bg-[#333] px-2 py-1 text-[11px] font-semibold text-white max-[768px]:px-[0.4rem] max-[768px]:py-[0.2rem] max-[768px]:text-[10px] ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const UserName: React.FC<SpanProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <span
    className={`flex-1 text-[14px] font-semibold text-[#333] max-[768px]:text-[13px] ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const ParticipantsList: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`} {...rest}>
    {children}
  </div>
);

const ParticipantItem: React.FC<DivProps> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    className={`flex items-center gap-2 py-1.5 max-[768px]:gap-1.5 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const ParticipantItemWrapper: React.FC<DivProps> = ({
  children,
  ...rest
}) => (
  /* Wrapper for dnd-kit sortable */
  <div {...rest}>{children}</div>
);

// Draggable Participant Component
const DraggableParticipant: React.FC<{
  participant: UserWithDetails;
  onAvatarClick: (uid: string) => void;
  onAvatarLongPress?: (uid: string) => void;
  isLeader?: boolean;
  sessionNumber: number;
}> = ({
  participant,
  onAvatarClick,
  onAvatarLongPress,
  isLeader = false,
  sessionNumber,
}) => {
  const uniqueId = `${sessionNumber}-${participant.uid}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uniqueId, disabled: isLeader });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : "auto",
    cursor: isLeader ? "default" : "grab",
  };

  const formatParticipantDisplay = (user: UserWithDetails): string => {
    const isValidDisplayName = (displayName?: string): boolean => {
      if (!displayName) return false;
      const userPattern = /^User [a-zA-Z0-9]{6}$/;
      return !userPattern.test(displayName);
    };

    const maskName = (name: string): string => {
      if (name.length <= 2) return name;
      const midIndex = Math.floor(name.length / 2);
      return name.substring(0, midIndex) + "*" + name.substring(midIndex + 1);
    };

    const formatLeaderDisplay = (user: UserWithDetails): string => {
      const validName = isValidDisplayName(user.displayName);
      return validName ? user.displayName! : "익명";
    };

    if (isLeader) {
      return formatLeaderDisplay(user);
    }

    const validName = isValidDisplayName(user.displayName);
    if (!validName) return `익명 (${user.phoneLast4 || "****"})`;

    const maskedName = maskName(user.displayName!);
    return `${maskedName} (${user.phoneLast4 || "****"})`;
  };

  const itemContent = (
    <ParticipantItem>
      <UserAvatar
        uid={participant.uid}
        size={isLeader ? 32 : 24}
        isLeader={isLeader}
        onClick={() => onAvatarClick(participant.uid)}
        onLongPress={
          onAvatarLongPress
            ? () => onAvatarLongPress(participant.uid)
            : undefined
        }
      />
      <UserName>{formatParticipantDisplay(participant)}</UserName>
      {isLeader && <LeaderBadge>리더</LeaderBadge>}
    </ParticipantItem>
  );

  return isLeader ? (
    <>{itemContent}</>
  ) : (
    <ParticipantItemWrapper
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {itemContent}
    </ParticipantItemWrapper>
  );
};

// Naver Map Component - Updated with dynamic script loading
interface NaverMapProps {
  latitude: number;
  longitude: number;
  locationName: string;
  mapUrl?: string;
}

const NaverMapComponent: React.FC<NaverMapProps> = ({
  latitude,
  longitude,
  locationName,
  mapUrl,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [componentMounted, setComponentMounted] = useState(false);

  // Ensure component is mounted before trying to access DOM
  useEffect(() => {
    const timer = setTimeout(() => {
      setComponentMounted(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadNaverMapsAPI = () => {
      // Check if API is already loaded
      if (
        window.naver &&
        window.naver.maps &&
        typeof window.naver.maps.Map === "function"
      ) {
        setIsApiReady(true);
        return;
      }

      // Always set up global callbacks first, regardless of script loading state
      window.initNaverMaps = () => {
        setIsApiReady(true);
      };

      window.navermap_authFailure = () => {
        setLoadError("Naver Maps API Authentication Failed");
      };

      // Check if script is already loading
      const existingScript = document.querySelector(
        'script[src*="oapi.map.naver.com"]'
      );
      if (existingScript) {
        // Set up a fallback timer to check if API becomes available
        const checkTimer = setInterval(() => {
          if (
            window.naver &&
            window.naver.maps &&
            typeof window.naver.maps.Map === "function"
          ) {
            setIsApiReady(true);
            clearInterval(checkTimer);
          }
        }, 500);

        // Give up after 10 seconds
        setTimeout(() => {
          clearInterval(checkTimer);
          if (!window.naver || !window.naver.maps) {
            setLoadError("Timeout loading Naver Maps API");
          }
        }, 10000);

        return;
      }

      // Create and inject script tag
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = naverMapsScriptSrc("initNaverMaps");
      script.async = true;
      script.defer = true;

      script.onerror = () => {
        setLoadError("Failed to load Naver Maps API");
      };

      document.head.appendChild(script);
    };

    loadNaverMapsAPI();

    return () => {
      // Cleanup global callbacks
      delete window.initNaverMaps;
      delete window.navermap_authFailure;
    };
  }, []);

  useEffect(() => {
    if (!isApiReady || !mapRef.current || loadError || !componentMounted) {
      return;
    }

    try {
      // Validate coordinates
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error(
          `Invalid coordinates: lat=${latitude}, lng=${longitude}`
        );
      }

      const position = new window.naver.maps.LatLng(latitude, longitude);

      const mapOptions = {
        center: position,
        zoom: 16,
        minZoom: 10,
        maxZoom: 20,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
      };

      const map = new window.naver.maps.Map(mapRef.current, mapOptions);

      // Create custom marker
      const marker = new window.naver.maps.Marker({
        position: position,
        map: map,
        title: locationName,
        icon: {
          content: `
            <div style="
              width: 30px;
              height: 30px;
              background-color: #181818;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              cursor: pointer;
            ">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: white; display: block;"></span>
            </div>
          `,
          size: new window.naver.maps.Size(30, 30),
          anchor: new window.naver.maps.Point(15, 15),
        },
      });

      // Add click event handlers
      const handleMapClick = () => {
        const searchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(
          locationName
        )}`;
        window.open(searchUrl, "_blank");
      };

      if (window.naver.maps.Event) {
        window.naver.maps.Event.addListener(marker, "click", handleMapClick);
        window.naver.maps.Event.addListener(map, "click", handleMapClick);
      }

      setMapLoaded(true);
    } catch (error) {
      setLoadError(
        `Error initializing map: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [
    isApiReady,
    latitude,
    longitude,
    locationName,
    mapUrl,
    loadError,
    componentMounted,
  ]);

  if (loadError) {
    return <MapLoadingPlaceholder>{loadError}</MapLoadingPlaceholder>;
  }

  if (!isApiReady) {
    return (
      <MapLoadingPlaceholder>
        Loading Naver Maps API...
      </MapLoadingPlaceholder>
    );
  }

  return (
    <div
      ref={mapRef}
      className="relative my-4 h-[300px] cursor-pointer overflow-hidden rounded-[12px] border border-solid border-[#e0e0e0] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] max-[768px]:my-3 max-[768px]:h-[250px] max-[768px]:rounded-[8px]"
    >
      {!mapLoaded && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f5f5f5",
            color: "#999",
            fontSize: "1rem",
            borderRadius: "12px",
            zIndex: 10,
          }}
        >
          Initializing map...
        </div>
      )}
    </div>
  );
};

export function EventDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, accountStatus, isGdgMember } = useAuth();
  const [event, setEvent] = useState<MeetupEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(
    {}
  );
  const actionButtonRef = useRef<HTMLDivElement>(null);
  const [isButtonFloating, setIsButtonFloating] = useState(false);

  // Use accountStatus from auth context
  const isAdmin = accountStatus === "admin";
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [dialogTemplateEvent, setDialogTemplateEvent] =
    useState<MeetupEvent | null>(null);
  const [dialogEditEvent, setDialogEditEvent] = useState<MeetupEvent | null>(
    null
  );
  const [showRoleChoiceDialog, setShowRoleChoiceDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [showParticipationSuccessDialog, setShowParticipationSuccessDialog] =
    useState(false);
  const [articleTopics, setArticleTopics] = useState<Article[]>([]);
  const [userHasSubscription, setUserHasSubscription] = useState<
    boolean | null
  >(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // Admin action dialogs state
  const [showAdminActionDialog, setShowAdminActionDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserIsLeader, setSelectedUserIsLeader] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] =
    useState<UserWithDetails | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Seating arrangement state
  const [seatingAssignments, setSeatingAssignments] = useState<
    SeatingAssignment[]
  >([]);
  const [showSeatingTable, setShowSeatingTable] = useState(() => {
    // In localhost mode, default to true so seating shows when data loads
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "localhost"
    ) {
      return true;
    }
    return false;
  });
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const eventId = params?.id;

  const isCurrentUserParticipant = useMemo(() => {
    if (!currentUser || !event) return false;
    return (
      event.participants.includes(currentUser.uid) ||
      event.leaders.includes(currentUser.uid)
    );
  }, [currentUser, event]);

  const canViewParticipantProfiles = useMemo(() => {
    if (!currentUser || !event) return false;
    return (
      accountStatus === "admin" ||
      accountStatus === "leader" ||
      event.participants.includes(currentUser.uid) ||
      event.leaders.includes(currentUser.uid)
    );
  }, [accountStatus, currentUser, event]);

  // Function to save seating arrangement to Supabase
  const saveSeatingArrangement = async (assignments: SeatingAssignment[]) => {
    const isLocalhost =
      typeof window !== "undefined" && window.location.hostname === "localhost";

    if (!event || (!currentUser && !isLocalhost)) {
      alert("Cannot save seating: missing event or user data");
      return;
    }

    try {
      // Sanitize only the assignments array to remove undefined values,
      // particularly from optional fields like photoURL in UserWithDetails.
      const cleanedAssignments = JSON.parse(JSON.stringify(assignments));

      const seatingData = {
        assignments: cleanedAssignments,
        generatedAt: new Date().toISOString(),
        generatedBy: currentUser?.uid || "localhost-user",
      };

      const { error } = await supabase
        .from("meetups")
        .update({ seating_arrangement: seatingData })
        .eq("id", event.id);

      if (error) throw error;

      // No alert on drag-and-drop save for better UX
      // alert("좌석 배치가 성공적으로 저장되었습니다!");
    } catch (error) {
      alert(
        "좌석 배치 저장 중 오류가 발생했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  // Function to load seating arrangement from Supabase
  const loadSeatingArrangement =
    async (): Promise<SavedSeatingArrangement | null> => {
      if (!event) return null;

      try {
        const { data, error } = await supabase
          .from("meetups")
          .select("seating_arrangement")
          .eq("id", event.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const seatingArrangement = data.seating_arrangement;
          if (
            seatingArrangement &&
            seatingArrangement.assignments &&
            Array.isArray(seatingArrangement.assignments)
          ) {
            const allUserUids = [...event.leaders, ...event.participants];
            const userDetails = await fetchUserDetails(allUserUids);

            const reconstructedAssignments =
              seatingArrangement.assignments.map((assignment: any) => {
                const leaderDetails = userDetails.find(
                  (user) => user.uid === assignment.leaderUid
                );
                const participantDetails = assignment.participants.map(
                  (p: any) =>
                    userDetails.find((user) => user.uid === p.uid) || p
                );

                return {
                  sessionNumber: assignment.sessionNumber,
                  leaderUid: assignment.leaderUid,
                  leaderDetails: leaderDetails || assignment.leaderDetails,
                  participants: participantDetails,
                  transcriptId: assignment.transcriptId, // Preserve transcriptId
                };
              });

            // Robustly handle `generatedAt` which might be a Timestamp-like
            // object or an ISO string.
            const rawGeneratedAt = seatingArrangement.generatedAt;
            let generatedAtDate: Date;
            if (rawGeneratedAt && typeof rawGeneratedAt.toDate === "function") {
              generatedAtDate = rawGeneratedAt.toDate();
            } else if (typeof rawGeneratedAt === "string") {
              generatedAtDate = new Date(rawGeneratedAt);
            } else {
              // Fallback for unexpected types
              generatedAtDate = new Date();
            }

            return {
              assignments: reconstructedAssignments,
              generatedAt: generatedAtDate,
              generatedBy: seatingArrangement.generatedBy,
            };
          }
        }
        return null;
      } catch (error) {
        console.error("Error loading seating arrangement:", error);
        return null;
      }
    };

  // Function to get user details with phone numbers
  const fetchUserDetails = async (
    uids: string[]
  ): Promise<UserWithDetails[]> => {
    try {
      const result = await invokeFunction<{
        displayNames: Record<string, string>;
        phoneNumbers: Record<string, string>;
      }>("messaging", {
        action: "user-names",
        userIds: uids,
      });

      return uids.map((uid) => ({
        uid,
        displayName: result.displayNames[uid] || `User ${uid.substring(0, 6)}`,
        phoneNumber: result.phoneNumbers[uid] || "",
        phoneLast4: result.phoneNumbers[uid]
          ? result.phoneNumbers[uid].replace(/\D/g, "").slice(-4)
          : "",
      }));
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

  // Function to evenly distribute participants among leaders
  const distributeParticipants = (
    participants: UserWithDetails[],
    leaders: UserWithDetails[]
  ): UserWithDetails[][] => {
    if (leaders.length === 0) return [];

    const shuffledParticipants = [...participants].sort(
      () => Math.random() - 0.5
    );
    const groups: UserWithDetails[][] = leaders.map(() => []);

    shuffledParticipants.forEach((participant, index) => {
      const groupIndex = index % leaders.length;
      groups[groupIndex].push(participant);
    });

    return groups;
  };

  // Function to generate seating arrangement
  const generateSeatingArrangement = async () => {
    if (!event) return;

    setSeatingLoading(true);
    try {
      const allUserUids = [...event.leaders, ...event.participants];
      const userDetails = await fetchUserDetails(allUserUids);

      const leaderDetails = userDetails.filter((user) =>
        event.leaders.includes(user.uid)
      );
      const participantDetails = userDetails.filter((user) =>
        event.participants.includes(user.uid)
      );

      const assignments: SeatingAssignment[] = [];

      for (let session = 1; session <= 2; session++) {
        const distributedGroups = distributeParticipants(
          participantDetails,
          leaderDetails
        );

        leaderDetails.forEach((leader, index) => {
          const assignment: SeatingAssignment = {
            sessionNumber: session as 1 | 2,
            leaderUid: leader.uid,
            leaderDetails: leader,
            participants: distributedGroups[index] || [],
          };
          assignments.push(assignment);
        });
      }

      setSeatingAssignments(assignments);
      setShowSeatingTable(true);
      await saveSeatingArrangement(assignments);
    } catch (error) {
      alert(
        "좌석 배치 생성 중 오류가 발생했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setSeatingLoading(false);
    }
  };

  // Function to refresh seating arrangement
  const refreshSeatingArrangement = () => {
    generateSeatingArrangement();
  };

  // Helper functions
  const isValidDisplayName = (displayName?: string): boolean => {
    if (!displayName) return false;
    const userPattern = /^User [a-zA-Z0-9]{6}$/;
    return !userPattern.test(displayName);
  };

  const maskName = (name: string): string => {
    if (name.length <= 2) return name;
    const midIndex = Math.floor(name.length / 2);
    return name.substring(0, midIndex) + "*" + name.substring(midIndex + 1);
  };

  const formatParticipantDisplay = (user: UserWithDetails): string => {
    const validName = isValidDisplayName(user.displayName);
    if (!validName) return `익명 (${user.phoneLast4 || "****"})`;

    const maskedName = maskName(user.displayName!);
    return `${maskedName} (${user.phoneLast4 || "****"})`;
  };

  const formatLeaderDisplay = (user: UserWithDetails): string => {
    const validName = isValidDisplayName(user.displayName);
    return validName ? user.displayName! : "익명";
  };

  // useEffect hooks
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!currentUser) {
        setUserHasSubscription(null);
        setSubscriptionLoading(false);
        return;
      }

      // Exempt admin/leader/GDG users from needing a subscription
      if (
        accountStatus === "admin" ||
        accountStatus === "leader" ||
        isGdgMember === true
      ) {
        setUserHasSubscription(true);
        setSubscriptionLoading(false);
        return;
      }

      try {
        const hasSubscription = await hasActiveSubscription(currentUser.uid);
        setUserHasSubscription(hasSubscription);
      } catch (error) {
        console.error("Error checking subscription status:", error);
        setUserHasSubscription(false);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [currentUser, accountStatus, isGdgMember]);

  useEffect(() => {
    if (!eventId) {
      setError("Event ID is required");
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToEvent(eventId, (eventData) => {
      setEvent(eventData);
      setLoading(false);
      if (!eventData) {
        setError("Event not found");
      } else {
        setError(null);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [eventId]);

  useEffect(() => {
    if (event && event.image_urls.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % event.image_urls.length);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [event]);

  useEffect(() => {
    const fetchArticles = async () => {
      if (event && event.articles && event.articles.length > 0) {
        try {
          const articles = await fetchArticlesByIds(event.articles);
          setArticleTopics(articles);
        } catch (error) {
          console.error("Error fetching articles for topics:", error);
          setArticleTopics([]);
        }
      } else {
        setArticleTopics([]);
      }
    };

    fetchArticles();
  }, [event]);

  useEffect(() => {
    const loadExistingSeating = async () => {
      const isLocalhost =
        typeof window !== "undefined" &&
        window.location.hostname === "localhost";
      const isLeader = accountStatus === "leader";
      if (event && (isAdmin || isLeader || isLocalhost)) {
        try {
          const savedSeating = await loadSeatingArrangement();
          if (savedSeating) {
            setSeatingAssignments(savedSeating.assignments);
            setShowSeatingTable(true);
          } else if (isLocalhost) {
            // In localhost mode, if no saved seating exists, keep table visible but empty
            setShowSeatingTable(true);
          }
        } catch (error) {
          console.error("Error loading existing seating arrangement:", error);
          // In localhost mode, still show the seating section even if loading fails
          if (isLocalhost) {
            setShowSeatingTable(true);
          }
        }
      }
    };

    loadExistingSeating();
  }, [event, isAdmin, accountStatus]);

  useEffect(() => {
    const loadSeatingOnAdminConfirmed = async () => {
      const isLocalhost =
        typeof window !== "undefined" &&
        window.location.hostname === "localhost";
      const isLeader = accountStatus === "leader";
      if (
        (isAdmin || isLeader || isLocalhost) &&
        event &&
        seatingAssignments.length === 0 &&
        !showSeatingTable
      ) {
        try {
          const savedSeating = await loadSeatingArrangement();
          if (savedSeating) {
            setSeatingAssignments(savedSeating.assignments);
            setShowSeatingTable(true);
          }
        } catch (error) {
          console.error("Error in late seating load:", error);
        }
      }
    };

    const timeoutId = setTimeout(loadSeatingOnAdminConfirmed, 500);
    return () => clearTimeout(timeoutId);
  }, [isAdmin, accountStatus]);

  useEffect(() => {
    const calculatePositionAndCheckFloat = () => {
      if (!actionButtonRef.current) {
        setIsButtonFloating(false);
        return;
      }

      const rect = actionButtonRef.current.getBoundingClientRect();
      const staticTop = rect.top + window.scrollY;
      const staticHeight = actionButtonRef.current.offsetHeight;
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const staticBottom = staticTop + staticHeight;

      const isMobile = window.innerWidth <= 768;
      const buffer = isMobile ? 80 : 50;
      const bottomThreshold = isMobile ? 50 : 150;
      const isNearBottom =
        scrollY + windowHeight >= documentHeight - bottomThreshold;
      const wouldBeOutOfView = scrollY + windowHeight < staticBottom + buffer;
      const shouldFloat = wouldBeOutOfView && !isNearBottom;

      setIsButtonFloating(shouldFloat);
    };

    calculatePositionAndCheckFloat();

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          calculatePositionAndCheckFloat();
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      setIsButtonFloating(false);
      setTimeout(calculatePositionAndCheckFloat, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchmove", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchmove", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Handler functions
  const handleBack = () => {
    router.push("/meetup");
  };

  const handleJoin = async () => {
    if (!currentUser) {
      localStorage.setItem("returnUrl", pathname);
      router.push("/auth");
      return;
    }

    if (!event) {
      alert("이벤트 정보가 없습니다.");
      return;
    }

    if (isCurrentUserParticipant) {
      // Check if event is locked down - prevent cancellation after lockdown
      const lockStatus = isEventLocked(event);
      if (lockStatus.isLocked && lockStatus.reason === "lockdown") {
        alert("모집 마감 시간이 지나 더 이상 참가를 취소할 수 없습니다.");
        return;
      }
      if (lockStatus.isLocked && lockStatus.reason === "started") {
        alert("이미 시작된 모임의 참가를 취소할 수 없습니다.");
        return;
      }

      try {
        await cancelParticipation(event.id, currentUser.uid);
        alert("밋업 참가가 취소되었습니다.");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.";
        alert(`오류: 참가 취소에 실패했습니다. (${message})`);
      }
    } else {
      const isExempt =
        accountStatus === "admin" ||
        accountStatus === "leader" ||
        isGdgMember === true;

      if (!isExempt) {
        try {
          const userHasActiveSubscription = await hasActiveSubscription(
            currentUser.uid
          );
          if (!userHasActiveSubscription) {
            setShowSubscriptionDialog(true);
            return;
          }
        } catch (err) {
          alert(
            "구독 상태를 확인하는 중 오류가 발생했습니다. 다시 시도해주세요."
          );
          return;
        }
      }

      if (accountStatus === "admin" || accountStatus === "leader") {
        setShowRoleChoiceDialog(true);
      } else {
        try {
          await joinEventAsRole(event.id, currentUser.uid, "participant");
          setShowParticipationSuccessDialog(true);
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "알 수 없는 오류가 발생했습니다.";
          alert(`오류: 참가 신청에 실패했습니다. (${message})`);
        }
      }
    }
  };

  const handleConfirmJoinAsRole = async (role: "leader" | "participant") => {
    setShowRoleChoiceDialog(false);
    if (!currentUser || !event) {
      alert("사용자 정보 또는 이벤트 정보가 없습니다.");
      return;
    }

    try {
      const isExempt =
        accountStatus === "admin" ||
        accountStatus === "leader" ||
        isGdgMember === true;
      if (!isExempt) {
        const userHasActiveSubscription = await hasActiveSubscription(
          currentUser.uid
        );
        if (!userHasActiveSubscription) {
          setShowSubscriptionDialog(true);
          return;
        }
      }
    } catch (err) {
      alert("구독 상태를 확인하는 중 오류가 발생했습니다. 다시 시도해주세요.");
      return;
    }

    try {
      await joinEventAsRole(event.id, currentUser.uid, role);
      setShowParticipationSuccessDialog(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      alert(
        `오류: ${
          role === "leader" ? "리더" : "참가자"
        }로 참가 신청에 실패했습니다. (${message})`
      );
    }
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  const handleAvatarClick = (uid: string) => {
    if (!canViewParticipantProfiles) return;

    router.push(`/profile/${uid}`);
  };

  const handleAvatarLongPress = async (uid: string) => {
    if (!isAdmin) return;
    if (!event) return;

    // Check if the clicked user is a leader or participant
    const isLeader = event.leaders.includes(uid);
    const isParticipant = event.participants.includes(uid);

    if (!isLeader && !isParticipant) return;

    // Don't allow admin to kick themselves out
    if (currentUser && uid === currentUser.uid) {
      alert("관리자는 자신을 제거할 수 없습니다.");
      return;
    }

    // Fetch user details properly
    let userDetails: UserWithDetails | null = null;

    // First try to find from seating assignments if available
    for (const assignment of seatingAssignments) {
      if (assignment.leaderDetails.uid === uid) {
        userDetails = assignment.leaderDetails;
        break;
      }
      const participant = assignment.participants.find((p) => p.uid === uid);
      if (participant) {
        userDetails = participant;
        break;
      }
    }

    // If not found in seating assignments, fetch directly
    if (!userDetails) {
      try {
        const fetchedDetails = await fetchUserDetails([uid]);
        if (fetchedDetails.length > 0) {
          userDetails = fetchedDetails[0];
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        // Fallback to basic info
        userDetails = {
          uid,
          displayName: `User ${uid.substring(0, 6)}`,
          phoneNumber: "",
          phoneLast4: "",
        };
      }
    }

    setSelectedUserId(uid);
    setSelectedUserIsLeader(isLeader);
    setSelectedUserDetails(userDetails); // Save details to state
    setShowAdminActionDialog(true);
  };

  const handleRemoveParticipant = async () => {
    if (!event || !selectedUserId || !currentUser) return;

    setAdminActionLoading(true);
    try {
      await removeParticipant(event.id, selectedUserId);
      alert("참가자가 성공적으로 제거되었습니다.");
      setShowAdminActionDialog(false);
    } catch (error) {
      console.error("Error removing participant:", error);
      alert(
        "참가자 제거 중 오류가 발생했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!event || !selectedUserId || !currentUser) return;

    const newRole = selectedUserIsLeader ? "participant" : "leader";

    setAdminActionLoading(true);
    try {
      await changeUserRole(event.id, selectedUserId, newRole);
      alert(
        `사용자 역할이 성공적으로 ${
          newRole === "leader" ? "리더" : "참가자"
        }로 변경되었습니다.`
      );
      setShowAdminActionDialog(false);
    } catch (error) {
      console.error("Error changing user role:", error);
      alert(
        "사용자 역할 변경 중 오류가 발생했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleCreateNew = () => {
    setDialogTemplateEvent(null);
    setDialogEditEvent(null);
    setShowAdminDialog(true);
  };

  const handleDuplicate = () => {
    setDialogTemplateEvent(event);
    setDialogEditEvent(null);
    setShowAdminDialog(true);
  };

  const handleEdit = () => {
    setDialogTemplateEvent(null);
    setDialogEditEvent(event);
    setShowAdminDialog(true);
  };

  const handleDeleteEvent = async () => {
    if (!event || !isAdmin) return;

    const confirmDelete = window.confirm(
      "정말로 이 이벤트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
    );

    if (!confirmDelete) {
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteMeetupEvent(event.id);
      alert("이벤트가 삭제되었습니다.");
      router.push("/meetup");
    } catch (error) {
      console.error("Error deleting event:", error);
      alert(
        "이벤트 삭제 중 오류가 발생했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEventCreated = (newEventId: string) => {
    router.push(`/meetup/${newEventId}`);
    handleDialogClose();
  };

  const handleEventUpdated = () => {
    handleDialogClose();
  };

  const handleDialogClose = () => {
    setShowAdminDialog(false);
    setDialogTemplateEvent(null);
    setDialogEditEvent(null);
  };

  const handleGoToPayment = () => {
    setShowSubscriptionDialog(false);
    router.push("/payment");
  };

  const handleArticleTopicClick = (articleId: string) => {
    router.push(`/article/${articleId}`);
  };

  const handleSeatingGroupClick = async (assignment: SeatingAssignment) => {
    // Allow localhost access even without login for testing
    const isLocalhost =
      typeof window !== "undefined" && window.location.hostname === "localhost";
    if (!isLocalhost && (!currentUser?.uid || !isAdmin)) return;

    try {
      // Check if this assignment already has a transcript
      if (assignment.transcriptId) {
        console.log(
          `[Transcript] Using existing transcript: ${assignment.transcriptId}`
        );
        router.push(`/transcript/${assignment.transcriptId}`);
        return;
      }

      // Generate a new transcript ID if one doesn't exist
      const transcriptId = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      console.log(
        `[Transcript] Creating new transcript: ${transcriptId} for session ${assignment.sessionNumber}, leader ${assignment.leaderUid}`
      );

      // Determine the article ID based on session number
      const articleId =
        assignment.sessionNumber === 1
          ? articleTopics[0]?.id || ""
          : articleTopics[1]?.id || "";

      // Create transcript row in Supabase
      const transcriptData = {
        id: transcriptId,
        event_id: eventId,
        session_number: assignment.sessionNumber,
        article_id: articleId || null,
        leader_uids: [assignment.leaderUid],
        participant_uids: assignment.participants.map((p) => p.uid),
        created_at: new Date().toISOString(),
        created_by: currentUser?.uid || "localhost-user",
      };

      const { error: transcriptError } = await supabase
        .from("transcripts")
        .insert(transcriptData);
      if (transcriptError) throw transcriptError;

      // Update the seating arrangement on the meetups row to include transcript ID
      const { data: eventRow, error: eventError } = await supabase
        .from("meetups")
        .select("seating_arrangement")
        .eq("id", eventId)
        .maybeSingle();
      if (eventError) throw eventError;

      if (eventRow) {
        const currentSeatingArrangement = eventRow.seating_arrangement;

        if (
          currentSeatingArrangement &&
          currentSeatingArrangement.assignments
        ) {
          // Find and update the specific assignment
          const updatedAssignments = currentSeatingArrangement.assignments.map(
            (assign: any) => {
              if (
                assign.sessionNumber === assignment.sessionNumber &&
                assign.leaderUid === assignment.leaderUid
              ) {
                return { ...assign, transcriptId: transcriptId };
              }
              return assign;
            }
          );

          // Persist the entire seating arrangement with the modified assignments
          const { error: updateError } = await supabase
            .from("meetups")
            .update({
              seating_arrangement: {
                ...currentSeatingArrangement,
                assignments: updatedAssignments,
              },
            })
            .eq("id", eventId);
          if (updateError) throw updateError;

          console.log(
            `[Transcript] Updated seating arrangement with transcript ID: ${transcriptId}`
          );
        }
      }

      // Navigate to the transcript page
      router.push(`/transcript/${transcriptId}`);
    } catch (error) {
      console.error("Error handling transcript:", error);
      alert("Failed to access transcript. Please try again.");
    }
  };

  const handleSendReminderToParticipants = async () => {
    if (!event) {
      alert("이벤트 정보가 없습니다.");
      return;
    }

    const totalParticipants = event.leaders.length + event.participants.length;
    if (totalParticipants === 0) {
      alert("이 이벤트에는 참가자가 없습니다.");
      return;
    }

    const confirmSend = window.confirm(
      `${totalParticipants}명의 모든 참가자(리더 ${event.leaders.length}명 + 참가자 ${event.participants.length}명)에게 밋업 리마인더를 보내시겠습니까?`
    );

    if (!confirmSend) {
      return;
    }

    try {
      const data = await invokeFunction<{
        success: boolean;
        messagesSent: number;
        message: string;
      }>("messaging", {
        action: "meetup-reminder",
        eventId: event.id,
      });

      if (data.success) {
        alert(
          `성공적으로 ${data.messagesSent}명의 참가자에게 리마인더를 보냈습니다.`
        );
      } else {
        alert("리마인더 전송에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error sending reminder to participants:", error);
      alert(
        "리마인더 전송 중 오류가 발생했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const handleJoinClick = async () => {
    if (!currentUser) {
      localStorage.setItem("returnUrl", pathname);
      router.push("/auth");
      return;
    }

    const isExempt =
      accountStatus === "admin" ||
      accountStatus === "leader" ||
      isGdgMember === true;

    if (userHasSubscription === false && !isExempt) {
      setShowSubscriptionDialog(true);
      return;
    }

    await handleJoin();
  };

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  // dnd-kit drag end handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Do nothing if dropped in the same place
    if (activeId === overId) {
      return;
    }

    const [activeSessionStr, activeUid] = activeId.split("-");
    const [overSessionStr, _] = overId.split("-");

    const activeSession = parseInt(activeSessionStr, 10);
    const overSession = parseInt(overSessionStr, 10);

    // Prevent dragging between sessions
    if (activeSession !== overSession) {
      return;
    }

    setSeatingAssignments((prevAssignments) => {
      let sourceGroupIndex = -1;
      let draggedItemIndex = -1;
      let draggedItem: UserWithDetails | undefined;

      // Find the source group and the dragged participant within the correct session
      prevAssignments.forEach((group, groupIndex) => {
        if (group.sessionNumber === activeSession) {
          const itemIndex = group.participants.findIndex(
            (p) => p.uid === activeUid
          );
          if (itemIndex !== -1) {
            sourceGroupIndex = groupIndex;
            draggedItemIndex = itemIndex;
            draggedItem = group.participants[itemIndex];
          }
        }
      });

      // If we didn't find the dragged item, something is wrong.
      if (sourceGroupIndex === -1 || !draggedItem) {
        return prevAssignments;
      }

      // Find the destination group within the same session
      let destGroupIndex = -1;

      // The `over.id` can be a participant's unique ID or a leader's unique ID
      const [__, overUid] = overId.split("-");
      prevAssignments.forEach((group, groupIndex) => {
        if (group.sessionNumber === overSession) {
          if (
            group.leaderUid === overUid ||
            group.participants.some((p) => p.uid === overUid)
          ) {
            destGroupIndex = groupIndex;
          }
        }
      });

      if (destGroupIndex === -1) {
        return prevAssignments;
      }

      const newAssignments = [...prevAssignments];

      // Remove from source group
      const sourceGroup = { ...newAssignments[sourceGroupIndex] };
      sourceGroup.participants = [...sourceGroup.participants];
      sourceGroup.participants.splice(draggedItemIndex, 1);
      newAssignments[sourceGroupIndex] = sourceGroup;

      // Add to destination group
      const destGroup = { ...newAssignments[destGroupIndex] };
      destGroup.participants = [...destGroup.participants];

      // Find drop position
      const overItemIndex = destGroup.participants.findIndex(
        (p) => p.uid === overUid
      );

      if (overItemIndex !== -1) {
        // Insert before the "over" item
        destGroup.participants.splice(overItemIndex, 0, draggedItem);
      } else {
        // Dropped on the group card (leader) or an empty list
        destGroup.participants.push(draggedItem);
      }
      newAssignments[destGroupIndex] = destGroup;

      // Save the updated arrangement to Supabase
      saveSeatingArrangement(newAssignments);

      return newAssignments;
    });
  };

  const activeParticipantData = useMemo(() => {
    if (!activeId) return null;
    const [sessionStr, uid] = activeId.split("-");
    const session = parseInt(sessionStr, 10);

    for (const assignment of seatingAssignments) {
      if (assignment.sessionNumber === session) {
        if (assignment.leaderDetails.uid === uid) {
          return {
            participant: assignment.leaderDetails,
            isLeader: true,
            session,
          };
        }
        const participant = assignment.participants.find((p) => p.uid === uid);
        if (participant) {
          return { participant, isLeader: false, session };
        }
      }
    }
    return null;
  }, [activeId, seatingAssignments]);

  // Loading state
  if (loading || (currentUser && subscriptionLoading)) {
    return <GlobalLoadingScreen />;
  }

  // Error state
  if (error || !event) {
    return (
      <Container>
        <div
          style={{ paddingTop: "80px", textAlign: "center", padding: "2rem" }}
        >
          <div
            style={{ color: "#666", fontSize: "16px", marginBottom: "1rem" }}
          >
            {error || `Event with ID "${eventId}" was not found.`}
          </div>
          <ActionButton
            $variant="join"
            onClick={handleBack}
            style={{ position: "static", margin: "0 auto", maxWidth: "200px" }}
          >
            ← Back to Events
          </ActionButton>
        </div>
      </Container>
    );
  }

  const lockStatus = isEventLocked(event);
  const isLocked = lockStatus.isLocked;

  const eventCategory = event.title.toLowerCase().includes("movie")
    ? "Movie Night"
    : event.title.toLowerCase().includes("business")
    ? "Socializing"
    : "Discussion";

  const eventTopics = event.topics
    .map(
      (topicRef) => sampleTopics[topicRef.topic_id as keyof typeof sampleTopics]
    )
    .filter(Boolean);

  const { countdownPrefix, eventTitle, isUrgent } =
    formatEventTitleWithCountdown(event);
  const totalParticipants = event.participants.length + event.leaders.length;

  // Check if event is past (has started or is completed)
  const isEventPast =
    lockStatus.reason === "started" ||
    new Date(`${event.date}T${event.time}`) < new Date();

  // Determine if the button should be disabled
  const shouldDisableButton = () => {
    if (!isLocked) return false;

    // If user is already enrolled, check if they can still cancel
    if (isCurrentUserParticipant) {
      // Allow cancellation if event is only full, but not if locked down or started
      return (
        lockStatus.reason === "lockdown" || lockStatus.reason === "started"
      );
    }

    // For non-enrolled users, disable for any lock reason
    return true;
  };

  const isButtonDisabled = shouldDisableButton();

  const getButtonText = () => {
    if (!isButtonDisabled) {
      if (!currentUser) {
        return "로그인하고 참가하기";
      }
      const isExempt =
        accountStatus === "admin" ||
        accountStatus === "leader" ||
        isGdgMember === true;
      if (userHasSubscription === false && !isExempt) {
        return "구독하고 참가하기";
      }
      return isCurrentUserParticipant ? "취소" : "참가 신청하기";
    }

    // Button is disabled - show appropriate locked message
    if (isCurrentUserParticipant) {
      // User is enrolled but can't cancel
      switch (lockStatus.reason) {
        case "started":
          return "참가 완료";
        case "lockdown":
          return "참가 확정 (마감됨)";
        default:
          return "모집 종료";
      }
    } else {
      // User is not enrolled and can't join
      switch (lockStatus.reason) {
        case "started":
          return "모집 종료";
        case "full":
          return "참가 인원 초과";
        case "lockdown":
          return "모집 종료";
        default:
          return "모집 종료";
      }
    }
  };

  return (
    <Container>
      <div className="mx-auto w-full max-w-page px-gutter max-[768px]:px-0">
        <div className="relative mt-0 h-[40vh] overflow-hidden rounded-[20px] bg-[#000000] max-[768px]:h-[35vh] max-[768px]:rounded-[12px]">
          {event.image_urls.length > 0 ? (
            event.image_urls.map((url, index) => (
              <SliderImage
                key={index}
                src={url}
                alt={`Event ${index + 1}`}
                $active={index === currentImageIndex}
              />
            ))
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#000000] text-[3rem] text-[#ccc] [&_svg]:h-12 [&_svg]:w-12 max-[768px]:text-[2rem] max-[768px]:[&_svg]:h-8 max-[768px]:[&_svg]:w-8">
              <PhotoIcon />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-page px-gutter pt-6 pb-0 max-[768px]:max-w-full max-[768px]:px-gutter-mobile max-[768px]:pt-4">
        <CategoryTag $category={eventCategory}>
          {eventCategory}
        </CategoryTag>

        <h1 className="mx-0 mt-0 mb-4 break-words text-[28px] font-extrabold leading-[1.3] text-[#333] max-[768px]:mb-3 max-[768px]:text-[22px] max-[768px]:leading-[1.2]">
          {!isEventPast && countdownPrefix && (
            <CountdownPrefix $isUrgent={isUrgent}>
              {countdownPrefix}
            </CountdownPrefix>
          )}
          {eventTitle}
        </h1>

        {articleTopics.length > 0 && isCurrentUserParticipant && (
          <div className="my-6 max-[768px]:my-5">
            <SectionTitle>밋업 토픽</SectionTitle>
            {articleTopics.length >= 3 && (
              <ArticleTopicCard
                $gdg
                onClick={() => handleArticleTopicClick(articleTopics[2].id)}
              >
                <ArticleTopicNumber $isGdg>
                  <GoogleGIcon size={14} />
                </ArticleTopicNumber>
                <ArticleTopicTitle>
                  {articleTopics[2].title.english}
                </ArticleTopicTitle>
              </ArticleTopicCard>
            )}
            {articleTopics.slice(0, 2).map((topic, index) => (
              <ArticleTopicCard
                key={topic.id}
                onClick={() => handleArticleTopicClick(topic.id)}
              >
                <ArticleTopicNumber>{index + 1}</ArticleTopicNumber>
                <ArticleTopicTitle>{topic.title.english}</ArticleTopicTitle>
              </ArticleTopicCard>
            ))}
          </div>
        )}

        <p className="mx-0 mt-0 mb-6 whitespace-pre-wrap break-words text-[16px] leading-[1.6] text-[#333] max-[768px]:mb-4 max-[768px]:text-[14px] max-[768px]:leading-[1.5]">
          {event.description}
        </p>

        <SectionTitle>세부 사항</SectionTitle>
        <DetailRow>
          <DetailIcon>
            <ClockIcon width="18px" height="18px" />
          </DetailIcon>
          <DetailText>일정 시간: {event.duration_minutes}분</DetailText>
        </DetailRow>
        <DetailRow>
          <DetailIcon>
            <CalendarIcon width="18px" height="18px" />
          </DetailIcon>
          <DetailText>시작 시간: {formatEventDateTime(event)}</DetailText>
        </DetailRow>
        <DetailRow>
          <DetailIcon>
            <PinIcon width="18px" height="18px" />
          </DetailIcon>
          <DetailText>
            {event.location_name} ({event.location_address},{" "}
            {event.location_extra_info})
          </DetailText>
        </DetailRow>

        {event.latitude && event.longitude && (
          <NaverMapComponent
            latitude={event.latitude}
            longitude={event.longitude}
            locationName={event.location_name}
            mapUrl={event.location_map_url}
          />
        )}

        <SectionTitle>
          참가 예정 ({totalParticipants}/{event.max_participants})
        </SectionTitle>
        <ParticipantsGrid>
          {Array.from(
            new Set(
              event.participants.filter((uid) => uid && uid.trim() !== "")
            )
          )
            .slice(0, 12)
            .map((participantUid, index) => (
              <UserAvatar
                key={`participant-${participantUid}-${index}`}
                uid={participantUid}
                size={40}
                isLeader={false}
                onClick={
                  canViewParticipantProfiles
                    ? () => handleAvatarClick(participantUid)
                    : undefined
                }
                onLongPress={
                  isAdmin
                    ? () => handleAvatarLongPress(participantUid)
                    : undefined
                }
              />
            ))}
          {event.participants.length > 12 && (
            <div
              key="more-participants"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                color: "#666",
              }}
            >
              +{event.participants.length - 12}
            </div>
          )}
        </ParticipantsGrid>

        <SectionTitle>운영진 및 리더</SectionTitle>
        <ParticipantsGrid>
          {Array.from(
            new Set(event.leaders.filter((uid) => uid && uid.trim() !== ""))
          ).map((leaderUid, index) => (
            <UserAvatar
              key={`leader-${leaderUid}-${index}`}
              uid={leaderUid}
              size={40}
              isLeader={true}
              onClick={
                canViewParticipantProfiles
                  ? () => handleAvatarClick(leaderUid)
                  : undefined
              }
              onLongPress={
                isAdmin ? () => handleAvatarLongPress(leaderUid) : undefined
              }
            />
          ))}
        </ParticipantsGrid>

        {eventTopics.length > 0 && (
          <div className="my-4 max-[768px]:my-3">
            <SectionTitle>Discussion Topics</SectionTitle>
            {eventTopics.map((topic, index) => (
              <TopicCard key={topic.id} onClick={() => toggleTopic(topic.id)}>
                <TopicTitle>
                  Topic {index + 1}: {topic.title}
                  <span>{expandedTopics[topic.id] ? "▲" : "▼"}</span>
                </TopicTitle>
                <TopicContent $expanded={expandedTopics[topic.id]}>
                  {"url" in topic && topic.url && (
                    <DetailRow style={{ marginBottom: "1rem" }}>
                      <DetailIcon>🔗</DetailIcon>
                      <DetailText>
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#2196f3" }}
                        >
                          {topic.url}
                        </a>
                      </DetailText>
                    </DetailRow>
                  )}
                  <div
                    style={{
                      marginBottom: "0.5rem",
                      fontWeight: "600",
                      color: "#333",
                    }}
                  >
                    Discussion Points:
                  </div>
                  {topic.discussion_points.map(
                    (point: string, pointIndex: number) => (
                      <DiscussionPoint key={pointIndex}>
                        <span>•</span>
                        <span>{point}</span>
                      </DiscussionPoint>
                    )
                  )}
                </TopicContent>
              </TopicCard>
            ))}
          </div>
        )}

        <div
          ref={actionButtonRef}
          className="min-h-[58px] w-full max-[768px]:min-h-[54px]"
        >
          <ActionButtons $isFloating={isButtonFloating}>
            <ActionButton
              $variant={
                isButtonDisabled
                  ? "locked"
                  : isCurrentUserParticipant
                  ? "cancel"
                  : "join"
              }
              onClick={isButtonDisabled ? undefined : handleJoinClick}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isButtonDisabled ? (
                  "🔒"
                ) : isCurrentUserParticipant ? (
                  <CancelIcon fillColor="#FFFFFF" width="20px" height="20px" />
                ) : (
                  <JoinIcon fillColor="#FFFFFF" width="20px" height="20px" />
                )}
              </span>
              {getButtonText()}
            </ActionButton>
          </ActionButtons>
        </div>

        {(isAdmin ||
          accountStatus === "leader" ||
          (typeof window !== "undefined" &&
            window.location.hostname === "localhost")) && (
          <ActionButtons ref={null} $isFloating={false}>
            <AdminButtons>
              <AdminButton onClick={handleEdit}>
                <PencilSquareIcon />
                <span>Edit Event</span>
              </AdminButton>
              <AdminButton onClick={handleCreateNew}>
                <PlusCircleIcon />
                <span>Create New Event</span>
              </AdminButton>
              <AdminButton onClick={handleDuplicate}>
                <DocumentDuplicateIcon />
                <span>Duplicate Event</span>
              </AdminButton>
              <AdminButton
                onClick={generateSeatingArrangement}
                disabled={seatingLoading}
              >
                <UsersIcon />
                <span>
                  {seatingLoading ? "Generating..." : "Generate Seating"}
                </span>
              </AdminButton>
              <AdminButton onClick={handleSendReminderToParticipants}>
                <MegaphoneIcon />
                <span>Send Reminder</span>
              </AdminButton>
              <AdminButton
                onClick={handleDeleteEvent}
                $variant="danger"
                disabled={deleteLoading}
              >
                <TrashIcon />
                <span>{deleteLoading ? "Deleting..." : "Delete Event"}</span>
              </AdminButton>
            </AdminButtons>
          </ActionButtons>
        )}

        {/* Seating Arrangement Section */}
        {(isAdmin ||
          accountStatus === "leader" ||
          (typeof window !== "undefined" &&
            window.location.hostname === "localhost")) &&
          showSeatingTable && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="mx-0 my-8 rounded-[12px] border border-solid border-[#e0e0e0] bg-[#f8f9fa] p-6 max-[768px]:my-6 max-[768px]:rounded-[8px] max-[768px]:p-4">
                <SectionTitle>좌석 배치</SectionTitle>
                {typeof window !== "undefined" &&
                  window.location.hostname === "localhost" &&
                  !isAdmin &&
                  accountStatus !== "leader" && (
                    <div
                      style={{
                        background: "#fff3cd",
                        border: "1px solid #ffc107",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        marginBottom: "1rem",
                        color: "#856404",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    >
                      🚧 Testing Mode: Seating arrangement visible for localhost
                      development
                    </div>
                  )}
                <div className="mb-6 flex flex-wrap gap-4 max-[768px]:mb-4 max-[768px]:gap-3">
                  <SeatingButton
                    onClick={refreshSeatingArrangement}
                    disabled={seatingLoading}
                  >
                    {seatingLoading ? "배치 중..." : "다시 배치하기"}
                  </SeatingButton>
                  <SeatingButton onClick={() => setShowSeatingTable(false)}>
                    닫기
                  </SeatingButton>
                </div>

                {seatingAssignments.length > 0 ? (
                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 max-[768px]:grid-cols-[1fr] max-[768px]:gap-4">
                    {[1, 2].map((sessionNumber) => (
                      <div key={sessionNumber}>
                        <h3 className="mx-0 mt-0 mb-4 border-b-2 border-solid border-[#333] pb-2 text-center text-[18px] font-bold text-[#333] max-[768px]:mb-3 max-[768px]:text-[16px]">
                          세션 {sessionNumber}
                        </h3>
                        {seatingAssignments
                          .filter(
                            (assignment) =>
                              assignment.sessionNumber === sessionNumber
                          )
                          .map((assignment) => (
                            <SortableContext
                              key={`${sessionNumber}-${assignment.leaderUid}`}
                              items={assignment.participants.map(
                                (p) => `${sessionNumber}-${p.uid}`
                              )}
                              strategy={verticalListSortingStrategy}
                            >
                              <GroupCard
                                key={`${sessionNumber}-${assignment.leaderUid}`}
                                $hasTranscript={!!assignment.transcriptId}
                                onClick={() =>
                                  handleSeatingGroupClick(assignment)
                                }
                              >
                                <LeaderInfo>
                                  <DraggableParticipant
                                    participant={assignment.leaderDetails}
                                    onAvatarClick={handleAvatarClick}
                                    onAvatarLongPress={
                                      isAdmin
                                        ? handleAvatarLongPress
                                        : undefined
                                    }
                                    isLeader={true}
                                    sessionNumber={sessionNumber}
                                  />
                                </LeaderInfo>

                                <ParticipantsList>
                                  {assignment.participants.map(
                                    (participant) => (
                                      <DraggableParticipant
                                        key={`${sessionNumber}-${participant.uid}`}
                                        participant={participant}
                                        onAvatarClick={handleAvatarClick}
                                        onAvatarLongPress={
                                          isAdmin
                                            ? handleAvatarLongPress
                                            : undefined
                                        }
                                        sessionNumber={sessionNumber}
                                      />
                                    )
                                  )}
                                </ParticipantsList>
                              </GroupCard>
                            </SortableContext>
                          ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "#64748b",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    좌석 배치가 아직 생성되지 않았습니다.
                    <br />
                    "🪑 Generate Seating" 버튼을 클릭하여 좌석을 배치하세요.
                  </div>
                )}
              </div>
              <DragOverlay>
                {activeId && activeParticipantData ? (
                  <DraggableParticipant
                    participant={activeParticipantData.participant}
                    onAvatarClick={() => {}} // No action on overlay
                    onAvatarLongPress={undefined}
                    isLeader={activeParticipantData.isLeader}
                    sessionNumber={activeParticipantData.session}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
      </div>

      <AdminEventDialog
        isOpen={showAdminDialog}
        onClose={handleDialogClose}
        templateEvent={dialogTemplateEvent}
        editEvent={dialogEditEvent}
        creatorUid={currentUser?.uid || ""}
        onEventCreated={handleEventCreated}
        onEventUpdated={handleEventUpdated}
      />

      {showRoleChoiceDialog && (
        <DialogOverlay onClick={() => setShowRoleChoiceDialog(false)}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <h3>참여 방식 선택</h3>
            <p>이 밋업에 어떤 역할로 참여하시겠습니까?</p>
            <DialogButton
              $primary
              onClick={() => handleConfirmJoinAsRole("leader")}
            >
              리더로 참여
            </DialogButton>
            <DialogButton
              onClick={() => handleConfirmJoinAsRole("participant")}
            >
              참가자로 참여
            </DialogButton>
            <DialogButton
              onClick={() => setShowRoleChoiceDialog(false)}
              style={{ marginTop: "0.5rem" }}
            >
              취소
            </DialogButton>
          </DialogBox>
        </DialogOverlay>
      )}

      {showSubscriptionDialog && (
        <DialogOverlay onClick={() => setShowSubscriptionDialog(false)}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <h3>구독이 필요합니다</h3>
            <p>밋업에 참가하시려면 활성화된 구독이 필요합니다.</p>
            <p>결제 페이지에서 구독을 시작하시겠습니까?</p>
            <DialogButton $primary onClick={handleGoToPayment}>
              결제 페이지로 이동
            </DialogButton>
            <DialogButton
              onClick={() => setShowSubscriptionDialog(false)}
              style={{ marginTop: "0.5rem" }}
            >
              취소
            </DialogButton>
          </DialogBox>
        </DialogOverlay>
      )}

      {showParticipationSuccessDialog && (
        <DialogOverlay onClick={() => setShowParticipationSuccessDialog(false)}>
            <div
              className="flex w-[90%] max-w-[450px] flex-col gap-6 rounded-[16px] bg-white p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.15)] max-[768px]:max-w-[95%] max-[768px]:gap-5 max-[768px]:rounded-[12px] max-[768px]:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="m-0 flex items-center justify-center gap-2 text-[1.5rem] font-bold text-[#2e7d32] max-[768px]:text-[1.25rem] [&_svg]:h-[1.6rem] [&_svg]:w-[1.6rem] [&_svg]:shrink-0 max-[768px]:[&_svg]:h-[1.35rem] max-[768px]:[&_svg]:w-[1.35rem]">
              <CheckCircleIcon /> 모임 신청이 완료되었습니다!
            </h3>
            <div className="text-[1rem] leading-[1.6] text-[#555] max-[768px]:text-[0.9rem] max-[768px]:leading-[1.5]">
              <p>밋업 참가 신청이 성공적으로 완료되었습니다.</p>
              <p>
                궁금한 점이 있으시면 언제든지{" "}
                <a
                  className="font-semibold text-[#1976d2] no-underline hover:underline"
                  href="https://open.kakao.com/o/gtuiIuvh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  오픈챗
                </a>
                으로 문의해 주세요!
              </p>
              <p
                style={{
                  color: "#2e7d32",
                  fontWeight: "600",
                  fontSize: "1.1em",
                }}
              >
                그럼 모임에서 뵙겠습니다.
              </p>
            </div>
            <button
              className="cursor-pointer rounded-[8px] border-0 bg-[#2e7d32] px-6 py-3.5 text-[1rem] font-semibold text-white [transition:all_0.2s_ease] hover:bg-[#1b5e20] hover:[transform:translateY(-1px)] max-[768px]:px-5 max-[768px]:py-3 max-[768px]:text-[0.9rem]"
              onClick={() => setShowParticipationSuccessDialog(false)}
            >
              확인
            </button>
          </div>
        </DialogOverlay>
      )}

      {showAdminActionDialog && (
        <DialogOverlay onClick={() => setShowAdminActionDialog(false)}>
          <DialogBox onClick={(e) => e.stopPropagation()}>
            <h3>사용자 관리</h3>
            <p>
              이 사용자에 대해 어떤 작업을 하시겠습니까?
              <br />
              <strong>
                {selectedUserDetails
                  ? `${selectedUserDetails.displayName || "익명"} (${
                      selectedUserDetails.phoneLast4 || "****"
                    })`
                  : `User ID: ${selectedUserId}`}
              </strong>
              <br />
              현재 역할: {selectedUserIsLeader ? "리더" : "참가자"}
            </p>

            <DialogButton
              $primary
              onClick={handleChangeRole}
              disabled={adminActionLoading}
            >
              {adminActionLoading
                ? "처리 중..."
                : `${selectedUserIsLeader ? "참가자" : "리더"}로 변경`}
            </DialogButton>

            <DialogButton
              onClick={handleRemoveParticipant}
              disabled={adminActionLoading}
              style={{
                backgroundColor: "#d32f2f",
                color: "white",
                marginTop: "0.5rem",
              }}
            >
              {adminActionLoading ? "처리 중..." : "밋업에서 제거"}
            </DialogButton>

            <DialogButton
              onClick={() => setShowAdminActionDialog(false)}
              style={{ marginTop: "0.5rem" }}
            >
              취소
            </DialogButton>
          </DialogBox>
        </DialogOverlay>
      )}
    </Container>
  );
}
