"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styled, { keyframes, css } from "styled-components";
import dynamic from "next/dynamic";
import { MeetupEvent } from "../lib/features/meetup/types/meetup_types";
import { fetchMeetupEvents } from "../lib/features/meetup/services/meetup_service";
import {
  isEventLocked,
  formatEventTitleWithCountdown,
} from "../lib/features/meetup/utils/meetup_helpers";
import { UserAvatarStack } from "../lib/features/meetup/components/user_avatar";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import {
  PinIcon,
  CalendarIcon,
} from "../lib/features/meetup/components/meetup_icons";
import { BlogPost } from "../lib/features/blog/types/blog_types";
import { fetchBlogPosts } from "../lib/features/blog/services/blog_service";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { appLayout } from "../lib/constants/app_layout";
import { useI18n } from "../lib/i18n/I18nProvider";

// Add subtle glow animation keyframes
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

const NAVBAR_CONTENT_GAP_DESKTOP = "0.75rem";
const NAVBAR_CONTENT_GAP_MOBILE = "0.5rem";

// Styled components - Day Mode Theme
const MeetupContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background-color: transparent;
  color: #333;
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
      : "#f6f6f6"};
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e5e9;
  aspect-ratio: 4 / 3;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 220px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    border-color: #ff6600;
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
  font-weight: 600;
  color: #ff6600;
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

  @media (max-width: 768px) {
    font-size: 1.3rem;
    margin: 1.25rem 0 0.625rem 0;
  }
`;

const EventCard = styled.div<{ $isPast?: boolean; $isClosest?: boolean }>`
  background-color: white;
  border-radius: 20px;
  padding: 24px;
  margin: 12px 0;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
  width: 100%;
  opacity: ${(props) => (props.$isPast ? 0.6 : 1)};

  /* Add subtle glow animation for closest upcoming event */
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
    margin: 10px 0;
    border-radius: 16px;
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

const EventImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const EventImagePlaceholder = styled.div`
  color: #ccc;
  font-size: 2.5rem;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const EventDetails = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; // Prevents flex item from overflowing
`;

const EventTitle = styled.h3<{ $isPast?: boolean }>`
  color: ${(props) => (props.$isPast ? "#999" : "#333")};
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
  color: ${(props) => (props.$isPast ? "#999" : "#666")};
  flex-shrink: 0; // Prevents icons from shrinking
  display: flex; // Added for better alignment of SVG
  align-items: center; // Added for better alignment of SVG

  @media (max-width: 768px) {
    /* font-size: 14px; // Removed */
  }
`;

const EventText = styled.span<{ $isPast?: boolean }>`
  color: ${(props) => (props.$isPast ? "#999" : "#666")};
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
  display: inline-block;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff; // White text for better contrast
  background-color: ${(props) => props.$statusColor};
  border-radius: 20px;
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
  color: #666;
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
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 25px;
  color: #666;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;

  &:hover {
    background-color: #eeeeee;
    border-color: #bbb;
    transform: translateY(-1px);
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
    border-radius: 20px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #666;

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
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const loadMoreButtonRef = useRef<HTMLButtonElement>(null);

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

  const handleAvatarClick = () => {
    // Handle avatar click - could show user profile modal, etc.
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
              <EventImagePlaceholder>🖼️</EventImagePlaceholder>
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

        {loading && <GlobalLoadingScreen size="large" />}

        {error && (
          <EmptyState>
            {t.meetup.sections.errorLoading}: {error}
          </EmptyState>
        )}

        {!loading && !error && (
          <>
            {/* Upcoming Events Section */}
            {upcomingEvents.length > 0 && (
              <>
                <SectionTitle>{t.meetup.sections.upcoming}</SectionTitle>
                {upcomingEvents.map((meetup, index) =>
                  renderEventCard(meetup, false, index === 0)
                )}
              </>
            )}

            {/* Past Events Section */}
            {pastEvents.length > 0 && (
              <>
                <SectionTitle>{t.meetup.sections.past}</SectionTitle>
                {pastEvents.map((meetup) =>
                  renderEventCard(meetup, true, false)
                )}
              </>
            )}

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

            {/* No Events Message */}
            {upcomingEvents.length === 0 &&
              pastEvents.length === 0 &&
              !loading && <EmptyState>{t.meetup.sections.noEvents}</EmptyState>}
          </>
        )}
      </MeetupContent>
    </MeetupContainer>
  );
};

export { MeetupClient };
