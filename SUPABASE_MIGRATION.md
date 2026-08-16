# Firebase → Supabase Migration

Status and runbook for migrating One Cup English off Firebase (Firestore + Firebase
Auth + Storage + Cloud Functions) onto **Supabase** (Postgres + Supabase Auth +
Storage + Edge Functions). This branch (`feat/supabase`) is the frontend half;
the data/backend half lives in the sibling repo `../1cup-db-migration`.

- **Supabase project ref:** `hetiycbotgjeluteicyk` (region `ap-southeast-1`)
- **Connect (server/tooling):** Session pooler `aws-1-ap-southeast-1.pooler.supabase.com:5432`, SSL on. The direct `db.<ref>.supabase.co` host is IPv6-only.

## What this migration is

Firestore (NoSQL) → Postgres (SQL, 30 tables + views), with the data model normalized:
denormalized arrays became junction tables, dual-written docs collapsed into single
tables, and two Cloud Functions (`aggregateMeetupReports`, `updateHomeStats`) became
SQL **views**. See `../1cup-db-migration/MIGRATION_ERD.md`.

## Status

### ✅ Backend (in `../1cup-db-migration`, applied to the live project)
- Schema (30 tables + views), all data loaded & verified (0 orphan FKs).
- Auth migrated: `auth.users` seeded, every `public.users` linked via `auth_id`,
  `handle_new_user` trigger for new signups. Kakao OAuth provider enabled + smoke-tested.
- 6 Edge Functions deployed: `payment`, `kakao-login`, `messaging`, `speaking-reports`,
  `cefr`, `proxy` (ported from `functions/`).
- Storage buckets `avatars` + `assets` with policies. `pg_cron` (poll-cefr only; the
  payment/message crons are intentionally **paused** until production cutover).
- App-facing RLS policies + Realtime on `meetups`, `meetup_participants`, `transcripts`,
  `cefr_runs`.

### ✅ Frontend (this branch, `feat/supabase`) — `tsc --noEmit` passes, 0 errors
- **Foundation:** `app/lib/supabase/client.ts` (browser) + `server.ts` (RSC/service-role)
  + `middleware.ts` (SSR session) + `.env.supabase.example`.
- **Auth:** `auth_context.tsx` and `app/auth/page.tsx` on Supabase (Kakao OAuth + phone OTP).
- **All feature data layers** ported Firestore → Supabase: profile, home, meetup, payment,
  blog, celebration, feedback, growth, cefr, shadow, admin, article, transcript, report.

## How Firebase maps to Supabase

| Firebase | Supabase |
|---|---|
| `firebase/firestore` (`doc/getDoc/query`) | `supabase.from(table).select/insert/update/delete` |
| `firebase/auth` | `supabase.auth` (Kakao OAuth, phone OTP) |
| `firebase/storage` | `supabase.storage.from("avatars"\|"assets")` |
| `httpsCallable(functions, X)` | `invokeFunction("<fn>", { action, ... })` (Edge Functions) |
| `onSnapshot` (realtime) | `supabase.channel(..).on("postgres_changes", ..)` |
| Firestore doc id | `public.users.uid` etc. (text PKs preserved) |
| `admin.auth().getUser()` (phone/name) | columns on `public.users` |
| Cloud Functions region client | `NEXT_PUBLIC_SUPABASE_URL/functions/v1` |

`useAuth().currentUser` keeps the Firebase-User shape (`uid/displayName/email/phoneNumber/
photoURL`) so components didn't change; `currentUser.uid` = `public.users.uid`.

## Migration steps taken (this branch)

1. `feat/supabase` branch off `main`; add `@supabase/supabase-js` + `@supabase/ssr`.
2. Supabase client/server/middleware foundation.
3. Auth layer (context + login) → Supabase; retire the Firebase `kakao_callback` route.
4. Data layer, feature by feature (one commit each), reusing the schema in
   `../1cup-db-migration/supabase_schema.sql`.
5. Backend RLS/Realtime/`home_stats` fixes applied as features needed them.
6. Full-branch `tsc` → 0 errors.

Commit history: `git log main..feat/supabase` — one commit per feature group.

## Run locally

```bash
cp .env.supabase.example .env.local     # fill NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
                                         # (+ SUPABASE_SERVICE_ROLE_KEY for server routes)
npm run dev                              # http://localhost:3000
```
Supabase → Authentication → URL Configuration must allow `http://localhost:3000/**`
(and any Vercel preview URL) for OAuth redirects.

## The backend now lives in this repo (2026-08-16)

The live project used to be the only copy of the backend. It is now reproducible from
`supabase/`:

- `supabase/migrations/20260620000000_baseline_schema.sql` — extensions, 31 tables,
  62 constraints, 21 indexes, 4 functions (`is_admin`, `current_uid`, `handle_new_user`,
  `home_stats_counts`), 6 views, grants, and the `on_auth_user_created` trigger.
- `…_20260620000100_baseline_rls.sql` — RLS on every table + all policies.
- `…_20260620000200_baseline_storage_realtime_cron.sql` — `avatars`/`assets` buckets and
  their policies, the `supabase_realtime` publication, and the three `pg_cron` jobs.
- `supabase/functions/` — all 7 edge functions (`payment`, `kakao-login`, `messaging`,
  `speaking-reports`, `cefr`, `proxy`, `send-sms-hook`) + `_shared/`.

All of it was generated from the live project by catalog introspection (`supabase functions
download` for the sources), and every version is recorded in the live
`supabase_migrations.schema_migrations`, so `supabase db push` will not re-run it.

**Payple credentials** were hardcoded as fallbacks in the deployed `payment` function. The
committed source requires them from Edge Function secrets instead (they are already set, so
a redeploy is behaviour-neutral). Do not reintroduce literals — this file is public.

## Fixed on 2026-08-16 (found while capturing the live state)

- **`is_admin()` always returned false for browser sessions.** `coalesce((auth.jwt()->>'role')
  = 'admin', exists(…), false)` short-circuited on the first argument, which is `false` (not
  null) for every Supabase JWT. 20 of 39 policies call it, so all admin reads/writes were
  blocked. Now `or`-based; verified true for an admin and false for a normal user.
- **`cefr_runs` and `meetup_articles` had RLS on with no policy** (deny-all). CEFR batch
  progress and each meetup's discussion articles silently returned nothing in the browser.
- **`article_meanings`** write policy `for all using (true)` split into insert/update for
  authenticated, delete for admins only.
- **JSON-encoded text from the import.** `meetups.title` (75/75), `blog_posts.title`/`content`
  (8/8), `community_topics`/`community_comments` were stored as JSON strings — quotes rendered
  literally and `\n` never became a line break. Decoded in
  `20260816100000_unquote_json_encoded_text.sql`.

## Remaining / caveats

- **Payment is parked.** `/payment` is gated by `PAYMENT_ENABLED` and the `recurring-payments`
  + `send-links` cron jobs exist but are `active = false`. The **Firebase** schedulers
  (`processRecurringPayments`, `sendLinksToUsers`) are still the live ones — disable them in
  the same window you enable the Supabase jobs, with production Payple keys and live mode.
- **Cron auth:** the three job bodies carry a `<PASTE-REAL-service_role-KEY-HERE>` placeholder
  instead of a key. `poll-cefr` works anyway (`verify_jwt = false`), verified end-to-end; fill
  the key in if any target function ever requires JWT verification.
- **Object storage is split across BOTH providers, permanently.** Read this before deciding
  anything about the Firebase project.

  | What | Where | Size | Written by |
  |---|---|---|---|
  | Article audio + article images | **Firebase** `one-cup-eng.firebasestorage.app` | 840 MB, +~32 MB/month | the external article pipeline, which was never migrated |
  | Legacy avatars | **Firebase** | 10 users | pre-migration uploads |
  | Avatars, blog images, celebration images, admin article images | **Supabase** `avatars` / `assets` | ~14 kB today | the web app — every upload path was ported |
  | Kakao profile pictures | kakao CDN | 45 users | not our storage at all |

  The split was not designed; the app's upload paths moved with the feature migration and the
  pipeline stayed put. It happens to be the right shape — everything large and growing is on
  the pay-as-you-go bucket, and Supabase only receives small user uploads — so it stays.

  **Keeping the big files on Firebase was the deliberate call (2026-08-16).** Supabase Free
  caps file storage at 1 GB with no overage billing: moving them would fill 88% of the cap on
  day one and hit it within about four months. Pro removes the cap at $25/month, against a
  service currently taking 45,000–162,000 KRW/month. The bucket costs cents; note it sits in
  asia-northeast3, so the 5 GB Firebase free tier (us-central1/us-west1/us-east1 only) does
  not apply and it is already billed as ordinary GCS.

  **Consequence for cutover: retire Auth, Firestore and Functions, but leave Firebase Storage
  enabled.** Stored URLs are `firebasestorage.googleapis.com/...?alt=media&token=…`, served by
  that service — deleting the project breaks every article image and audio file. Equally, do
  not assume Supabase Storage can be ignored: new uploads land there. Revisit only if the
  project moves to Pro for other reasons; re-uploading 900 MB and rewriting the URLs is
  roughly a day of work.
- **Watch the 500 MB database cap** on the Free plan. Currently 81 MB. Unlike storage, hitting
  this one stops writes.
- **Growth agent** (`growth-agent/`, Cloud Run) was never deployed — no service exists, its
  Firestore config is `agentActive: false`, and both Firestore and Supabase growth tables are
  empty. Port `firestore_client.py` to Supabase whenever it does get deployed; it blocks
  nothing today.
- **Production cutover:** rotate the Kakao Alimtalk keys (were hardcoded), set Payple to live
  mode, and register the production domain in Supabase URL config + the (production) Kakao app.

## Reference docs (in `../1cup-db-migration`)

`MIGRATION_STATUS.md`, `MIGRATION_ERD.md`, `EXTRACTION_PIPELINE.md`, `BACKEND_MIGRATION.md`,
`supabase/SUPABASE_BACKEND.md`, and `pipeline/*.sql`.
