-- Cutover fixes found while capturing the live schema into this repo (2026-08-16).
--
-- 1. is_admin() never returned true for a real browser session.
-- 2. cefr_runs / meetup_articles had RLS enabled with NO policy → deny-all.
-- 3. article_meanings write policy was "for all using (true)".

-- ---------------------------------------------------------------- 1. is_admin
-- The old body was:
--   select coalesce((auth.jwt() ->> 'role') = 'admin',
--                   exists (select 1 from users where auth_id = auth.uid() and account_status='admin'),
--                   false);
-- A Supabase browser JWT always carries role='authenticated', so the first argument
-- evaluated to FALSE (not NULL) and coalesce short-circuited there — the
-- account_status branch was never reached and every admin check failed. 20 of the
-- 39 policies call is_admin(), so all admin reads/writes from the browser were
-- blocked. Use OR so each branch is actually evaluated.
create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((auth.jwt() ->> 'role') = 'admin', false)
      or exists (select 1 from public.users u
                  where u.auth_id = auth.uid() and u.account_status = 'admin');
$function$;

-- --------------------------------------------------------------- 2. cefr_runs
-- The admin CEFR page reads batch progress and subscribes to Realtime on this
-- table; with no policy the browser saw nothing. Writes stay service-role only
-- (the `cefr` edge function), which bypasses RLS.
drop policy if exists "cefr_runs admin read" on public.cefr_runs;
create policy "cefr_runs admin read" on public.cefr_runs
  as permissive for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------- 2b. meetup_articles
-- Browser reads this junction to show each meetup's discussion articles
-- (meetup_service.ts), and admins write it when creating/editing a meetup.
-- Deny-all made the client-rendered meetup pages silently return no articles.
drop policy if exists "meetup_articles read" on public.meetup_articles;
create policy "meetup_articles read" on public.meetup_articles
  as permissive for select to anon, authenticated
  using (true);

drop policy if exists "meetup_articles admin write" on public.meetup_articles;
create policy "meetup_articles admin write" on public.meetup_articles
  as permissive for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --------------------------------------------------------- 3. article_meanings
-- Shared word-definition cache. The article reader upserts into it, so
-- authenticated users need insert + update — but not delete, and anon needs
-- neither. (Proper hardening is to move the write behind a server route; this
-- removes the delete/anon surface without breaking the reader.)
drop policy if exists "meanings write" on public.article_meanings;

drop policy if exists "meanings insert" on public.article_meanings;
create policy "meanings insert" on public.article_meanings
  as permissive for insert to authenticated
  with check (true);

drop policy if exists "meanings update" on public.article_meanings;
create policy "meanings update" on public.article_meanings
  as permissive for update to authenticated
  using (true)
  with check (true);

drop policy if exists "meanings delete admin" on public.article_meanings;
create policy "meanings delete admin" on public.article_meanings
  as permissive for delete to authenticated
  using (public.is_admin());
