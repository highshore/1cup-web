import type {
  MeetupEvent,
  MeetupLeaderboards,
} from "../types/meetup_types";
import { reportServiceError } from "../../../services/service_error_bus";

export type MeetupPageCursor = number;

const DEFAULT_TIMEOUT_MS = 8_000;

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

export async function fetchMeetupLeaderboards(
  limitCount = 5,
): Promise<MeetupLeaderboards> {
  const params = new URLSearchParams({ limit: String(limitCount) });
  return fetchPublicJson(
    `/api/meetup/leaderboards?${params.toString()}`,
    "leaderboard",
  );
}
