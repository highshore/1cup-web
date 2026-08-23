# Migration audit — consolidated & verified (2026-07-27)

E2E audit of every feature for the two recurring migration failure modes (Firebase
dependencies, RLS-blocked cross-user reads) + casing/Firestore-isms. Six parallel
auditors, then **every finding verified against the live Supabase project**
(`hetiycbotgjeluteicyk`): RLS policy map, `is_admin()`/`current_uid()` bodies, and
edge-function deployment probes.

## Verification facts (ground truth)
- **Edge functions deployed & responding:** `payment`, `messaging`, `speaking-reports`,
  `kakao-login`, `cefr`, `proxy` (+ `send-sms-hook`). None 404.
- **`is_admin()`** = `account_status='admin'` for `auth_id = auth.uid()` (or JWT role). Correct.
- **`current_uid()`** = `uid from users where auth_id = auth.uid()`. Correct (translates auth uuid → Firebase uid).
- **RLS present & sane** on all app tables (users/payment_orders own-row; articles/meetups/
  celebrations/growth_* admin-write; blog_posts published-read; transcripts creator/admin/
  participant; speaking_reports owner/admin/leader; meetup_participants join-self/leave-self).

## False positives (do NOT act — verified safe)
- Transcript "missing `messaging`/`speaking-reports`" → both deployed.
- Transcript "`transcripts` RLS deny-all" → has creator/admin/participant policies.
- Admin/Blog "`is_admin()` keyed on wrong column → admin broken" → resolves by `auth_id`; works.
- Article "RLS blocks `article_meanings`/`articles` writes" → policies permit them.

## Confirmed issues (ranked)

### HIGH — reproducibility / cutover
1. **Live-only DB config not in the repo.** Edge-function *source* (all except `payment`),
   **all RLS policies**, DB functions (`is_admin`, `current_uid`, `handle_new_user`), and
   views (`public_users`, `user_first_paid`, `home_stats`, `meetup_reports`,
   `meetup_report_users`, `meetups_with_counts`) exist only in the live project. A fresh /
   DR environment can't be rebuilt from the repo. **Fix:** `supabase db pull` (or pg_dump of
   policies+functions+views) and commit as migrations; export edge-function source into
   `supabase/functions/`.

### MEDIUM — real runtime bugs
2. **Feedback admin view** — `app/admin/AdminClient.tsx` `fetchFeedback` does `select("*")`
   with no `kind` filter; survey rows (`kind='survey'`, `category=null`) render as bogus empty
   "Refund Request" cards. **Fix:** `.eq("kind","cancellation")` or handle `survey` explicitly.
3. **Feedback submission (anon)** — `app/feedback/FeedbackClient.tsx:295` inserts `feedback`
   with `user_id` from the `uid` URL param (default `"anonymous"`). RLS insert CHECK is
   `user_id = current_uid()`, so anonymous / param-mismatch submissions are **rejected**.
   **Fix:** submit with the authed user (or add an anon-survey insert policy).
4. **Naver local search still hits Firebase** — `app/lib/features/meetup/components/admin_event_dialog.tsx:650`
   fetches a hardcoded Firebase Cloud Run URL for Naver local search (meetup create/edit),
   instead of the deployed `proxy` edge function. Breaks when Firebase is decommissioned.
   **Fix:** route via `invokeFunction("proxy", …)`.
5. **Growth split-brain** — app reads/writes Supabase `growth_config/growth_posts/growth_iterations`;
   the separate Python agent uses Firestore. Toggles/drafts/approvals don't sync.
   **Fix:** point the agent at the same Supabase tables (or bridge).

### LOW — hardening / cosmetic / unused
6. `article_meanings` write policy is `USING true` (anyone can write the definition cache) —
   tighten before production (already flagged in `SUPABASE_MIGRATION.md`).
7. `blog_post_likes` is deny-all (no policy) — likes UI isn't wired currently; add a policy if used.
8. Cosmetic: dead `invokeFunction` import in `AdminClient.tsx:5`; `/report` (`ReportClient.tsx`)
   is a dead empty page; `FEATURED_ARTICLE_IDS` mismatch (6 server vs 7 client) in home
   topics services; stale "Firebase" comments/log strings (article, transcript, blog, home).
9. Pre-existing (not a migration regression): `NEXT_PUBLIC_OPENAI_API_KEY` / Azure keys used
   directly in the browser (article word-lookup, shadow) — client-side key exposure.

## Still to functionally verify (deployed ≠ correct)
The 6 edge functions respond, but their **internal correctness** (reading/writing Supabase,
uid↔auth_id handling) is not verifiable by static audit. Functional-test each:
`messaging` (transcript/meetup names+reminders), `speaking-reports` (report generation),
`kakao-login`, `cefr`, `proxy`.

## Clean (verified)
Home, Article, Shadow, Celebration, Meetup join/leave (self-writes), all casing, Timestamp
compat, and the public-facing SSR/SSG paths (blog/home use service-role server clients).
