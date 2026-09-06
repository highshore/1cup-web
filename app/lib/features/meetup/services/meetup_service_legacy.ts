import { supabase } from "../../../supabase/client";
import {
  FirestoreMeetupEvent,
  MeetupEvent,
  Article,
  MeetupLeaderboardEntry,
  MeetupLeaderboards,
} from "../types/meetup_types";
import {
  convertFirestoreToMeetupEvent,
  sampleFirestoreEvents,
} from "../utils/meetup_helpers";
import { geocodeLocation } from "./geocoding_service";

// Table references (Firestore collections "meetup"/"meetups"/"events" all map to
// the single Supabase table `meetups`).
const MEETUP_TABLE = "meetups";
const ARTICLES_TABLE = "articles";
const PAYMENT_ORDERS_TABLE = "payment_orders";
const DEFAULT_EVENTS_PER_PAGE = 5; // Reduced to 5 for smaller incremental loading

// Offset-based pagination cursor (replaces Firestore's QueryDocumentSnapshot).
export type MeetupPageCursor = number;

type UserLeaderboardProfile = {
  uid: string;
  displayName: string;
  photoURL?: string;
  account_status?: string;
  hasActiveSubscription?: boolean;
  createdAt?: Date | null;
  firstSubscriptionDate?: Date | null;
};

// Fetch the participant/leader uid arrays for a set of meetups from the
// meetup_participants junction table, grouped by meetup id.
const fetchParticipantsForMeetups = async (
  meetupIds: string[]
): Promise<Map<string, { participants: string[]; leaders: string[] }>> => {
  const byMeetup = new Map<
    string,
    { participants: string[]; leaders: string[] }
  >();
  meetupIds.forEach((id) =>
    byMeetup.set(id, { participants: [], leaders: [] })
  );

  if (meetupIds.length === 0) return byMeetup;

  const { data, error } = await supabase
    .from("meetup_participants")
    .select("meetup_id, user_id, role")
    .in("meetup_id", meetupIds)
    .eq("registration_status", "registered");

  if (error) throw error;

  (data || []).forEach((row) => {
    const bucket = byMeetup.get(row.meetup_id);
    if (!bucket) return;
    if (row.role === "leader") {
      bucket.leaders.push(row.user_id);
    } else {
      bucket.participants.push(row.user_id);
    }
  });

  return byMeetup;
};

// Fetch the article ids for a set of meetups from the meetup_articles junction.
const fetchArticlesForMeetups = async (
  meetupIds: string[]
): Promise<Map<string, string[]>> => {
  const byMeetup = new Map<string, string[]>();
  meetupIds.forEach((id) => byMeetup.set(id, []));

  if (meetupIds.length === 0) return byMeetup;

  const { data, error } = await supabase
    .from("meetup_articles")
    .select("meetup_id, article_id")
    .in("meetup_id", meetupIds);

  if (error) throw error;

  (data || []).forEach((row) => {
    const bucket = byMeetup.get(row.meetup_id);
    if (bucket) bucket.push(row.article_id);
  });

  return byMeetup;
};

// Build a MeetupEvent from a meetups row + its junction data.
const rowToMeetupEvent = (
  row: Record<string, unknown>,
  participants: string[],
  leaders: string[],
  articles: string[]
): MeetupEvent => {
  const eventData = {
    ...row,
    id: row.id as string,
    participants,
    leaders,
    articles,
  };
  return convertFirestoreToMeetupEvent(eventData);
};

// Hydrate a list of meetups rows into MeetupEvents (batched junction lookups).
const hydrateMeetupRows = async (
  rows: Record<string, unknown>[]
): Promise<MeetupEvent[]> => {
  const ids = rows.map((r) => r.id as string);
  const [participantsByMeetup, articlesByMeetup] = await Promise.all([
    fetchParticipantsForMeetups(ids),
    fetchArticlesForMeetups(ids),
  ]);

  return rows.map((row) => {
    const id = row.id as string;
    const pl = participantsByMeetup.get(id) || {
      participants: [],
      leaders: [],
    };
    const articles = articlesByMeetup.get(id) || [];
    return rowToMeetupEvent(row, pl.participants, pl.leaders, articles);
  });
};

const resolveDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as {
      toDate?: () => Date;
      seconds?: number;
    };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate();
    }
    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(maybeTimestamp.seconds * 1000);
    }
  }
  return null;
};

const isExcludedLeaderboardUser = (
  profile?: UserLeaderboardProfile
): boolean => {
  const status = profile?.account_status?.toLowerCase();
  return status === "admin" || status === "leader";
};

const isPayingLeaderboardUser = (profile: UserLeaderboardProfile): boolean => {
  return Boolean(
    profile.firstSubscriptionDate || (profile.hasActiveSubscription && profile.createdAt)
  );
};

const getPaidMemberSortDate = (
  profile: UserLeaderboardProfile
): Date | null =>
  profile.firstSubscriptionDate ||
  (profile.hasActiveSubscription ? profile.createdAt : null) ||
  null;

const fetchFirstSubscriptionDates = async (): Promise<Map<string, Date>> => {
  const datesByUserId = new Map<string, Date>();

  try {
    // Read via the public view: payment_orders itself is RLS-restricted to the
    // caller's own rows for the browser, which would leave every other member's
    // first-paid date empty (and break Newest Members ordering). The view exposes
    // only user_id + the earliest subscription_initial_payment date.
    const { data, error } = await supabase
      .from("user_first_paid")
      .select("user_id, first_paid_at");

    if (error) throw error;

    (data || []).forEach((row) => {
      const userId = typeof row.user_id === "string" ? row.user_id : "";
      const paymentDate = resolveDate(row.first_paid_at);
      if (userId && paymentDate) datesByUserId.set(userId, paymentDate);
    });
  } catch (error) {
    console.warn(
      "Unable to fetch initial subscription payment dates for leaderboard; falling back to active subscriber registration dates.",
      error
    );
  }

  return datesByUserId;
};

const createParticipationEntries = (
  counts: Map<string, number>,
  usersById: Map<string, UserLeaderboardProfile>,
  limitCount: number
): MeetupLeaderboardEntry[] => {
  return Array.from(counts.entries())
    .filter(([uid]) => !isExcludedLeaderboardUser(usersById.get(uid)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitCount)
    .map(([uid, count]) => {
      const user = usersById.get(uid);
      return {
        uid,
        displayName: user?.displayName || `User ${uid.substring(0, 6)}`,
        photoURL: user?.photoURL,
        value: count,
      };
    });
};

const getInclusiveMonthSpan = (startDate: Date, endDate: Date): number => {
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  return Math.max(1, yearDiff * 12 + monthDiff + 1);
};

const createParticipationRateEntries = (
  counts: Map<string, number>,
  firstParticipationDates: Map<string, Date>,
  usersById: Map<string, UserLeaderboardProfile>,
  limitCount: number,
  now: Date
): MeetupLeaderboardEntry[] => {
  return Array.from(counts.entries())
    .filter(([uid]) => !isExcludedLeaderboardUser(usersById.get(uid)))
    .map(([uid, count]) => {
      const firstJoinedAt = firstParticipationDates.get(uid) || now;
      const activeMonths = getInclusiveMonthSpan(firstJoinedAt, now);
      const user = usersById.get(uid);

      return {
        uid,
        displayName: user?.displayName || `User ${uid.substring(0, 6)}`,
        photoURL: user?.photoURL,
        value: count / activeMonths,
        meta: String(count),
        joinedAt: firstJoinedAt.toISOString(),
      };
    })
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return Number(b.meta || 0) - Number(a.meta || 0);
    })
    .slice(0, limitCount);
};

// Fetch all meetup events with pagination
export const fetchMeetupEvents = async (
  lastDoc?: MeetupPageCursor,
  limitCount: number = DEFAULT_EVENTS_PER_PAGE
): Promise<{
  events: MeetupEvent[];
  lastDoc: MeetupPageCursor | null;
}> => {
  try {
    const offset = lastDoc ?? 0;

    const { data, error } = await supabase
      .from(MEETUP_TABLE)
      .select("*")
      .order("date_time", { ascending: false }) // Most recent first
      .range(offset, offset + limitCount - 1);

    if (error) throw error;

    const rows = data || [];
    const events = await hydrateMeetupRows(rows);

    // Advance the cursor only if a full page was returned (more may remain).
    const newLastDoc =
      rows.length === limitCount ? offset + rows.length : null;

    return { events, lastDoc: newLastDoc };
  } catch (error) {
    console.error("Error fetching meetup events:", error);
    // Fallback to sample data in development
    if (process.env.NODE_ENV === "development") {
      console.log("Using sample data for development");
      const sampleEvents = Object.values(sampleFirestoreEvents).map(
        convertFirestoreToMeetupEvent
      );
      return { events: sampleEvents.slice(0, limitCount), lastDoc: null };
    }
    throw error;
  }
};

export const fetchMeetupLeaderboards = async (
  limitCount: number = 5
): Promise<MeetupLeaderboards> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(now);

  try {
    const [
      meetupResult,
      usersResult,
      participantsResult,
      firstSubscriptionDatesByUserId,
    ] = await Promise.all([
      supabase
        .from(MEETUP_TABLE)
        .select("id, date_time")
        .order("date_time", { ascending: false }),
      // public_users view exposes only public-safe columns (RLS on `users` restricts
      // the browser to its own row, which would break the leaderboard's name/avatar lookup).
      supabase
        .from("public_users")
        .select(
          "uid, display_name, photo_url, account_status, has_active_subscription, created_at, subscription_start_date"
        ),
      supabase
        .from("meetup_participants")
        .select("meetup_id, user_id, role")
        .eq("registration_status", "registered"),
      fetchFirstSubscriptionDates(),
    ]);

    if (meetupResult.error) throw meetupResult.error;
    if (usersResult.error) throw usersResult.error;
    if (participantsResult.error) throw participantsResult.error;

    const usersById = new Map<string, UserLeaderboardProfile>();
    (usersResult.data || []).forEach((data) => {
      const photoURL = data.photo_url;
      usersById.set(data.uid, {
        uid: data.uid,
        displayName:
          data.display_name || `User ${String(data.uid).substring(0, 6)}`,
        photoURL:
          typeof photoURL === "string" && photoURL.trim() !== ""
            ? photoURL
            : undefined,
        account_status: data.account_status,
        hasActiveSubscription: data.has_active_subscription === true,
        createdAt: resolveDate(data.created_at),
        firstSubscriptionDate:
          firstSubscriptionDatesByUserId.get(data.uid) ||
          resolveDate(data.subscription_start_date),
      });
    });

    // Build a map of meetup id -> event date, and group participant uids per meetup.
    const eventDateById = new Map<string, Date | null>();
    (meetupResult.data || []).forEach((row) => {
      eventDateById.set(row.id, resolveDate(row.date_time));
    });

    const participantsByMeetup = new Map<string, Set<string>>();
    (participantsResult.data || []).forEach((row) => {
      // Only "participant" rows contribute to participation counts (matching the
      // old Firestore meetup.participants[] semantics).
      if (row.role === "leader") return;
      if (!participantsByMeetup.has(row.meetup_id)) {
        participantsByMeetup.set(row.meetup_id, new Set());
      }
      participantsByMeetup.get(row.meetup_id)!.add(row.user_id);
    });

    const totalCounts = new Map<string, number>();
    const monthlyCounts = new Map<string, number>();
    const firstParticipationDates = new Map<string, Date>();

    participantsByMeetup.forEach((participants, meetupId) => {
      const eventDate = eventDateById.get(meetupId) || null;
      const isCurrentMonth =
        !!eventDate && eventDate >= monthStart && eventDate < nextMonthStart;

      participants.forEach((uid) => {
        if (!uid || isExcludedLeaderboardUser(usersById.get(uid))) return;
        totalCounts.set(uid, (totalCounts.get(uid) || 0) + 1);
        if (eventDate) {
          const currentFirstParticipation = firstParticipationDates.get(uid);
          if (
            !currentFirstParticipation ||
            eventDate < currentFirstParticipation
          ) {
            firstParticipationDates.set(uid, eventDate);
          }
        }
        if (isCurrentMonth) {
          monthlyCounts.set(uid, (monthlyCounts.get(uid) || 0) + 1);
        }
      });
    });

    const newMembers = Array.from(usersById.values())
      .filter((user) => {
        if (isExcludedLeaderboardUser(user)) return false;
        return isPayingLeaderboardUser(user);
      })
      .sort(
        (a, b) =>
          (getPaidMemberSortDate(b)?.getTime() || 0) -
          (getPaidMemberSortDate(a)?.getTime() || 0)
      )
      .slice(0, limitCount)
      .map((user) => ({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        value: 1,
        joinedAt: getPaidMemberSortDate(user)?.toISOString(),
      }));

    return {
      monthLabel,
      totalParticipation: createParticipationEntries(
        totalCounts,
        usersById,
        limitCount
      ),
      monthlyParticipation: createParticipationEntries(
        monthlyCounts,
        usersById,
        limitCount
      ),
      participationRate: createParticipationRateEntries(
        totalCounts,
        firstParticipationDates,
        usersById,
        limitCount,
        now
      ),
      newMembers,
    };
  } catch (error) {
    console.error("Error fetching meetup leaderboards:", error);

    if (process.env.NODE_ENV === "development") {
      const totalCounts = new Map<string, number>();
      const monthlyCounts = new Map<string, number>();
      const firstParticipationDates = new Map<string, Date>();

      Object.values(sampleFirestoreEvents).forEach((event) => {
        const eventDate = resolveDate(event.date_time);
        const isCurrentMonth =
          !!eventDate && eventDate >= monthStart && eventDate < nextMonthStart;

        Array.from(new Set(event.participants || [])).forEach((uid) => {
          totalCounts.set(uid, (totalCounts.get(uid) || 0) + 1);
          if (eventDate) {
            const currentFirstParticipation = firstParticipationDates.get(uid);
            if (
              !currentFirstParticipation ||
              eventDate < currentFirstParticipation
            ) {
              firstParticipationDates.set(uid, eventDate);
            }
          }
          if (isCurrentMonth) {
            monthlyCounts.set(uid, (monthlyCounts.get(uid) || 0) + 1);
          }
        });
      });

      const usersById = new Map<string, UserLeaderboardProfile>();
      return {
        monthLabel,
        totalParticipation: createParticipationEntries(
          totalCounts,
          usersById,
          limitCount
        ),
        monthlyParticipation: createParticipationEntries(
          monthlyCounts,
          usersById,
          limitCount
        ),
        participationRate: createParticipationRateEntries(
          totalCounts,
          firstParticipationDates,
          usersById,
          limitCount,
          now
        ),
        newMembers: [],
      };
    }

    throw error;
  }
};

// Fetch upcoming meetup events
export const fetchUpcomingMeetupEvents = async (): Promise<MeetupEvent[]> => {
  try {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from(MEETUP_TABLE)
      .select("*")
      .gte("date_time", nowIso)
      .order("date_time", { ascending: true });

    if (error) throw error;

    return await hydrateMeetupRows(data || []);
  } catch (error) {
    console.error("Error fetching upcoming meetup events:", error);
    // Fallback to sample data in development
    if (process.env.NODE_ENV === "development") {
      console.log("Using sample data for development");
      return Object.values(sampleFirestoreEvents).map(
        convertFirestoreToMeetupEvent
      );
    }
    throw error;
  }
};

// Fetch a single meetup event by ID
export const fetchMeetupEventById = async (
  eventId: string
): Promise<MeetupEvent | null> => {
  try {
    const { data, error } = await supabase
      .from(MEETUP_TABLE)
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const [events] = await hydrateMeetupRows([data]);
    return events || null;
  } catch (error) {
    console.error(`Error fetching meetup event ${eventId}:`, error);
    // Fallback to sample data in development
    if (
      process.env.NODE_ENV === "development" &&
      sampleFirestoreEvents[eventId]
    ) {
      console.log(`Using sample data for event ${eventId}`);
      return convertFirestoreToMeetupEvent(sampleFirestoreEvents[eventId]);
    }
    throw error;
  }
};

// Subscribe to real-time updates for all events (for infinite scroll)
export const subscribeToAllEvents = (
  callback: (events: MeetupEvent[]) => void
) => {
  const load = () => {
    supabase
      .from(MEETUP_TABLE)
      .select("*")
      .order("date_time", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) {
          console.error("Error in real-time subscription:", error);
          if (process.env.NODE_ENV === "development") {
            console.log("Using sample data for real-time subscription");
            const sampleEvents = Object.values(sampleFirestoreEvents).map(
              convertFirestoreToMeetupEvent
            );
            callback(sampleEvents);
          }
          return;
        }
        callback(await hydrateMeetupRows(data || []));
      });
  };

  try {
    load();

    const channel = supabase
      .channel("meetups-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: MEETUP_TABLE },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetup_participants" },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error("Error setting up real-time subscription:", error);
    return () => {};
  }
};

// Subscribe to real-time updates for upcoming events
export const subscribeToUpcomingEvents = (
  callback: (events: MeetupEvent[]) => void
) => {
  const load = () => {
    const nowIso = new Date().toISOString();
    supabase
      .from(MEETUP_TABLE)
      .select("*")
      .gte("date_time", nowIso)
      .order("date_time", { ascending: true })
      .then(async ({ data, error }) => {
        if (error) {
          console.error("Error in real-time subscription:", error);
          if (process.env.NODE_ENV === "development") {
            console.log("Using sample data for real-time subscription");
            const sampleEvents = Object.values(sampleFirestoreEvents).map(
              convertFirestoreToMeetupEvent
            );
            callback(sampleEvents);
          }
          return;
        }
        callback(await hydrateMeetupRows(data || []));
      });
  };

  try {
    load();

    const channel = supabase
      .channel("meetups-upcoming")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: MEETUP_TABLE },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetup_participants" },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error("Error setting up real-time subscription:", error);
    return () => {};
  }
};

// Subscribe to real-time updates for a specific event
export const subscribeToEvent = (
  eventId: string,
  callback: (event: MeetupEvent | null) => void
) => {
  const load = () => {
    fetchMeetupEventById(eventId)
      .then((event) => callback(event))
      .catch((error) => {
        console.error(
          `Error in real-time subscription for event ${eventId}:`,
          error
        );
        if (
          process.env.NODE_ENV === "development" &&
          sampleFirestoreEvents[eventId]
        ) {
          console.log(
            `Using sample data for event ${eventId} real-time subscription`
          );
          callback(
            convertFirestoreToMeetupEvent(sampleFirestoreEvents[eventId])
          );
        } else {
          callback(null);
        }
      });
  };

  try {
    load();

    const channel = supabase
      .channel(`meetup-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: MEETUP_TABLE,
          filter: `id=eq.${eventId}`,
        },
        load
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetup_participants",
          filter: `meetup_id=eq.${eventId}`,
        },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error(
      `Error setting up real-time subscription for event ${eventId}:`,
      error
    );
    return () => {};
  }
};

// Join an event either as a participant or a leader
export const joinEventAsRole = async (
  eventId: string,
  userId: string,
  role: "participant" | "leader"
): Promise<void> => {
  try {
    // Read current participation for this event.
    const { data: rows, error: readError } = await supabase
      .from("meetup_participants")
      .select("user_id, role")
      .eq("meetup_id", eventId);
    if (readError) throw readError;

    const existing = (rows || []).find((r) => r.user_id === userId);

    // Already in the chosen role — nothing to do.
    if (existing && existing.role === role) {
      console.log(`User ${userId} already in the event as ${role}.`);
      return;
    }

    // Prevent joining as a participant if the event is full.
    if (role === "participant") {
      const { data: meetup, error: meetupError } = await supabase
        .from(MEETUP_TABLE)
        .select("max_participants")
        .eq("id", eventId)
        .maybeSingle();
      if (meetupError) throw meetupError;
      if (!meetup) throw new Error("Event does not exist!");

      const currentTotal = (rows || []).length - (existing ? 1 : 0);
      if (currentTotal >= (meetup.max_participants as number)) {
        throw new Error("Event is already full for participants.");
      }
    }

    // Upsert the caller's own row into the new role (RLS: user_id must be self).
    const { error: upsertError } = await supabase
      .from("meetup_participants")
      .upsert(
        { meetup_id: eventId, user_id: userId, role },
        { onConflict: "meetup_id,user_id" }
      );
    if (upsertError) throw upsertError;

    console.log(
      `User ${userId} successfully joined event ${eventId} as ${role}.`
    );
  } catch (error) {
    console.error("Error joining event:", error);
    throw error;
  }
};

// Cancel participation in an event (removes the user's row regardless of role)
export const cancelParticipation = async (
  eventId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("meetup_participants")
      .delete()
      .eq("meetup_id", eventId)
      .eq("user_id", userId);
    if (error) throw error;

    console.log(
      `User ${userId} successfully canceled participation for event ${eventId}.`
    );
  } catch (error) {
    console.error("Error canceling participation:", error);
    throw error;
  }
};

// Create a new meetup event
export const createMeetupEvent = async (
  eventData: Partial<FirestoreMeetupEvent> & { articles?: string[] },
  creatorUid: string
): Promise<string> => {
  try {
    // date_time may arrive as an ISO string or a Date.
    const dateTime =
      eventData.date_time instanceof Date
        ? eventData.date_time.toISOString()
        : (eventData.date_time as string) || new Date().toISOString();

    let latitude = eventData.latitude ?? 0;
    let longitude = eventData.longitude ?? 0;
    const locationAddress = eventData.location_address || "";

    // Geocode only if coordinates are 0 AND an address is available.
    if ((latitude === 0 || longitude === 0) && locationAddress) {
      console.log(`Geocoding for new event: ${locationAddress}`);
      const geocoded = await geocodeLocation(locationAddress);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        console.log(
          `Geocoded to: lat=${geocoded.latitude}, lng=${geocoded.longitude}`
        );
      } else {
        console.warn(
          `Geocoding failed for: ${locationAddress}. Using 0,0.`
        );
        latitude = 0;
        longitude = 0;
      }
    } else if (latitude !== 0 && longitude !== 0) {
      console.log(
        `Using provided coordinates for new event: lat=${latitude}, lng=${longitude}`
      );
    } else {
      console.log(
        "No address to geocode and no valid coordinates provided. Using 0,0."
      );
      latitude = 0;
      longitude = 0;
    }

    // Firestore doc ids were 20-char strings; keep the same key style.
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const rowToSave = {
      id,
      title: eventData.title || "Untitled Event",
      description: eventData.description || "",
      date_time: dateTime,
      duration_minutes: eventData.duration_minutes || 60,
      image_urls: eventData.image_urls || [],
      lockdown_minutes:
        eventData.lockdown_minutes === undefined
          ? 10
          : eventData.lockdown_minutes,
      max_participants: eventData.max_participants || 20,
      topics: eventData.topics || [],
      location_name: eventData.location_name || "",
      location_address: locationAddress,
      location_map_url: eventData.location_map_url || "",
      latitude,
      longitude,
      location_extra_info: eventData.location_extra_info || "",
    };

    const { error: insertError } = await supabase
      .from(MEETUP_TABLE)
      .insert(rowToSave);
    if (insertError) throw insertError;

    // Creator becomes the default leader (junction row).
    const leaders = eventData.leaders || [creatorUid];
    if (leaders.length > 0) {
      const { error: leaderError } = await supabase
        .from("meetup_participants")
        .upsert(
          leaders.map((uid) => ({
            meetup_id: id,
            user_id: uid,
            role: "leader" as const,
          })),
          { onConflict: "meetup_id,user_id" }
        );
      if (leaderError) throw leaderError;
    }

    // Discussion topic articles → meetup_articles junction.
    const articles = eventData.articles || [];
    if (articles.length > 0) {
      const { error: articleError } = await supabase
        .from("meetup_articles")
        .upsert(
          articles.map((articleId) => ({
            meetup_id: id,
            article_id: articleId,
          })),
          { onConflict: "meetup_id,article_id" }
        );
      if (articleError) throw articleError;
    }

    console.log("Event created successfully with ID:", id);
    return id;
  } catch (error) {
    console.error("Error creating meetup event:", error);
    throw error;
  }
};

// Update an existing meetup event
export const updateMeetupEvent = async (
  eventId: string,
  eventData: Partial<FirestoreMeetupEvent> & { articles?: string[] }
): Promise<void> => {
  try {
    // Separate the relational fields (articles) from the scalar meetups columns.
    const { articles, leaders, participants, ...scalarData } = eventData as Record<
      string,
      unknown
    >;

    const updateData: Record<string, unknown> = { ...scalarData };

    // Normalize date_time if provided as a Date.
    if (updateData.date_time instanceof Date) {
      updateData.date_time = updateData.date_time.toISOString();
    }

    // Geocoding (same policy as the Firestore version).
    let needsGeocoding = false;
    if (typeof updateData.location_address === "string") {
      if (
        updateData.latitude === undefined ||
        updateData.longitude === undefined ||
        updateData.latitude === 0 ||
        updateData.longitude === 0
      ) {
        needsGeocoding = true;
      }
    }

    if (needsGeocoding && updateData.location_address) {
      console.log(
        `Geocoding for event update (ID: ${eventId}): ${updateData.location_address}`
      );
      const geocoded = await geocodeLocation(
        updateData.location_address as string
      );
      if (geocoded) {
        updateData.latitude = geocoded.latitude;
        updateData.longitude = geocoded.longitude;
        console.log(
          `Geocoded to: lat=${geocoded.latitude}, lng=${geocoded.longitude}`
        );
      } else {
        console.warn(
          `Geocoding failed for: ${updateData.location_address}. Falling back to 0,0 where needed.`
        );
        if (updateData.latitude === undefined || updateData.latitude === 0)
          updateData.latitude = 0;
        if (updateData.longitude === undefined || updateData.longitude === 0)
          updateData.longitude = 0;
      }
    } else if (
      updateData.latitude !== undefined &&
      updateData.longitude !== undefined
    ) {
      console.log(
        `Using provided coordinates for event update (ID: ${eventId}): lat=${updateData.latitude}, lng=${updateData.longitude}`
      );
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from(MEETUP_TABLE)
        .update(updateData)
        .eq("id", eventId);
      if (updateError) throw updateError;
    }

    // Reconcile the article junction rows if articles were provided.
    if (Array.isArray(articles)) {
      const { error: deleteError } = await supabase
        .from("meetup_articles")
        .delete()
        .eq("meetup_id", eventId);
      if (deleteError) throw deleteError;

      if (articles.length > 0) {
        const { error: insertError } = await supabase
          .from("meetup_articles")
          .upsert(
            (articles as string[]).map((articleId) => ({
              meetup_id: eventId,
              article_id: articleId,
            })),
            { onConflict: "meetup_id,article_id" }
          );
        if (insertError) throw insertError;
      }
    }

    console.log("Event updated successfully:", eventId);
  } catch (error) {
    console.error(`Error updating meetup event (ID: ${eventId}):`, error);
    throw error;
  }
};

// Fetch recent articles for topic selection
export const fetchRecentArticles = async (
  limitCount: number = 10,
  lastDoc?: MeetupPageCursor
): Promise<{
  articles: Article[];
  lastDoc: MeetupPageCursor | null;
  hasMore: boolean;
}> => {
  try {
    const offset = lastDoc ?? 0;

    const { data, error } = await supabase
      .from(ARTICLES_TABLE)
      .select("id, title, timestamp")
      .order("timestamp", { ascending: false })
      .range(offset, offset + limitCount - 1);

    if (error) throw error;

    const rows = data || [];
    const articles: Article[] = rows.map((row) => ({
      id: row.id,
      title: row.title || { english: "", korean: "" },
      timestamp: row.timestamp,
    }));

    const hasMore = rows.length === limitCount;
    const newLastDoc = rows.length > 0 ? offset + rows.length : null;

    return {
      articles,
      lastDoc: hasMore ? newLastDoc : null,
      hasMore,
    };
  } catch (error) {
    console.error("Error fetching articles:", error);
    return {
      articles: [],
      lastDoc: null,
      hasMore: false,
    };
  }
};

// Fetch articles by IDs
export const fetchArticlesByIds = async (
  articleIds: string[]
): Promise<Article[]> => {
  try {
    if (articleIds.length === 0) return [];

    const { data, error } = await supabase
      .from(ARTICLES_TABLE)
      .select("id, title, timestamp")
      .in("id", articleIds);

    if (error) throw error;

    const byId = new Map<string, Article>();
    (data || []).forEach((row) => {
      byId.set(row.id, {
        id: row.id,
        title: row.title || { english: "", korean: "" },
        timestamp: row.timestamp,
      });
    });

    // Preserve the requested ordering.
    return articleIds
      .map((id) => byId.get(id))
      .filter((a): a is Article => Boolean(a));
  } catch (error) {
    console.error("Error fetching articles by IDs:", error);
    return [];
  }
};

// Admin function to remove a participant from an event
export const removeParticipant = async (
  eventId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("meetup_participants")
      .delete()
      .eq("meetup_id", eventId)
      .eq("user_id", userId);
    if (error) throw error;

    console.log(`User ${userId} successfully removed from event ${eventId}.`);
  } catch (error) {
    console.error("Error removing participant:", error);
    throw error;
  }
};

// Admin function to change a user's role between participant and leader
export const changeUserRole = async (
  eventId: string,
  userId: string,
  newRole: "participant" | "leader"
): Promise<void> => {
  try {
    // Upsert the row with the new role (a user has at most one row per meetup).
    const { error } = await supabase
      .from("meetup_participants")
      .upsert(
        { meetup_id: eventId, user_id: userId, role: newRole },
        { onConflict: "meetup_id,user_id" }
      );
    if (error) throw error;

    console.log(
      `User ${userId} successfully changed to ${newRole} for event ${eventId}.`
    );
  } catch (error) {
    console.error("Error changing user role:", error);
    throw error;
  }
};

// Admin function to delete an event permanently
export const deleteMeetupEvent = async (eventId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from(MEETUP_TABLE)
      .delete()
      .eq("id", eventId);
    if (error) throw error;

    console.log(`Event ${eventId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting meetup event:", error);
    throw error;
  }
};
