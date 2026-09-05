// Stable public facade for meetup services.
//
// Public list/detail/leaderboard reads are intentionally routed through same-origin
// Next.js endpoints so an expired browser auth session cannot block public pages.
// Authenticated legacy mutations remain available here, except meetup registration:
// participation-credit accounting requires that path to go through the database RPC.
export * from "./meetup_service_legacy";
export { joinEventAsRole } from "./meetup_registration_service";
export {
  fetchMeetupEvents,
  fetchMeetupEventById,
  subscribeToEvent,
  fetchMeetupLeaderboards,
  type MeetupPageCursor,
} from "./meetup_service_reliable";
