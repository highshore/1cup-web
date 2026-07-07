import { admin } from "../../../supabase/server";
import { MeetupEvent } from "../types/meetup_types";

const MEETUP_TABLE = "meetups";

// Convert a Supabase meetups row to MeetupEvent for server-side rendering.
const rowToMeetupEvent = (
  row: Record<string, any>,
  participants: string[],
  leaders: string[],
  articles: string[]
): MeetupEvent => {
  const dateTime = row.date_time ? new Date(row.date_time) : new Date();

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: dateTime.toISOString().split("T")[0], // YYYY-MM-DD format
    time: dateTime.toTimeString().split(" ")[0].slice(0, 5), // HH:MM format
    location_name: row.location_name,
    location_address: row.location_address,
    location_map_url: row.location_map_url,
    latitude: row.latitude,
    longitude: row.longitude,
    location_extra_info: row.location_extra_info,
    duration_minutes: row.duration_minutes,
    lockdown_minutes: row.lockdown_minutes,
    max_participants: row.max_participants,
    participants,
    leaders,
    image_urls: row.image_urls || [],
    topics: row.topics || [],
    articles,
  };
};

// Fetch upcoming meetup events (for SSG/SSR)
export const fetchUpcomingMeetupEventsServer = async (): Promise<
  MeetupEvent[]
> => {
  try {
    const supabase = admin();

    const now = new Date();

    // Get all meetups and filter/sort in memory (mirrors the previous behaviour
    // of reading everything and computing "upcoming" client-side).
    const { data: rows, error } = await supabase
      .from(MEETUP_TABLE)
      .select("*");

    if (error) {
      console.warn(
        "Supabase not available, returning empty meetup events",
        error
      );
      return [];
    }

    const meetupRows = rows || [];
    if (meetupRows.length === 0) return [];

    const ids = meetupRows.map((r) => r.id);

    // Batch-load junction data for participants/leaders and articles.
    const [participantsResult, articlesResult] = await Promise.all([
      supabase
        .from("meetup_participants")
        .select("meetup_id, user_id, role")
        .in("meetup_id", ids),
      supabase
        .from("meetup_articles")
        .select("meetup_id, article_id")
        .in("meetup_id", ids),
    ]);

    const participantsByMeetup = new Map<
      string,
      { participants: string[]; leaders: string[] }
    >();
    ids.forEach((id) =>
      participantsByMeetup.set(id, { participants: [], leaders: [] })
    );
    (participantsResult.data || []).forEach((p) => {
      const bucket = participantsByMeetup.get(p.meetup_id);
      if (!bucket) return;
      if (p.role === "leader") bucket.leaders.push(p.user_id);
      else bucket.participants.push(p.user_id);
    });

    const articlesByMeetup = new Map<string, string[]>();
    ids.forEach((id) => articlesByMeetup.set(id, []));
    (articlesResult.data || []).forEach((a) => {
      articlesByMeetup.get(a.meetup_id)?.push(a.article_id);
    });

    const events: MeetupEvent[] = [];
    meetupRows.forEach((row) => {
      const pl = participantsByMeetup.get(row.id) || {
        participants: [],
        leaders: [],
      };
      const articles = articlesByMeetup.get(row.id) || [];
      const meetupEvent = rowToMeetupEvent(
        row,
        pl.participants,
        pl.leaders,
        articles
      );

      // Check if the event is upcoming
      const eventDateTime = new Date(`${meetupEvent.date}T${meetupEvent.time}`);
      if (eventDateTime >= now) {
        events.push(meetupEvent);
      }
    });

    // Sort by date (ascending - soonest first)
    events.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });

    return events;
  } catch (error) {
    console.error("Error fetching upcoming meetup events on server:", error);
    return [];
  }
};
