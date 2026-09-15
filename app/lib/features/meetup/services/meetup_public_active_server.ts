import "server-only";

import { admin } from "../../../supabase/server";
import type { MeetupEvent } from "../types/meetup_types";
import {
  fetchMeetupEventsPageServer as fetchMeetupEventsPageServerBase,
} from "./meetup_public_server";

const QUERY_TIMEOUT_MS = 7_000;

function querySignal() {
  return AbortSignal.timeout(QUERY_TIMEOUT_MS);
}

// Participation-credit cancellations preserve the junction row for audit and mark it
// `registration_status = cancelled`. Public meetup payloads must therefore expose only
// currently registered rows; otherwise a successfully cancelled member still appears in
// participant lists and the detail page keeps treating them as joined.
//
// These reads also define the semantic display order:
// - people: signup order (`registered_at`), with legacy null timestamps first and uid as
//   a deterministic tie-breaker;
// - articles: the order selected by the admin (`position`).
export async function fetchMeetupEventsPageServer(
  offset = 0,
  requestedLimit = 5,
): Promise<{ events: MeetupEvent[]; lastDoc: number | null }> {
  const result = await fetchMeetupEventsPageServerBase(offset, requestedLimit);
  if (result.events.length === 0) return result;

  const ids = result.events.map((event) => event.id);
  const supabase = admin();
  const [participantsResult, articlesResult] = await Promise.all([
    supabase
      .from("meetup_participants")
      .select("meetup_id,user_id,role,registered_at")
      .in("meetup_id", ids)
      .eq("registration_status", "registered")
      .order("meetup_id", { ascending: true })
      .order("registered_at", { ascending: true, nullsFirst: true })
      .order("user_id", { ascending: true })
      .abortSignal(querySignal()),
    supabase
      .from("meetup_articles")
      .select("meetup_id,article_id,position")
      .in("meetup_id", ids)
      .order("meetup_id", { ascending: true })
      .order("position", { ascending: true, nullsFirst: false })
      .order("article_id", { ascending: true })
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

  return {
    ...result,
    events: result.events.map((event) => {
      const bucket = people.get(event.id) || { participants: [], leaders: [] };
      return {
        ...event,
        participants: bucket.participants,
        leaders: bucket.leaders,
        articles: articles.get(event.id) || [],
      };
    }),
  };
}
