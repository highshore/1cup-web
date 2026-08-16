"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styled, { keyframes, css } from "styled-components";
import dynamic from "next/dynamic";
import { MeetupEvent } from "../lib/features/meetup/types/meetup_types";
import {
  fetchMeetupEvents,
  MeetupPageCursor,
} from "../lib/features/meetup/services/meetup_service";
import {
  isEventLocked,
  formatEventTitleWithCountdown,
} from "../lib/features/meetup/utils/meetup_helpers";
import { UserAvatarStack } from "../lib/features/meetup/components/user_avatar";
import {
  PinIcon,
  CalendarIcon,
} from "../lib/features/meetup/components/meetup_icons";
import { BlogPost } from "../lib/features/blog/types/blog_types";
import { fetchBlogPosts } from "../lib/features/blog/services/blog_service";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { appLayout } from "../lib/constants/app_layout";
import { useI18n } from "../lib/i18n/I18nProvider";
import { PhotoIcon } from "@heroicons/react/24/outline";

const meetupTheme = {
  text: "#050505",
  muted: "rgba(5, 5, 5, 0.66)",
  soft: "rgba(5, 5, 5, 0.1)",
  border: "#050505",
  smoke: "#f3f3f1",
  accent: "#f47a4a",
  pale: "#fff8dc",
} as const;

// Add subtle glow animation keyframes
const subtleGlow = keyframes`
  0% {
    box-shadow: 4px 4px 0 #050505;
  }
  50% {
    box-shadow: 5px 5px 0 #f47a4a;
  }
  100% {
    box-shadow: 4px 4px 0 #050505;
  }
`;

const NAVBAR_CONTENT_GAP_DESKTOP = "0.75rem";
const NAVBAR_CONTENT_GAP_MOBILE = "0.5rem";

// Styled components - Day Mode Theme
const MeetupContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background-color: transparent;
  color: ${meetupTheme.text};
  padding: ${NAVBAR_CONTENT_GAP_DESKTOP} 0 clamp(2.5rem, 5vw, 3rem);

  @media (max-width: 768px) {
    padding: ${NAVBAR_CONTENT_GAP_MOBILE} 0 clamp(2rem, 6vw, 2.5rem);
  }
`;

const MeetupContent = styled.div`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
  padding: 0 ${appLayout.pageGutterDesktop};

  @media (max-width: 768px) {
    padding: 0;
  }
`;

// Blog Banner Styled Components
const BlogBanner = styled.div<{ $imageUrl?: string }>`
  background: ${(props) =>
    props.$imageUrl
      ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${props.$imageUrl}) center/cover`
      : "#f6f6f6"};
  border-radius: 8px;
  margin: 20px 0;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e5e9;
  height: 160px;
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    border-color: #ff6600;
  }

  @media (max-width: 768px) {
    height: 140px;
    margin: 16px 0;
  }
`;

const BlogBannerContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const BlogBannerText = styled.div`
  flex: 1;
  color: #333;
`;

const BlogBannerLabel = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #ff6600;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    font-size: 0.8rem;
    margin-bottom: 0.375rem;
  }
`;

const BlogBannerTitle = styled.h3<{ $imageUrl?: string }>`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${(props) => (props.$imageUrl ? "white" : "#000")};
  margin: 0;
  line-height: 1.3;
  word-wrap: break-word;
  ${(props) => props.$imageUrl && "text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);"};

  @media (max-width: 768px) {
    font-size: 1rem;
    line-height: 1.2;
  }
`;

// Blog Posts Grid Styled Components
const BlogPostsGrid = styled.div`
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 8px 0 12px;
  margin: 0;

  /* Smooth scrolling */
  scroll-behavior: smooth;

  /* Hide scrollbar but keep functionality */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* Internet Explorer 10+ */

  &::-webkit-scrollbar {
    display: none; /* WebKit */
  }

  @media (max-width: 768px) {
    gap: 0.75rem;
    padding: 6px 0 10px;
  }
`;

const BlogPostCard = styled.div<{ $imageUrl?: string }>`
  background: ${(props) =>
    props.$imageUrl
      ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${props.$imageUrl}) center/cover`
      : meetupTheme.smoke};
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  box-shadow: 3px 3px 0 ${meetupTheme.border};
  border: 2px solid ${meetupTheme.border};
  aspect-ratio: 4 / 3;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 220px;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 ${meetupTheme.accent};
    border-color: ${meetupTheme.border};
  }

  @media (max-width: 768px) {
    width: 160px;
  }
`;

const BlogPostCardContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 1rem;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;

  @media (max-width: 768px) {
    padding: 0.75rem;
  }
`;

const BlogPostCardText = styled.div<{ $imageUrl?: string }>`
  flex: 1;
  color: ${(props) => (props.$imageUrl ? "white" : "#333")};
`;

const BlogPostCardLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 850;
  color: ${meetupTheme.accent};
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    font-size: 0.65rem;
    margin-bottom: 0.25rem;
  }
`;

const BlogPostCardTitle = styled.h3<{ $imageUrl?: string }>`
  font-size: 1.2rem;
  font-weight: 600;
  color: ${(props) => (props.$imageUrl ? "white" : "#000")};
  margin: 0;
  line-height: 1.3;
  word-wrap: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  ${(props) => props.$imageUrl && "text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);"};

  @media (max-width: 768px) {
    font-size: 0.8rem;
    line-height: 1.2;
    -webkit-line-clamp: 2;
  }
`;

const SectionTitle = styled.h2`
  color: #333;
  font-size: 1.4rem;
  font-weight: 800;
  margin: 1.5rem 0 0.75rem 0;
  line-height: 1.25;

  @media (max-width: 768px) {
    font-size: 1.3rem;
    margin: 1.25rem 0 0.625rem 0;
  }
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
  margin: 0.25rem 0 0.75rem;

  @media (max-width: 768px) {
    justify-content: space-between;
  }
`;

const FilterLabel = styled.span`
  font-size: 0.82rem;
  font-weight: 700;
  color: #9ca3af;
`;

const FilterBar = styled.div`
  display: inline-flex;
  gap: 2px;
  border: 1.5px solid #d1d5db;
  border-radius: 999px;
  background: #ffffff;
  padding: 3px;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  border: 0;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? "#111111" : "transparent")};
  color: ${({ $active }) => ($active ? "#ffffff" : "#4b5563")};
  padding: 0.42rem 0.95rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;

  &:hover {
    color: ${({ $active }) => ($active ? "#ffffff" : "#111111")};
  }
`;

const EventCard = styled.div<{ $isPast?: boolean; $isClosest?: boolean }>`
  background-color: #ffffff;
  border-radius: 14px;
  padding: 24px;
  margin: 12px 0;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, border-color 0.18s ease;
  box-shadow: ${(props) =>
    props.$isPast ? "0 1px 4px rgba(0, 0, 0, 0.06)" : `4px 4px 0 ${meetupTheme.border}`};
  border: ${(props) =>
    props.$isPast ? "1px solid rgba(5, 5, 5, 0.08)" : `2px solid ${meetupTheme.border}`};
  width: 100%;
  opacity: ${(props) => (props.$isPast ? 0.52 : 1)};

  /* Add subtle glow animation for closest upcoming event */
  ${(props) =>
    props.$isClosest && !props.$isPast
      ? css`
          animation: ${subtleGlow} 3s ease-in-out infinite;
        `
      : ""}

  &:hover {
    transform: ${(props) => (props.$isPast ? "translateY(-1px)" : "translate(-1px, -1px)")};
    box-shadow: ${(props) =>
      props.$isPast ? "0 3px 10px rgba(0, 0, 0, 0.08)" : `5px 5px 0 ${meetupTheme.accent}`};
    opacity: ${(props) => (props.$isPast ? 0.8 : 1)};
  }

  @media (max-width: 768px) {
    padding: 16px;
    margin: 10px 0;
    border-radius: 12px;
    box-shadow: 3px 3px 0 ${meetupTheme.border};
  }
`;

const EventContent = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 20px;

  @media (max-width: 768px) {
    gap: 12px;
  }
`;

const EventImageContainer = styled.div<{ $isPast?: boolean }>`
  width: 120px;
  height: 120px;
  border: 2px solid ${meetupTheme.border};
  border-radius: 12px;
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

const EventImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const EventImagePlaceholder = styled.div`
  color: #ccc;
  font-size: 2.5rem;

  svg {
    width: 2.5rem;
    height: 2.5rem;
  }

  @media (max-width: 768px) {
    font-size: 1.5rem;

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
`;

const EventDetails = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; // Prevents flex item from overflowing
`;

const EventTitle = styled.h3<{ $isPast?: boolean }>`
  color: ${(props) => (props.$isPast ? "rgba(5, 5, 5, 0.48)" : meetupTheme.text)};
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px 0;
  line-height: 1.3;
  word-wrap: break-word; // Prevents long titles from overflowing

  @media (max-width: 768px) {
    font-size: 15px;
    margin: 0 0 6px 0;
    line-height: 1.2;
  }
`;

const CountdownPrefix = styled.span<{ $isUrgent?: boolean }>`
  color: ${(props) =>
    props.$isUrgent ? "#DC143C" : "inherit"}; /* Crimson for urgent countdown */
  font-weight: ${(props) => (props.$isUrgent ? "bold" : "inherit")};
`;

const EventInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  @media (max-width: 768px) {
    gap: 6px;
    margin-bottom: 4px;
  }
`;

const EventIcon = styled.span<{ $isPast?: boolean }>`
  color: ${(props) => (props.$isPast ? "rgba(5, 5, 5, 0.48)" : meetupTheme.muted)};
  flex-shrink: 0; // Prevents icons from shrinking
  display: flex; // Added for better alignment of SVG
  align-items: center; // Added for better alignment of SVG

  @media (max-width: 768px) {
    /* font-size: 14px; // Removed */
  }
`;

const EventText = styled.span<{ $isPast?: boolean }>`
  color: ${(props) => (props.$isPast ? "rgba(5, 5, 5, 0.48)" : meetupTheme.muted)};
  font-size: 16px;
  letter-spacing: 0;
  word-wrap: break-word; // Prevents long text from overflowing

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

const EventBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px; // Adds gap to prevent overlap
  min-height: 30px; /* Ensure consistent height */

  @media (max-width: 768px) {
    margin-top: 4px;
    gap: 6px;
  }
`;

// New StatusBadge styled component
const StatusBadge = styled.span<{ $statusColor: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff; // White text for better contrast
  background-color: ${(props) => props.$statusColor};
  border: 2px solid ${meetupTheme.border};
  border-radius: 999px;
  text-align: center;
  min-width: 80px; // Minimum width for the badge
  flex-shrink: 0; /* Prevent badge from shrinking */
  white-space: nowrap; /* Keep badge text on one line */
  transition: all 0.2s ease;

  @media (max-width: 768px) {
    font-size: 12px;
    padding: 6px 12px;
    min-width: 80px;
  }
`;

const LoadingContainer = styled.div`
  text-align: center;
  padding: 2rem 1rem;
  color: ${meetupTheme.muted};
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    padding: 1.5rem 0.75rem;
    font-size: 14px;
    min-height: 40vh;
  }
`;

const LoadingAnimation = styled.div`
  width: 150px;
  height: 150px;
  margin-bottom: 1rem;

  @media (max-width: 768px) {
    width: 120px;
    height: 120px;
  }
`;

const LoadMoreButton = styled.button`
  display: block;
  margin: 2rem auto 1rem auto;
  padding: 0.75rem 1.5rem;
  background-color: #ffffff;
  border: 2px solid ${meetupTheme.border};
  border-radius: 999px;
  color: ${meetupTheme.text};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
  box-shadow: 3px 3px 0 ${meetupTheme.accent};

  &:hover {
    background-color: ${meetupTheme.pale};
    border-color: ${meetupTheme.border};
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 ${meetupTheme.accent};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    margin: 1.5rem auto 0.75rem auto;
    font-size: 13px;
    border-radius: 999px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: ${meetupTheme.muted};

  @media (max-width: 768px) {
    padding: 2rem 1rem;
    font-size: 14px;
  }
`;

const MeetupClient: React.FC = () => {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [allEvents, setAllEvents] = useState<MeetupEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<MeetupEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<MeetupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<MeetupPageCursor | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [locationFilter, setLocationFilter] = useState<
    "all" | "yeouido" | "anam"
  >("all");
  const loadMoreButtonRef = useRef<HTMLButtonElement>(null);

  // Infer an event's region from its location text (no explicit region field).
  const eventRegion = (event: MeetupEvent): "yeouido" | "anam" | "other" => {
    const s = `${event.location_name || ""} ${event.location_address || ""}`;
    if (s.includes("여의도") || /yeouido/i.test(s)) return "yeouido";
    if (s.includes("안암") || /anam/i.test(s)) return "anam";
    return "other";
  };

  const matchesFilter = (event: MeetupEvent): boolean =>
    locationFilter === "all" || eventRegion(event) === locationFilter;

  // Helper function to convert MeetupEvent date and time to Date object
  const getEventDateTime = (event: MeetupEvent): Date => {
    return new Date(`${event.date}T${event.time}`);
  };

  // Separate events into upcoming and past
  const categorizeEvents = useCallback((events: MeetupEvent[]) => {
    const now = new Date();
    const upcoming: MeetupEvent[] = [];
    const past: MeetupEvent[] = [];

    events.forEach((event) => {
      if (getEventDateTime(event) >= now) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    // Sort upcoming events by date (ascending)
    upcoming.sort(
      (a, b) => getEventDateTime(a).getTime() - getEventDateTime(b).getTime()
    );

    // Sort past events by date (descending - most recent first)
    past.sort(
      (a, b) => getEventDateTime(b).getTime() - getEventDateTime(a).getTime()
    );

    setUpcomingEvents(upcoming);
    setPastEvents(past);
  }, []);

  // Load initial events
  const loadEvents = useCallback(
    async (reset: boolean = false) => {
      try {
        if (reset) {
          setLoading(true);
          setAllEvents([]);
          setLastDoc(null);
          setHasMore(true);
        } else {
          setLoadingMore(true);
        }

        const result = await fetchMeetupEvents(
          reset ? undefined : lastDoc ?? undefined
        );

        if (reset) {
          setAllEvents(result.events);
          categorizeEvents(result.events);
        } else {
          setAllEvents((prevEvents) => {
            const newAllEvents = [...prevEvents, ...result.events];
            categorizeEvents(newAllEvents);
            return newAllEvents;
          });
        }

        setLastDoc(result.lastDoc);
        setHasMore(result.lastDoc !== null && result.events.length > 0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [lastDoc, categorizeEvents]
  );

  // Load more events
  const loadMoreEvents = useCallback(() => {
    if (!loadingMore && hasMore && lastDoc) {
      loadEvents(false);
    }
  }, [loadingMore, hasMore, lastDoc, loadEvents]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingMore) {
          loadMoreEvents();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
      }
    );

    if (loadMoreButtonRef.current) {
      observer.observe(loadMoreButtonRef.current);
    }

    return () => {
      if (loadMoreButtonRef.current) {
        observer.unobserve(loadMoreButtonRef.current);
      }
    };
  }, [hasMore, loadingMore, loadMoreEvents]);

  // Load all blog posts
  const loadBlogPosts = useCallback(async () => {
    try {
      const posts = await fetchBlogPosts();
      setBlogPosts(posts);
    } catch (err) {
      console.error("Failed to load blog posts:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadEvents(true);
    loadBlogPosts();
  }, []); // Empty dependency array to run only on mount

  // Scroll to top when component mounts or when filters change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleEventClick = (meetupId: string) => {
    router.push(`/meetup/${meetupId}`);
  };

  const handleAvatarClick = (uid: string) => {
    router.push(`/profile/${uid}`);
  };

  const handleBlogClick = (blogPost: BlogPost) => {
    router.push(`/blog/${blogPost.id}`);
  };

  const formatMeetupDateTime = (meetup: MeetupEvent) => {
    const date = new Date(`${meetup.date}T${meetup.time}`);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: locale === "ko" ? "long" : "short",
      day: "numeric",
      weekday: locale === "ko" ? "long" : "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: locale !== "ko",
    }).format(date);
  };

  const renderBlogPosts = () => {
    if (!blogPosts || blogPosts.length === 0) return null;

    return (
      <BlogPostsGrid>
        {blogPosts.map((post) => (
          <BlogPostCard
            key={post.id}
            $imageUrl={post.featuredImage}
            onClick={() => handleBlogClick(post)}
          >
            <BlogPostCardContent>
              <BlogPostCardText $imageUrl={post.featuredImage}>
                <BlogPostCardLabel>{t.meetup.blogPost}</BlogPostCardLabel>
                <BlogPostCardTitle $imageUrl={post.featuredImage}>
                  {post.title}
                </BlogPostCardTitle>
              </BlogPostCardText>
            </BlogPostCardContent>
          </BlogPostCard>
        ))}
      </BlogPostsGrid>
    );
  };

  const renderEventCard = (
    meetup: MeetupEvent,
    isPast: boolean = false,
    isClosest: boolean = false
  ) => {
    const { countdownPrefix, eventTitle, isUrgent } =
      formatEventTitleWithCountdown(meetup);
    const lockStatus = isEventLocked(meetup);
    const isCurrentlyLocked = lockStatus.isLocked;

    // Calculate total participants (leaders + participants)
    const totalParticipants =
      meetup.leaders.length + meetup.participants.length;

    const getStatusText = () => {
      if (isPast) return t.meetup.status.ended;
      if (!isCurrentlyLocked) return t.meetup.status.joinable;
      switch (lockStatus.reason) {
        case "started":
          return t.meetup.status.inProgress;
        case "full":
          return t.meetup.status.full;
        case "lockdown":
          return t.meetup.status.closed;
        default:
          return t.meetup.status.closed;
      }
    };

    const statusColor = isPast
      ? "#757575"
      : isCurrentlyLocked
      ? lockStatus.reason === "full"
        ? "#ff4d4f"
        : "#888"
      : "#4CAF50";

    return (
      <EventCard
        key={meetup.id}
        onClick={() => handleEventClick(meetup.id)}
        $isPast={isPast}
        $isClosest={isClosest}
      >
        <EventContent>
          <EventImageContainer $isPast={isPast}>
            {meetup.image_urls && meetup.image_urls.length > 0 ? (
              <EventImage src={meetup.image_urls[0]} alt={meetup.title} />
            ) : (
              <EventImagePlaceholder>
                <PhotoIcon />
              </EventImagePlaceholder>
            )}
          </EventImageContainer>
          <EventDetails>
            <EventTitle $isPast={isPast}>
              {!isPast && countdownPrefix && (
                <CountdownPrefix $isUrgent={isUrgent}>
                  {countdownPrefix}
                </CountdownPrefix>
              )}
              {eventTitle}
            </EventTitle>
            <EventInfo>
              <EventIcon $isPast={isPast}>
                <PinIcon width="16px" height="16px" />
              </EventIcon>
              <EventText $isPast={isPast}>{meetup.location_name}</EventText>
            </EventInfo>
            <EventInfo>
              <EventIcon $isPast={isPast}>
                <CalendarIcon width="16px" height="16px" />
              </EventIcon>
              <EventText $isPast={isPast}>
                {formatMeetupDateTime(meetup)}
              </EventText>
            </EventInfo>
            <EventBottom>
              <UserAvatarStack
                uids={[...meetup.leaders, ...meetup.participants]}
                maxAvatars={8} // Balanced threshold to prevent overflow - matching homepage
                size={30}
                isPast={isPast}
                onAvatarClick={handleAvatarClick}
              />
              <StatusBadge $statusColor={statusColor}>
                {getStatusText()} ({totalParticipants}/{meetup.max_participants}
                )
              </StatusBadge>
            </EventBottom>
          </EventDetails>
        </EventContent>
      </EventCard>
    );
  };

  return (
    <MeetupContainer>
      <MeetupContent>
        {/* Blog Posts */}
        {blogPosts.length > 0 && <>{renderBlogPosts()}</>}

        {loading && <GlobalLoadingScreen />}

        {error && (
          <EmptyState>
            {t.meetup.sections.errorLoading}: {error}
          </EmptyState>
        )}

        {!loading && !error && (
          <>
            {/* Location filter */}
            <FilterRow>
              <FilterLabel>{t.meetup.filter.label}</FilterLabel>
              <FilterBar role="group" aria-label={t.meetup.filter.label}>
                {(["all", "yeouido", "anam"] as const).map((loc) => (
                  <FilterButton
                    key={loc}
                    type="button"
                    $active={locationFilter === loc}
                    onClick={() => setLocationFilter(loc)}
                  >
                    {t.meetup.filter[loc]}
                  </FilterButton>
                ))}
              </FilterBar>
            </FilterRow>

            {(() => {
              const visibleUpcoming = upcomingEvents.filter(matchesFilter);
              const visiblePast = pastEvents.filter(matchesFilter);
              return (
                <>
                  {/* Upcoming Events Section */}
                  {visibleUpcoming.length > 0 && (
                    <>
                      <SectionTitle>{t.meetup.sections.upcoming}</SectionTitle>
                      {visibleUpcoming.map((meetup, index) =>
                        renderEventCard(meetup, false, index === 0)
                      )}
                    </>
                  )}

                  {/* Past Events Section */}
                  {visiblePast.length > 0 && (
                    <>
                      <SectionTitle>{t.meetup.sections.past}</SectionTitle>
                      {visiblePast.map((meetup) =>
                        renderEventCard(meetup, true, false)
                      )}
                    </>
                  )}

                  {visibleUpcoming.length === 0 &&
                    visiblePast.length === 0 && (
                      <EmptyState>{t.meetup.sections.noEvents}</EmptyState>
                    )}
                </>
              );
            })()}

            {/* Load More Button */}
            {hasMore && (
              <LoadMoreButton
                ref={loadMoreButtonRef}
                onClick={loadMoreEvents}
                disabled={loadingMore}
              >
                {loadingMore
                  ? t.meetup.sections.loadingMore
                  : t.meetup.sections.loadMore}
              </LoadMoreButton>
            )}
          </>
        )}
      </MeetupContent>
    </MeetupContainer>
  );
};

export { MeetupClient };
