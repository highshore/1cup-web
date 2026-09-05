// Stable public facade for meetup services.
//
// Public list/detail/leaderboard reads are intentionally routed through same-origin
// Next.js endpoints so an expired browser auth session cannot block public pages.
// Authenticated legacy mutations remain available here, except meetup participation:
// participation-credit accounting requires joins/cancellations to go through DB RPCs.
export * from "./meetup_service_legacy";
export {
  joinEventAsRole,
  cancelParticipation,
} from "./meetup_registration_service";
export {
  fetchMeetupEvents,
  fetchMeetupEventById,
  subscribeToEvent,
  fetchMeetupLeaderboards,
  type MeetupPageCursor,
} from "./meetup_service_reliable";
