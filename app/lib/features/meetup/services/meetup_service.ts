// Stable public facade for meetup services.
//
// Public list/leaderboard reads are intentionally routed through same-origin
// Next.js endpoints so an expired browser auth session cannot block public pages.
// Mutations and detail helpers continue to live in the legacy service module.
export * from "./meetup_service_legacy";
export {
  fetchMeetupEvents,
  fetchMeetupLeaderboards,
  type MeetupPageCursor,
} from "./meetup_service_reliable";
