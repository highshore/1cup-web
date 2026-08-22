// Stable public facade for meetup services.
//
// Public list/detail/leaderboard reads are intentionally routed through same-origin
// Next.js endpoints so an expired browser auth session cannot block public pages.
// Authenticated mutations continue to live in the legacy service module.
export * from "./meetup_service_legacy";
export {
  fetchMeetupEvents,
  fetchMeetupEventById,
  subscribeToEvent,
  fetchMeetupLeaderboards,
  type MeetupPageCursor,
} from "./meetup_service_reliable";
