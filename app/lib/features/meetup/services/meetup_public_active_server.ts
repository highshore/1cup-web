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
export async function fetchMeetupEventsPageServer(
  offset = 0,
  requestedLimit = 5,
): Promise<{ events: MeetupEvent[]; lastDoc: number | null }> {
  const result = await fetchMeetupEventsPageServerBase(offset, requestedLimit);
  if (result.events.length === 0) return result;

  const ids = result.events.map((event) => event.id);
  const { data, error } = await admin()
    .from("meetup_participants")
    .select("meetup_id,user_id,role")
    .in("meetup_id", ids)
    .eq("registration_status", "registered")
    .abortSignal(querySignal());

  if (error) throw error;

  const people = new Map<string, { participants: string[]; leaders: string[] }>();
  ids.forEach((id) => people.set(id, { participants: [], leaders: [] }));

  (data || []).forEach((row) => {
    const bucket = people.get(String(row.meetup_id));
    if (!bucket) return;
    if (row.role === "leader") bucket.leaders.push(String(row.user_id));
    else bucket.participants.push(String(row.user_id));
  });

  return {
    ...result,
    events: result.events.map((event) => {
      const bucket = people.get(event.id) || { participants: [], leaders: [] };
      return {
        ...event,
        participants: bucket.participants,
        leaders: bucket.leaders,
      };
    }),
  };
}
