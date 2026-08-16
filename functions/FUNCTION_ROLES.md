# Firebase Functions — Role Reference

> The role of each Cloud Function in `functions/`, derived from
> [`AWS_MIGRATION_PLAN.md`](./AWS_MIGRATION_PLAN.md) (§1 inventory + §7 master table).
> Source of truth = `functions/src/` as of 2026-06-20. Functions grouped by trigger type.

## HTTP endpoints (`onRequest`) — public-facing entry points

| # | Function | File | Role |
|---|----------|------|------|
| 1 | `fetchYouTubeTranscriptProxy` | index.ts:71 | Scrapes YouTube transcripts (via `youtube-transcript`) and proxies them back — server-side proxy so the browser doesn't hit YouTube directly. |
| 2 | `searchNaverLocal` | index.ts:159 | Proxies search requests to the Naver Local API (keeps Naver credentials server-side). |
| 3 | `startCefrBatch` | cefr.ts:40 | Submits a CEFR (English-level) grading job to the OpenAI Batch API, then returns fast. Only *kicks off* the work — grading runs on OpenAI's side. |
| 4 | `paymentCallback` | payment.ts:1687 | **Payple webhook receiver** — the URL the payment gateway calls back to. Needs a stable public URL. |

## RPC endpoints (`onCall`) — called from the Next.js app, auth-gated

### Stats / user data

| # | Function | File | Role |
|---|----------|------|------|
| 5 | `triggerHomeStatsUpdate` | updateHomeStats.ts:58 | Manually triggers a recompute of the homepage aggregate stats. |
| 10 | `getUserDisplayNames` | index.ts:1640 | Batch-looks-up user display names from Firebase Auth. |
| 11 | `listGdgMembers` | index.ts:1688 | Lists GDG members (Firebase Auth + Firestore `gdg_member` filter). |

### Kakao notifications

| # | Function | File | Role |
|---|----------|------|------|
| 6 | `processKakaoUser` | processKakaoUser.ts:42 | Processes Kakao OAuth — calls `kapi.kakao.com` to resolve/store the Kakao user into `users`. |
| 7 | `testSendLinksToUsers` | index.ts:988 | Test harness for the daily article-link blast. |
| 8 | `sendLinksToCategory` | index.ts:1012 | Sends a Kakao AlimTalk blast to users in a given category (`cat_tech`/`cat_business`). |
| 9 | `sendMeetupReminder` | index.ts:1476 | Sends a Kakao reminder for an upcoming meetup. |

### AI reports (heavy: 1 GiB / 300s, OpenAI chat)

| # | Function | File | Role |
|---|----------|------|------|
| 12 | `generateSpeakingReports` | index.ts:1795 | Generates per-user speaking reports from transcripts via OpenAI. |
| 13 | `aggregateMeetupReports` | index.ts:2400 | Aggregates a whole meetup's transcripts into a combined report via OpenAI. |

### Payment / subscription (Payple)

| # | Function | File | Role |
|---|----------|------|------|
| 14 | `getPaymentWindow` | payment.ts:190 | Authenticates with Payple and returns the data to open the payment window. |
| 15 | `verifyPaymentResult` | payment.ts:505 | Verifies a completed payment and records the order. |
| 16 | `cancelSubscription` | payment.ts:1313 | Cancels a subscription / issues a Payple refund. |
| 17 | `logCredentials` | payment.ts:1666 | Debug/util helper — the plan suggests deleting it. |
| 18 | `stopNextBilling` | payment.ts:1799 | Marks a subscription to not auto-renew (writes `billing_stops`). |
| 19 | `checkReferralCode` | payment.ts:1930 | Validates/reads a referral code. |
| 20 | `generateReferralCode` | payment.ts:1971 | Creates a new referral code. |

## Scheduled jobs (`onSchedule`) — cron

| # | Function | File | Role |
|---|----------|------|------|
| 21 | `pollCefrBatches` | cefr.ts:364 | Every 2 min: polls OpenAI for CEFR batch status and writes results back (the async other half of `startCefrBatch`). |
| 22 | `updateHomeStats` | updateHomeStats.ts:15 | Every 1 hr: recomputes homepage aggregate stats. |
| 23 | `sendLinksToUsers` | index.ts:970 | Daily 08:00 KST: mass Kakao blast of article links to **all** users. ⚠️ 15-min-timeout risk → SQS fan-out. |
| 24 | `processRecurringPayments` | payment.ts:949 | Daily 20:00 KST: loops over subscribers and charges recurring billing via Payple. ⚠️ 15-min risk + billing idempotency → SQS+DLQ. |

## Internal helpers (not triggers)

| Helper | File | Role |
|--------|------|------|
| `sendKakaoMessages` | index.ts:1412 | Shared AlimTalk sender used by all the Kakao functions above. |
| `getAuthRecordsMap` / `getUsers` | utils/authBatch.ts | Batched Firebase Auth record lookup used by `getUserDisplayNames` and `listGdgMembers`. |

## Big picture

The 24 functions cluster into five product areas:

- **Content** — YouTube / Naver proxies (`fetchYouTubeTranscriptProxy`, `searchNaverLocal`).
- **CEFR leveling** — submit + poll around the OpenAI Batch API (`startCefrBatch`, `pollCefrBatches`).
- **Kakao notifications** — reminders and daily/category blasts (`sendLinksToUsers`, `sendLinksToCategory`, `sendMeetupReminder`, `processKakaoUser`, `sendKakaoMessages`).
- **AI reports** — speaking/meetup summaries via OpenAI (`generateSpeakingReports`, `aggregateMeetupReports`).
- **Payments / subscriptions** — the Payple lifecycle (window → verify → recurring billing → cancel/refund) plus referral codes.

…with a few **stats/admin** utilities on the side (`updateHomeStats`, `triggerHomeStatsUpdate`, `getUserDisplayNames`, `listGdgMembers`, `logCredentials`).
