import type {
  MeetupEvent,
  MeetupLeaderboards,
} from "../types/meetup_types";
import { reportServiceError } from "../../../services/service_error_bus";

export type MeetupPageCursor = number;

const DEFAULT_TIMEOUT_MS = 8_000;
const DETAIL_REFRESH_MS = 30_000;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPublicJson<T>(
  url: string,
  service: "meetup" | "leaderboard",
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      DEFAULT_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Public ${service} request failed (${response.status})`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await wait(250);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  reportServiceError({ service, cause: lastError });
  throw new Error("Service temporarily unavailable");
}

async function fetchMeetupDetailRequest(id: string): Promise<MeetupEvent | null> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      DEFAULT_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `/api/meetup/events/${encodeURIComponent(id)}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        },
      );

      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Public meetup detail request failed (${response.status})`);
      }
      return (await response.json()) as MeetupEvent;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await wait(250);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  reportServiceError({ service: "meetup", cause: lastError });
  throw new Error("Service temporarily unavailable");
}

export async function fetchMeetupEvents(
  lastDoc?: MeetupPageCursor,
  limitCount = 5,
): Promise<{
  events: MeetupEvent[];
  lastDoc: MeetupPageCursor | null;
}> {
  const params = new URLSearchParams({
    offset: String(lastDoc ?? 0),
    limit: String(limitCount),
  });
  return fetchPublicJson(`/api/meetup/events?${params.toString()}`, "meetup");
}

export async function fetchMeetupEventById(
  id: string,
): Promise<MeetupEvent | null> {
  return fetchMeetupDetailRequest(id);
}

// Event detail is public data. Keep it independent from the browser's auth/JWT state:
// load through the same-origin server endpoint and refresh periodically while open.
export function subscribeToEvent(
  id: string,
  callback: (event: MeetupEvent | null) => void,
): () => void {
  let active = true;

  const refresh = async () => {
    try {
      const event = await fetchMeetupDetailRequest(id);
      if (active) callback(event);
    } catch {
      // The service error bus presents transient failures globally. Do not turn a
      // temporary network/auth problem into a false "Event not found" state.
    }
  };

  void refresh();
  const interval = window.setInterval(() => void refresh(), DETAIL_REFRESH_MS);

  return () => {
    active = false;
    window.clearInterval(interval);
  };
}

export async function fetchMeetupLeaderboards(
  limitCount = 5,
): Promise<MeetupLeaderboards> {
  const params = new URLSearchParams({ limit: String(limitCount) });
  return fetchPublicJson(
    `/api/meetup/leaderboards?${params.toString()}`,
    "leaderboard",
  );
}
