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

## Remaining / caveats

- **Phone OTP** needs an SMS provider in Supabase (Auth → Providers → Phone). Kakao works today.
- **Dev-permissive RLS** to tighten before production: `article_meanings` write (definition
  cache), `transcripts` read. See `../1cup-db-migration/pipeline/rls_app_policies.sql`.
- **Legacy Kakao-user linking:** the `handle_new_user` trigger matches existing users by
  phone/email; the Supabase native Kakao provider doesn't expose `kakao_id` the same way, so
  re-verify kakao_id matching at production cutover.
- **`scripts/*.mjs`** (article export/seed) still use Firebase Admin — not in the app bundle;
  port if you still run them. `app/lib/firebase/*` is now unused by the app (safe to delete).
- **Production cutover:** rotate the Kakao Alimtalk keys (were hardcoded), re-enable the
  payment/message crons with production Payple keys, set Payple to live mode, tighten RLS,
  and register the production domain in Supabase URL config + the (production) Kakao app.

## Reference docs (in `../1cup-db-migration`)

`MIGRATION_STATUS.md`, `MIGRATION_ERD.md`, `EXTRACTION_PIPELINE.md`, `BACKEND_MIGRATION.md`,
`supabase/SUPABASE_BACKEND.md`, and `pipeline/*.sql`.
