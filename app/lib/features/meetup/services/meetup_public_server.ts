import "server-only";

import { admin } from "../../../supabase/server";
import type {
  MeetupEvent,
  MeetupLeaderboardEntry,
  MeetupLeaderboards,
} from "../types/meetup_types";

const QUERY_TIMEOUT_MS = 7_000;
const MAX_PAGE_SIZE = 50;
const SEOUL_TIME_ZONE = "Asia/Seoul";

type UserLeaderboardProfile = {
  uid: string;
  displayName: string;
  photoURL?: string;
  accountStatus?: string;
  hasActiveSubscription?: boolean;
  createdAt?: Date | null;
  firstSubscriptionDate?: Date | null;
};

function querySignal() {
  return AbortSignal.timeout(QUERY_TIMEOUT_MS);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatSeoulDateTime(value: unknown) {
  const date = resolveDate(value) ?? new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function rowToMeetupEvent(
  row: Record<string, unknown>,
  participants: string[],
  leaders: string[],
  articles: string[],
): MeetupEvent {
  const { date, time } = formatSeoulDateTime(row.date_time);
  return {
    id: String(row.id),
    title: String(row.title || ""),
    date,
    time,
    description: String(row.description || ""),
    location_name: String(row.location_name || ""),
    location_address: String(row.location_address || ""),
    location_map_url: String(row.location_map_url || ""),
    latitude: Number(row.latitude || 0),
    longitude: Number(row.longitude || 0),
    location_extra_info: String(row.location_extra_info || ""),
    duration_minutes: Number(row.duration_minutes || 0),
    lockdown_minutes: Number(row.lockdown_minutes || 0),
    max_participants: Number(row.max_participants || 0),
    participants,
    leaders,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls.map(String) : [],
    topics: Array.isArray(row.topics)
      ? (row.topics as { topic_id: string }[])
      : [],
    articles,
  };
}

function isExcludedLeaderboardUser(profile?: UserLeaderboardProfile) {
  const status = profile?.accountStatus?.toLowerCase();
  return status === "admin" || status === "leader";
}

function isPayingLeaderboardUser(profile: UserLeaderboardProfile) {
  return Boolean(
    profile.firstSubscriptionDate ||
      (profile.hasActiveSubscription && profile.createdAt),
  );
}

function paidMemberSortDate(profile: UserLeaderboardProfile): Date | null {
  return (
    profile.firstSubscriptionDate ||
    (profile.hasActiveSubscription ? profile.createdAt ?? null : null)
  );
}

function inclusiveMonthSpan(startDate: Date, endDate: Date) {
  const yearDiff = endDate.getUTCFullYear() - startDate.getUTCFullYear();
  const monthDiff = endDate.getUTCMonth() - startDate.getUTCMonth();
  return Math.max(1, yearDiff * 12 + monthDiff + 1);
}

function participationEntries(
  counts: Map<string, number>,
  usersById: Map<string, UserLeaderboardProfile>,
  limitCount: number,
): MeetupLeaderboardEntry[] {
  return Array.from(counts.entries())
    .filter(([uid]) => !isExcludedLeaderboardUser(usersById.get(uid)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitCount)
    .map(([uid, count]) => {
      const user = usersById.get(uid);
      return {
        uid,
        displayName: user?.displayName || `User ${uid.substring(0, 6)}`,
        ...(user?.photoURL ? { photoURL: user.photoURL } : {}),
        value: count,
      };
    });
}

function participationRateEntries(
  counts: Map<string, number>,
  firstParticipationDates: Map<string, Date>,
  usersById: Map<string, UserLeaderboardProfile>,
  limitCount: number,
  now: Date,
): MeetupLeaderboardEntry[] {
  return Array.from(counts.entries())
    .filter(([uid]) => !isExcludedLeaderboardUser(usersById.get(uid)))
    .map(([uid, count]) => {
      const firstJoinedAt = firstParticipationDates.get(uid) || now;
      const activeMonths = inclusiveMonthSpan(firstJoinedAt, now);
      const user = usersById.get(uid);
      return {
        uid,
        displayName: user?.displayName || `User ${uid.substring(0, 6)}`,
        ...(user?.photoURL ? { photoURL: user.photoURL } : {}),
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
}

export async function fetchMeetupEventsPageServer(
  offset = 0,
  requestedLimit = 5,
): Promise<{ events: MeetupEvent[]; lastDoc: number | null }> {
  const limit = clamp(Math.floor(requestedLimit) || 5, 1, MAX_PAGE_SIZE);
  const safeOffset = Math.max(0, Math.floor(offset) || 0);
  const supabase = admin();

  const { data: rows, error } = await supabase
    .from("meetups")
    .select("*")
    .order("date_time", { ascending: false })
    .range(safeOffset, safeOffset + limit - 1)
    .abortSignal(querySignal());

  if (error) throw error;
  const meetupRows = (rows || []) as Record<string, unknown>[];
  if (meetupRows.length === 0) return { events: [], lastDoc: null };

  const ids = meetupRows.map((row) => String(row.id));
  const [participantsResult, articlesResult] = await Promise.all([
    supabase
      .from("meetup_participants")
      .select("meetup_id,user_id,role")
      .in("meetup_id", ids)
      .abortSignal(querySignal()),
    supabase
      .from("meetup_articles")
      .select("meetup_id,article_id")
      .in("meetup_id", ids)
      .abortSignal(querySignal()),
  ]);

  if (participantsResult.error) throw participantsResult.error;
  if (articlesResult.error) throw articlesResult.error;

  const people = new Map<string, { participants: string[]; leaders: string[] }>();
  const articles = new Map<string, string[]>();
  ids.forEach((id) => {
    people.set(id, { participants: [], leaders: [] });
    articles.set(id, []);
  });

  (participantsResult.data || []).forEach((row) => {
    const bucket = people.get(String(row.meetup_id));
    if (!bucket) return;
    if (row.role === "leader") bucket.leaders.push(String(row.user_id));
    else bucket.participants.push(String(row.user_id));
  });
  (articlesResult.data || []).forEach((row) => {
    articles.get(String(row.meetup_id))?.push(String(row.article_id));
  });

  const events = meetupRows.map((row) => {
    const id = String(row.id);
    const bucket = people.get(id) || { participants: [], leaders: [] };
    return rowToMeetupEvent(
      row,
      bucket.participants,
      bucket.leaders,
      articles.get(id) || [],
    );
  });

  return {
    events,
    lastDoc: meetupRows.length === limit ? safeOffset + meetupRows.length : null,
  };
}

export async function fetchMeetupLeaderboardsServer(
  requestedLimit = 5,
): Promise<MeetupLeaderboards> {
  const limitCount = clamp(Math.floor(requestedLimit) || 5, 1, 20);
  const supabase = admin();
  const now = new Date();

  // Month boundaries in Asia/Seoul, represented as UTC instants.
  const seoulNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = seoulNow.getUTCFullYear();
  const month = seoulNow.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000);
  const nextMonthStart = new Date(
    Date.UTC(year, month + 1, 1) - 9 * 60 * 60 * 1000,
  );

  const [meetupResult, usersResult, participantsResult, paidResult] =
    await Promise.all([
      supabase
        .from("meetups")
        .select("id,date_time")
        .order("date_time", { ascending: false })
        .abortSignal(querySignal()),
      supabase
        .from("public_users")
        .select(
          "uid,display_name,photo_url,account_status,has_active_subscription,created_at,subscription_start_date",
        )
        .abortSignal(querySignal()),
      supabase
        .from("meetup_participants")
        .select("meetup_id,user_id,role")
        .abortSignal(querySignal()),
      supabase
        .from("user_first_paid")
        .select("user_id,first_paid_at")
        .abortSignal(querySignal()),
    ]);

  if (meetupResult.error) throw meetupResult.error;
  if (usersResult.error) throw usersResult.error;
  if (participantsResult.error) throw participantsResult.error;
  if (paidResult.error) {
    console.warn(
      "Unable to load first-paid dates for leaderboard",
      paidResult.error.message,
    );
  }

  const firstPaidByUser = new Map<string, Date>();
  (paidResult.data || []).forEach((row) => {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    const date = resolveDate(row.first_paid_at);
    if (userId && date) firstPaidByUser.set(userId, date);
  });

  const usersById = new Map<string, UserLeaderboardProfile>();
  (usersResult.data || []).forEach((row) => {
    const uid = String(row.uid);
    const photo = typeof row.photo_url === "string" ? row.photo_url : "";
    usersById.set(uid, {
      uid,
      displayName: row.display_name || `User ${uid.substring(0, 6)}`,
      ...(photo ? { photoURL: photo.replace(/^http:\/\//, "https://") } : {}),
      accountStatus: row.account_status || undefined,
      hasActiveSubscription: row.has_active_subscription === true,
      createdAt: resolveDate(row.created_at),
      firstSubscriptionDate:
        firstPaidByUser.get(uid) || resolveDate(row.subscription_start_date),
    });
  });

  const eventDateById = new Map<string, Date | null>();
  (meetupResult.data || []).forEach((row) => {
    eventDateById.set(String(row.id), resolveDate(row.date_time));
  });

  const participantsByMeetup = new Map<string, Set<string>>();
  (participantsResult.data || []).forEach((row) => {
    if (row.role === "leader") return;
    const meetupId = String(row.meetup_id);
    if (!participantsByMeetup.has(meetupId)) {
      participantsByMeetup.set(meetupId, new Set());
    }
    participantsByMeetup.get(meetupId)?.add(String(row.user_id));
  });

  const totalCounts = new Map<string, number>();
  const monthlyCounts = new Map<string, number>();
  const firstParticipationDates = new Map<string, Date>();

  participantsByMeetup.forEach((participants, meetupId) => {
    const eventDate = eventDateById.get(meetupId) || null;
    const isCurrentMonth =
      Boolean(eventDate) &&
      (eventDate as Date) >= monthStart &&
      (eventDate as Date) < nextMonthStart;

    participants.forEach((uid) => {
      if (!uid || isExcludedLeaderboardUser(usersById.get(uid))) return;
      totalCounts.set(uid, (totalCounts.get(uid) || 0) + 1);
      if (eventDate) {
        const currentFirst = firstParticipationDates.get(uid);
        if (!currentFirst || eventDate < currentFirst) {
          firstParticipationDates.set(uid, eventDate);
        }
      }
      if (isCurrentMonth) {
        monthlyCounts.set(uid, (monthlyCounts.get(uid) || 0) + 1);
      }
    });
  });

  const newMembers = Array.from(usersById.values())
    .filter(
      (user) =>
        !isExcludedLeaderboardUser(user) && isPayingLeaderboardUser(user),
    )
    .sort(
      (a, b) =>
        (paidMemberSortDate(b)?.getTime() || 0) -
        (paidMemberSortDate(a)?.getTime() || 0),
    )
    .slice(0, limitCount)
    .map((user) => ({
      uid: user.uid,
      displayName: user.displayName,
      ...(user.photoURL ? { photoURL: user.photoURL } : {}),
      value: 1,
      ...(paidMemberSortDate(user)
        ? { joinedAt: paidMemberSortDate(user)!.toISOString() }
        : {}),
    }));

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: SEOUL_TIME_ZONE,
  }).format(now);

  return {
    monthLabel,
    totalParticipation: participationEntries(
      totalCounts,
      usersById,
      limitCount,
    ),
    monthlyParticipation: participationEntries(
      monthlyCounts,
      usersById,
      limitCount,
    ),
    participationRate: participationRateEntries(
      totalCounts,
      firstParticipationDates,
      usersById,
      limitCount,
      now,
    ),
    newMembers,
  };
}
