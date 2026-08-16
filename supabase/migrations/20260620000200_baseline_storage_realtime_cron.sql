-- Baseline: storage buckets, realtime publication, cron jobs
-- Generated from the LIVE Supabase project (hetiycbotgjeluteicyk) by catalog
-- introspection on 2026-08-16. This is the DR/reproducibility baseline: applying
-- the migrations in this directory to an empty project recreates the backend.
-- The cron commands carry a service_role placeholder, never a real key — fill it in
-- (or rely on verify_jwt=false) when enabling a job.

-- ---------------------------------------------------------- storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, null, null)
on conflict (id) do nothing;

-- --------------------------------------------------------- storage policies
drop policy if exists "onecup owner delete" on storage.objects;
create policy "onecup owner delete" on storage.objects
  as permissive for delete to authenticated
  using ((owner = auth.uid()));
drop policy if exists "onecup owner insert" on storage.objects;
create policy "onecup owner insert" on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = ANY (ARRAY['avatars'::text, 'assets'::text])) AND (owner = auth.uid())));
drop policy if exists "onecup owner update" on storage.objects;
create policy "onecup owner update" on storage.objects
  as permissive for update to authenticated
  using ((owner = auth.uid()));
drop policy if exists "onecup public read" on storage.objects;
create policy "onecup public read" on storage.objects
  as permissive for select to public
  using ((bucket_id = ANY (ARRAY['avatars'::text, 'assets'::text])));

-- ------------------------------------------------------ realtime publication
do $$ begin
  alter publication supabase_realtime add table public.cefr_runs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.meetup_participants;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.meetups;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.transcripts;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------- cron

-- poll-cefr — ACTIVE
select cron.schedule('poll-cefr', '*/2 * * * *', $cron$
  select net.http_post(
    url     := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/cefr',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer <PASTE-REAL-service_role-KEY-HERE>'),
    body    := jsonb_build_object('action','poll')
  );
$cron$);

-- recurring-payments — PAUSED (enable at production cutover)
select cron.schedule('recurring-payments', '0 11 * * *', $cron$
  select net.http_post(
    url     := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/payment',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer <PASTE-REAL-service_role-KEY-HERE>'),
    body    := jsonb_build_object('action','process-recurring')
  );
$cron$);
update cron.job set active = false where jobname = 'recurring-payments';

-- send-links — PAUSED (enable at production cutover)
select cron.schedule('send-links', '0 23 * * *', $cron$
  select net.http_post(
    url     := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/messaging',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer <PASTE-REAL-service_role-KEY-HERE>'),
    body    := jsonb_build_object('action','send-links')
  );
$cron$);
update cron.job set active = false where jobname = 'send-links';
