# Firebase → AWS Migration Plan: `functions/`

> Analysis of the Firebase Cloud Functions in this directory and a concrete,
> per-function plan for migrating the backend off Firebase onto AWS.
> Source of truth = the local `functions/src/` code (as of 2026-06-20).

All functions run in **`asia-northeast3` (Seoul)** today → target AWS region
**`ap-northeast-2` (Seoul)**. There are **no Firestore-triggered functions**
(`onDocumentCreated/Updated/Deleted`), so **no DynamoDB Streams are needed** for
triggers. This meaningfully simplifies the migration.

---

## 1. Function Inventory (24 deployed triggers + helpers)

| # | Function | File | Trigger | Notes |
|---|----------|------|---------|-------|
| 1 | `fetchYouTubeTranscriptProxy` | index.ts:71 | HTTP `onRequest` | scrapes YouTube via `youtube-transcript` |
| 2 | `searchNaverLocal` | index.ts:159 | HTTP `onRequest` | proxy to Naver Local API |
| 3 | `startCefrBatch` | cefr.ts:40 | HTTP `onRequest` | 1GiB, maxInstances 10; submits OpenAI Batch job |
| 4 | `paymentCallback` | payment.ts:1687 | HTTP `onRequest` | **Payple webhook** — needs stable public URL |
| 5 | `triggerHomeStatsUpdate` | updateHomeStats.ts:58 | `onCall` | manual trigger of stats |
| 6 | `processKakaoUser` | processKakaoUser.ts:42 | `onCall` | Kakao OAuth → axios to kapi.kakao.com |
| 7 | `testSendLinksToUsers` | index.ts:988 | `onCall` | test harness |
| 8 | `sendLinksToCategory` | index.ts:1012 | `onCall` | category Kakao blast |
| 9 | `sendMeetupReminder` | index.ts:1476 | `onCall` | Kakao reminder |
| 10 | `getUserDisplayNames` | index.ts:1640 | `onCall` | Auth batch lookup |
| 11 | `listGdgMembers` | index.ts:1688 | `onCall` | Auth + Firestore |
| 12 | `generateSpeakingReports` | index.ts:1795 | `onCall` | **1GiB / 300s**, OpenAI chat |
| 13 | `aggregateMeetupReports` | index.ts:2400 | `onCall` | **1GiB / 300s**, OpenAI chat |
| 14 | `getPaymentWindow` | payment.ts:190 | `onCall` | Payple auth |
| 15 | `verifyPaymentResult` | payment.ts:505 | `onCall` | Payple verify |
| 16 | `cancelSubscription` | payment.ts:1313 | `onCall` | Payple refund |
| 17 | `logCredentials` | payment.ts:1666 | `onCall` | debug/util |
| 18 | `stopNextBilling` | payment.ts:1799 | `onCall` | billing_stops write |
| 19 | `checkReferralCode` | payment.ts:1930 | `onCall` | referral_codes read |
| 20 | `generateReferralCode` | payment.ts:1971 | `onCall` | referral_codes write |
| 21 | `pollCefrBatches` | cefr.ts:364 | `onSchedule` every 2 min | polls OpenAI Batch status |
| 22 | `updateHomeStats` | updateHomeStats.ts:15 | `onSchedule` every 1 hr | aggregate stats |
| 23 | `sendLinksToUsers` | index.ts:970 | `onSchedule` `0 8 * * *` | **mass Kakao blast** to all users |
| 24 | `processRecurringPayments` | payment.ts:949 | `onSchedule` `0 20 * * *` | **mass recurring billing** loop |

**Internal helpers (not triggers):** `sendKakaoMessages` (index.ts:1412, AlimTalk
sender), `getAuthRecordsMap` / `getUsers` (utils/authBatch.ts — Firebase Auth
batch lookup).

---

## 2. Per-Function Compute Recommendation

**Headline: every function → Lambda.** Nothing here justifies EC2 or Fargate as a
baseline — all are event-driven, idle most of the time, light on deps, no GPU, and
every individual invocation finishes well under 15 minutes. The only nuance is two
mass-fan-out schedulers (below).

### Lambda — straightforward (20 of 24)
Functions 1–20, 22. Short, spiky, light. Idle = $0. Memory per current config:
- Most: 256 MiB.
- `generateSpeakingReports`, `aggregateMeetupReports`: **1024 MiB, timeout 300s**.
- `startCefrBatch`: 1024 MiB (only *submits* a batch — CEFR work runs on OpenAI's side).

### Lambda + EventBridge — clean fit (CEFR orchestration)
- `pollCefrBatches` (#21): EventBridge Scheduler `rate(2 minutes)`. Already an
  async-poll pattern around the OpenAI Batch API. No long-running compute in your code.

### Lambda + SQS fan-out — the two mass-iteration schedulers ⚠️
The only **15-minute-timeout risks** — they loop serially over potentially-large
user sets with an external HTTP call per user:

- `processRecurringPayments` (#24): `for (const userDoc of usersToRenew.docs)` →
  serial `axios.post` to Payple per subscriber. Will eventually exceed 15 min as the
  subscriber base grows.
- `sendLinksToUsers` (#23) / `sendKakaoMessages`: daily Kakao AlimTalk blast to all users.

**Recommendation:** split each into **(a)** a thin EventBridge-triggered "dispatcher"
Lambda that queries the user set and enqueues **one SQS message per user (or chunk)**,
and **(b)** a "worker" Lambda that processes each message (one billing call / one
Kakao send). Removes the timeout ceiling, gives per-user retries/DLQ (critical for
*billing* idempotency), and parallelizes. Strictly better than today's serial loop —
the one architectural change to make rather than a lift-and-shift.

**No EC2/Fargate needed anywhere.** Considered and rejected: no always-on workload,
no statefulness, no GPU, no >15-min single unit of work once `processRecurringPayments`
is fanned out, no heavy native deps forcing a container.

---

## 3. Dependency Audit (`functions/package.json`)

**Verdict: light. zip deployment is fine — nowhere near the 250 MB unzipped limit.
No native binaries, no GPU, no ML libraries.**

| Dependency | Risk | Notes |
|------------|------|-------|
| `firebase-admin` ^12.7 | **Remove** | Replaced by AWS SDK v3 (`@aws-sdk/client-dynamodb` + `lib-dynamodb`) and Cognito SDK. Bulk of node_modules weight today; dropping it *shrinks* the bundle. |
| `firebase-functions` ^6.3 | **Remove** | Trigger wrappers replaced by Lambda handler signatures. |
| `openai` ^5.6 | none | Pure JS, light. Fine on Lambda. |
| `axios`, `node-fetch`, `cors`, `express`, `date-fns`, `path-to-regexp` | none | All small pure-JS. `express`/`cors` only needed if you keep an Express-style handler; with API Gateway you can drop them. |
| `youtube-transcript` ^1.0.6 | **operational, not size** | Tiny lib, but it *scrapes* youtube.com. **AWS egress IPs are frequently rate-limited/blocked by YouTube** — more so than GCP's. Plan for a residential/proxy egress or expect failures in `fetchYouTubeTranscriptProxy`. |

No dependency pushes you toward a container image. Cold starts will be *faster* on
AWS than today once `firebase-admin` is removed. Use the **Node 22 Lambda runtime**
(matches `engines.node: 22`).

---

## 4. Firestore Query Audit → DynamoDB

**Verdict: DynamoDB is viable.** No collection-group queries, no multi-range queries,
no deep composite filters. Access patterns are dominated by single-field equality and
batch-get-by-ID, with a handful of composite (equality + range/order) queries that map
cleanly to **GSIs**.

Collections in use (15): `users`, `payment_orders`, `cefr`, `referral_codes`,
`cefr_runs`, `payment_cancellations`, `events`, `cache`, `articles`, `transcripts`,
`reports`, `payment_callbacks`, `meetup_reports`, `meetup`, `billing_stops`.

### Patterns that map directly
- **Batch get by document ID** — `where(documentId(), "in", chunk)`
  (index.ts:456/521/1140, cefr.ts:171): → DynamoDB `BatchGetItem` (handles the
  existing 10/30-id chunking naturally).
- **Single-field equality** — `kakaoId==` (processKakaoUser:215), `gdg_member==`
  (index:1695), `eventId==` (index:2414), `userId==` (payment:1354): → **GSI** with
  that field as partition key, or `Query` on a GSI.
- **`where("transcriptId","in",chunk)`** (index:2453): → `Query` per value on a GSI,
  or BatchGetItem if transcriptId is the key.

### Composite queries needing GSIs (already have Firestore composite indexes)
`firestore.indexes.json` maps almost 1:1 to DynamoDB GSIs:

| Query (Firestore) | DynamoDB GSI design |
|---|---|
| `users`: `hasActiveSubscription==true && subscriptionEndDate` range (payment:989-995, 1264-1265 — recurring billing & expiry) | GSI PK=`hasActiveSubscription`, SK=`subscriptionEndDate` → `Query` with SK range. **Range on a boolean PK is a hot-partition risk** (only one PK value `true`); if subscriber count is large, shard the PK (e.g. `true#<bucket>`). |
| `users`: `cat_tech==true && left_count` / `cat_business==true && left_count` (index:1141-1207) | GSI PK=`cat_tech`(/`cat_business`), SK=`left_count`. Same single-value-PK caveat. |
| `payment_orders`: `status=="completed" && userId== && completedAt DESC` (payment:1354-1355) | GSI PK=`userId`, SK=`completedAt`, filter `status` — or PK=`status#userId`, SK=`completedAt`. |
| `cefr_runs`: `status in ["in_progress","queued"]` limit 10 (cefr:372) | GSI PK=`status`, `Query` per value (DynamoDB has no native `in`; issue 2 queries). |

**Caveats to flag:**
- The boolean-PK GSIs (`hasActiveSubscription`, `cat_tech`, `cat_business`)
  concentrate all rows under one partition-key value. Correct, but at scale **add a
  sharding suffix**. This is the single most important data-modeling decision.
- DynamoDB has **no `in` operator** and **no `!=`**; current `in` queries become
  BatchGet (by key) or N parallel Queries (by GSI).
- `FieldValue.increment` / transactions → DynamoDB `UpdateExpression ADD` and
  `TransactWriteItems` (payment flows use transactions/batches — preserve atomicity
  for billing).

If you'd rather avoid the boolean-PK sharding work and keep Firestore-like ad-hoc
querying, **DocumentDB (MongoDB-compatible)** is the low-friction alternative since
these are document-shaped reads — but DynamoDB is the cheaper/serverless-aligned
choice and is workable here.

---

## 5. Config & Secrets Map

| Current (Firebase `.env` / Secret Manager / `process.env`) | Sensitivity | AWS home |
|---|---|---|
| `NEXT_OPENAI_API_KEY` (`defineSecret`, used by cefr + report fns) | secret | **Secrets Manager** |
| `PAYPLE_CST_ID`, `PAYPLE_CUST_KEY`, `PAYPLE_CLIENT_KEY`, `PAYPLE_REFUND_KEY` (secret arrays on all payment fns) | secret | **Secrets Manager** |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` (searchNaverLocal) | secret | **Secrets Manager** |
| Kakao AlimTalk credentials (used in `sendKakaoMessages` fetch, index.ts:1451) | secret | **Secrets Manager** — *audit this; referenced in code but not in the `defineSecret` list, confirm where the key currently comes from* |
| `PAYPLE_AUTH_URL`, `PAYPLE_HOSTNAME`, `PAYPLE_REMOTE_HOSTNAME` | config (URLs) | **SSM Parameter Store** or Lambda env |
| `CEFR_MODEL_ID`, `CEFR_BATCH_MAX_BYTES` | config (tuning) | Lambda env vars |
| Firebase Admin service-account / default credentials | infra identity | **IAM execution roles** (no key files) |

**Loading note:** `defineSecret`/`secrets:[...]` inject at runtime today. On Lambda,
fetch from Secrets Manager at cold start (cache in module scope) or via the Secrets
Manager Lambda extension — don't bake secrets into env vars.

---

## 6. The Big Cross-Cutting Item: Firebase Auth ⚠️

Not in the per-function table because it's a **separate workstream that blocks the
`onCall` functions**:

- All 16 `onCall` functions rely on **`request.auth`** (a verified Firebase ID token)
  for identity, and several enforce `if (!request.auth) throw unauthenticated`.
- `getUserDisplayNames` / `listGdgMembers` use **`admin.auth().getUsers()`**
  (utils/authBatch.ts) — batch Auth-record lookup.

Migrating off Firebase Functions means migrating **Firebase Auth → Amazon Cognito**
(or keeping Firebase Auth purely as an IdP and verifying its JWTs in an API Gateway
custom authorizer). Decide early:
- **Cognito:** API Gateway JWT/Cognito authorizer replaces `request.auth`; `getUsers`
  → `AdminGetUser`/`ListUsers`. Most "AWS-native," most migration work (user-pool import).
- **Keep Firebase Auth, verify tokens on AWS:** smallest change — a Lambda authorizer
  validates the Firebase ID token; you keep Firebase only for Auth. Pragmatic interim step.

`onCall` also bundles a **CORS + envelope protocol** (the `{data:...}` wrapping and
`onCallFunctionConfig` CORS). On AWS you'll either replicate that envelope in
API Gateway + Lambda or change the **web client's** call sites (`httpsCallable`) to
plain `fetch`/`POST`. This touches the Next.js app, not just `functions/`.

---

## 7. Master Migration Table

| Function | Trigger today | AWS compute | AWS trigger | DB target | Deps risk | Config/secrets | Notes |
|---|---|---|---|---|---|---|---|
| fetchYouTubeTranscriptProxy | HTTP | Lambda 256MB | API GW / Function URL | — | youtube scraping blocked from AWS IPs | — | may need egress proxy |
| searchNaverLocal | HTTP | Lambda 256MB | API GW | — | none | NAVER_CLIENT_ID/SECRET → Secrets Mgr | |
| startCefrBatch | HTTP | Lambda 1GB | API GW | DynamoDB `cefr_runs`,`cefr` | openai (light) | NEXT_OPENAI_API_KEY, CEFR_MODEL_ID/MAX_BYTES | submits OpenAI batch, returns fast |
| paymentCallback | HTTP | Lambda 256MB | API GW (public webhook URL) | DynamoDB `payment_callbacks` | none | PAYPLE_* | Payple needs stable URL |
| triggerHomeStatsUpdate | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `cache`/stats | none | — | auth migration |
| processKakaoUser | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `users` (kakaoId GSI) | none | Kakao creds | |
| testSendLinksToUsers | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `users`,`articles` | none | Kakao creds | test only |
| sendLinksToCategory | onCall | Lambda + SQS worker | API GW + authorizer | DynamoDB `users` (cat_* GSI) | none | Kakao creds | fan-out for scale |
| sendMeetupReminder | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `meetup`,`users` | none | Kakao creds | |
| getUserDisplayNames | onCall | Lambda 256MB | API GW + authorizer | **Cognito** (Auth lookup) | none | — | `getUsers` → Cognito |
| listGdgMembers | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `users` (gdg_member GSI) + Cognito | none | — | |
| generateSpeakingReports | onCall | Lambda **1GB/300s** | API GW + authorizer | DynamoDB `reports`,`transcripts` | openai | NEXT_OPENAI_API_KEY | watch 15-min if batched |
| aggregateMeetupReports | onCall | Lambda **1GB/300s** | API GW + authorizer | DynamoDB `events`,`transcripts`,`meetup_reports` | openai | NEXT_OPENAI_API_KEY | `transcriptId in` → N queries |
| getPaymentWindow | onCall | Lambda 256MB | API GW + authorizer | DynamoDB | axios | PAYPLE_* | |
| verifyPaymentResult | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `payment_orders` | axios | PAYPLE_* | use TransactWrite |
| cancelSubscription | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `payment_cancellations`,`users` | axios | PAYPLE_* | |
| logCredentials | onCall | Lambda 256MB | API GW + authorizer | — | none | — | consider deleting (debug) |
| stopNextBilling | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `billing_stops`,`users` | none | — | |
| checkReferralCode | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `referral_codes` | none | — | |
| generateReferralCode | onCall | Lambda 256MB | API GW + authorizer | DynamoDB `referral_codes` | none | — | |
| pollCefrBatches | schedule 2min | Lambda 256MB | EventBridge `rate(2 min)` | DynamoDB `cefr_runs`,`cefr` | openai | NEXT_OPENAI_API_KEY | async poll pattern |
| updateHomeStats | schedule 1hr | Lambda 256MB | EventBridge `rate(1 hour)` | DynamoDB | none | — | |
| sendLinksToUsers | schedule 08:00 | **Lambda dispatcher + SQS + worker** | EventBridge `cron(0 8 * * ?)` | DynamoDB `users`,`articles` | none | Kakao creds | **15-min risk → fan-out** |
| processRecurringPayments | schedule 20:00 | **Lambda dispatcher + SQS + worker** | EventBridge `cron(0 20 * * ?)` | DynamoDB `users`,`payment_orders` | axios | PAYPLE_* | **15-min risk + billing idempotency → SQS+DLQ** |

---

## 8. Recommended Migration Order

1. **Decide DB + Auth strategy first** (DynamoDB+GSIs vs DocumentDB; Cognito vs
   verify-Firebase-JWT). These gate everything else.
2. **Stand up secrets** in Secrets Manager / SSM; build a small `getSecret()` helper
   with cold-start caching to replace `defineSecret`/`process.env`.
3. **Migrate the schedulers** (`updateHomeStats`, `pollCefrBatches`) first — no auth
   dependency, lowest risk, proves out EventBridge + DynamoDB.
4. **Re-architect the two fan-out jobs** (`sendLinksToUsers`,
   `processRecurringPayments`) with SQS+DLQ — highest correctness stakes (billing).
5. **Migrate HTTP webhooks** (`paymentCallback`) — needs the new public URL registered
   with Payple.
6. **Migrate `onCall` functions** last, behind the chosen authorizer, updating the
   Next.js client call sites in lockstep.

### Trigger → AWS service mapping (reference)

| Firebase trigger | AWS equivalent |
|---|---|
| `onRequest` / `onCall` (HTTP) | API Gateway + Lambda, or Lambda Function URL |
| `onDocumentCreated/Updated/Deleted` (Firestore) | DynamoDB Streams + Lambda *(none used here)* |
| `onSchedule` (cron) | EventBridge Scheduler + Lambda |
| Pub/Sub / background events | SNS / SQS / EventBridge + Lambda |
| Long-running / stateful / GPU | Fargate or EC2 *(not needed here)* |
