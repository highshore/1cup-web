"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import "./meetup.css";
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

// Shared class fragments (Day Mode Theme)
const emptyStateClass =
  "py-12 px-4 text-center text-[rgba(5,5,5,0.66)] max-[768px]:py-8 max-[768px]:px-4 max-[768px]:text-[14px]";

const sectionTitleClass =
  "mx-0 mt-6 mb-3 text-[1.4rem] font-extrabold leading-[1.25] text-[#333] max-[768px]:mt-5 max-[768px]:mb-2.5 max-[768px]:text-[1.3rem]";

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
      <div className="m-0 flex gap-4 overflow-x-auto pt-[8px] pb-[12px] scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[768px]:gap-3 max-[768px]:pt-[6px] max-[768px]:pb-[10px]">
        {blogPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => handleBlogClick(post)}
            className="relative aspect-[4/3] w-[220px] shrink-0 cursor-pointer overflow-hidden rounded-[14px] border-2 border-solid border-[#050505] shadow-[3px_3px_0_#050505] [transition:transform_0.18s_ease,box-shadow_0.18s_ease,border-color_0.18s_ease] hover:border-[#050505] hover:shadow-[4px_4px_0_#f47a4a] hover:[transform:translate(-1px,-1px)] max-[768px]:w-[160px]"
            style={{
              background: post.featuredImage
                ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${post.featuredImage}) center/cover`
                : meetupTheme.smoke,
            }}
          >
            <div className="absolute top-0 left-0 flex h-full w-full flex-col items-start justify-center p-4 max-[768px]:p-3">
              <div
                className={`flex-1 ${
                  post.featuredImage ? "text-white" : "text-[#333]"
                }`}
              >
                <div className="mb-1.5 text-[0.8rem] [font-weight:850] uppercase tracking-[0.5px] text-[#f47a4a] max-[768px]:mb-1 max-[768px]:text-[0.65rem]">
                  {t.meetup.blogPost}
                </div>
                <h3
                  className={`m-0 line-clamp-3 break-words text-[1.2rem] font-semibold leading-[1.3] max-[768px]:line-clamp-2 max-[768px]:text-[0.8rem] max-[768px]:leading-[1.2] ${
                    post.featuredImage
                      ? "text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)]"
                      : "text-[#000]"
                  }`}
                >
                  {post.title}
                </h3>
              </div>
            </div>
          </div>
        ))}
      </div>
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

    const cardStateClasses = isPast
      ? "border border-solid border-[rgba(5,5,5,0.08)] opacity-[0.52] shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:opacity-80 hover:shadow-[0_3px_10px_rgba(0,0,0,0.08)] hover:[transform:translateY(-1px)] max-[768px]:hover:shadow-[0_3px_10px_rgba(0,0,0,0.08)]"
      : "border-2 border-solid border-[#050505] shadow-[4px_4px_0_#050505] hover:shadow-[5px_5px_0_#f47a4a] hover:[transform:translate(-1px,-1px)] max-[768px]:hover:shadow-[5px_5px_0_#f47a4a]";

    const mutedColor = isPast
      ? "text-[rgba(5,5,5,0.48)]"
      : "text-[rgba(5,5,5,0.66)]";

    return (
      <div
        key={meetup.id}
        onClick={() => handleEventClick(meetup.id)}
        className={`my-[12px] w-full cursor-pointer rounded-[14px] bg-white p-[24px] [transition:transform_0.18s_ease,box-shadow_0.18s_ease,opacity_0.18s_ease,border-color_0.18s_ease] max-[768px]:my-[10px] max-[768px]:rounded-[12px] max-[768px]:p-[16px] max-[768px]:shadow-[3px_3px_0_#050505] ${cardStateClasses} ${
          isClosest && !isPast
            ? "animate-[meetup-subtle-glow_3s_ease-in-out_infinite]"
            : ""
        }`}
      >
        <div className="flex items-start gap-[20px] max-[768px]:gap-[12px]">
          <div
            className={`flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border-2 border-solid border-[#050505] bg-[#000000] max-[768px]:h-[80px] max-[768px]:w-[80px] ${
              isPast ? "grayscale-[50%]" : ""
            }`}
          >
            {meetup.image_urls && meetup.image_urls.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="h-full w-full object-cover"
                src={meetup.image_urls[0]}
                alt={meetup.title}
              />
            ) : (
              <div className="text-[2.5rem] text-[#ccc] [&_svg]:h-10 [&_svg]:w-10 max-[768px]:text-[1.5rem] max-[768px]:[&_svg]:h-6 max-[768px]:[&_svg]:w-6">
                <PhotoIcon />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <h3
              className={`mx-0 mt-0 mb-[8px] break-words text-[18px] font-bold leading-[1.3] max-[768px]:mb-[6px] max-[768px]:text-[15px] max-[768px]:leading-[1.2] ${
                isPast ? "text-[rgba(5,5,5,0.48)]" : "text-[#050505]"
              }`}
            >
              {!isPast && countdownPrefix && (
                <span
                  className={
                    isUrgent
                      ? "font-bold text-[#DC143C]" /* Crimson for urgent countdown */
                      : undefined
                  }
                >
                  {countdownPrefix}
                </span>
              )}
              {eventTitle}
            </h3>
            <div className="mb-[8px] flex items-center gap-[8px] max-[768px]:mb-[4px] max-[768px]:gap-[6px]">
              <span className={`flex shrink-0 items-center ${mutedColor}`}>
                <PinIcon width="16px" height="16px" />
              </span>
              <span
                className={`break-words text-[16px] tracking-normal max-[768px]:text-[13px] ${mutedColor}`}
              >
                {meetup.location_name}
              </span>
            </div>
            <div className="mb-[8px] flex items-center gap-[8px] max-[768px]:mb-[4px] max-[768px]:gap-[6px]">
              <span className={`flex shrink-0 items-center ${mutedColor}`}>
                <CalendarIcon width="16px" height="16px" />
              </span>
              <span
                className={`break-words text-[16px] tracking-normal max-[768px]:text-[13px] ${mutedColor}`}
              >
                {formatMeetupDateTime(meetup)}
              </span>
            </div>
            <div className="mt-[8px] flex min-h-[30px] items-center justify-between gap-[8px] max-[768px]:mt-[4px] max-[768px]:gap-[6px]">
              <UserAvatarStack
                uids={[...meetup.leaders, ...meetup.participants]}
                maxAvatars={8} // Balanced threshold to prevent overflow - matching homepage
                size={30}
                isPast={isPast}
                onAvatarClick={handleAvatarClick}
              />
              <span
                className="inline-flex min-w-[80px] shrink-0 items-center justify-center whitespace-nowrap rounded-[999px] border-2 border-solid border-[#050505] px-[16px] py-[8px] text-center text-[14px] font-bold text-[#ffffff] [transition:all_0.2s_ease] max-[768px]:px-[12px] max-[768px]:py-[6px] max-[768px]:text-[12px]"
                style={{ backgroundColor: statusColor }}
              >
                {getStatusText()} ({totalParticipants}/{meetup.max_participants}
                )
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-transparent pt-3 pb-[clamp(2.5rem,5vw,3rem)] text-[#050505] max-[768px]:pt-2 max-[768px]:pb-[clamp(2rem,6vw,2.5rem)]">
      <div className="mx-auto w-full max-w-page px-gutter max-[768px]:px-0">
        {/* Blog Posts */}
        {blogPosts.length > 0 && <>{renderBlogPosts()}</>}

        {loading && <GlobalLoadingScreen />}

        {error && (
          <div className={emptyStateClass}>
            {t.meetup.sections.errorLoading}: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Location filter */}
            <div className="mt-1 mb-3 flex items-center justify-end gap-[0.55rem] max-[768px]:justify-between">
              <span className="text-[0.82rem] font-bold text-[#9ca3af]">
                {t.meetup.filter.label}
              </span>
              <div
                className="inline-flex gap-[2px] rounded-[999px] border-[1.5px] border-solid border-[#d1d5db] bg-[#ffffff] p-[3px]"
                role="group"
                aria-label={t.meetup.filter.label}
              >
                {(["all", "yeouido", "anam"] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocationFilter(loc)}
                    className={`cursor-pointer rounded-[999px] border-0 px-[0.95rem] py-[0.42rem] text-[0.84rem] font-bold [transition:background_150ms_ease,color_150ms_ease] ${
                      locationFilter === loc
                        ? "bg-[#111111] text-[#ffffff] hover:text-[#ffffff]"
                        : "bg-transparent text-[#4b5563] hover:text-[#111111]"
                    }`}
                  >
                    {t.meetup.filter[loc]}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const visibleUpcoming = upcomingEvents.filter(matchesFilter);
              const visiblePast = pastEvents.filter(matchesFilter);
              return (
                <>
                  {/* Upcoming Events Section */}
                  {visibleUpcoming.length > 0 && (
                    <>
                      <h2 className={sectionTitleClass}>
                        {t.meetup.sections.upcoming}
                      </h2>
                      {visibleUpcoming.map((meetup, index) =>
                        renderEventCard(meetup, false, index === 0)
                      )}
                    </>
                  )}

                  {/* Past Events Section */}
                  {visiblePast.length > 0 && (
                    <>
                      <h2 className={sectionTitleClass}>
                        {t.meetup.sections.past}
                      </h2>
                      {visiblePast.map((meetup) =>
                        renderEventCard(meetup, true, false)
                      )}
                    </>
                  )}

                  {visibleUpcoming.length === 0 &&
                    visiblePast.length === 0 && (
                      <div className={emptyStateClass}>
                        {t.meetup.sections.noEvents}
                      </div>
                    )}
                </>
              );
            })()}

            {/* Load More Button */}
            {hasMore && (
              <button
                ref={loadMoreButtonRef}
                onClick={loadMoreEvents}
                disabled={loadingMore}
                className="mx-auto mt-8 mb-4 block min-w-[100px] cursor-pointer rounded-[999px] border-2 border-solid border-[#050505] bg-[#ffffff] px-6 py-3 text-[14px] font-semibold text-[#050505] shadow-[3px_3px_0_#f47a4a] [transition:all_0.2s] hover:border-[#050505] hover:bg-[#fff8dc] hover:shadow-[4px_4px_0_#f47a4a] enabled:hover:[transform:translate(-1px,-1px)] disabled:cursor-not-allowed disabled:opacity-50 max-[768px]:mt-6 max-[768px]:mb-3 max-[768px]:rounded-[999px] max-[768px]:px-5 max-[768px]:py-2.5 max-[768px]:text-[13px]"
              >
                {loadingMore
                  ? t.meetup.sections.loadingMore
                  : t.meetup.sections.loadMore}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export { MeetupClient };
