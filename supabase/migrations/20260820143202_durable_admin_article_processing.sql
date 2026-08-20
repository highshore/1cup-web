-- Durable Supabase worker for admin article ingestion.
--
-- The retired Firebase flow stored the complete source in a Firestore job and let an
-- onCreate trigger process it. The first Edge Function port returned a response and
-- relied on the originating request staying alive, which is not durable. Keep source
-- material only in this short-lived, server-only job and invoke a private worker after
-- insert, with a minute-based cron fallback for delivery recovery.

alter table public.article_processing_jobs
  add column if not exists source_url    text,
  add column if not exists source_body   text,
  add column if not exists image_urls    text[] not null default '{}'::text[],
  add column if not exists attempt_count integer not null default 0;

alter table public.article_processing_jobs
  drop constraint if exists article_processing_jobs_attempt_count_check;
alter table public.article_processing_jobs
  add constraint article_processing_jobs_attempt_count_check
  check (attempt_count >= 0);

-- Persist the full article contract from the previous worker. These fields are all
-- optional for existing imported articles and therefore safe to add in place.
alter table public.articles
  add column if not exists subtitle            jsonb,
  add column if not exists keywords            jsonb,
  add column if not exists advanced_vocabulary jsonb,
  add column if not exists atypical_terms      jsonb,
  add column if not exists summary             jsonb,
  add column if not exists cover_image         jsonb;

create index if not exists article_processing_jobs_queue_idx
  on public.article_processing_jobs (status, created_at);

-- Jobs contain the submitted source body. The browser reads status from public.articles
-- through Realtime, so there must be no Data API path to job rows or source text.
alter table public.article_processing_jobs enable row level security;
drop policy if exists "article_processing_jobs admin read" on public.article_processing_jobs;
revoke all on table public.article_processing_jobs from anon, authenticated;

-- The vault-held secret authenticates asynchronous database requests without exposing a
-- project key. Only the Edge Function service client and postgres may read it.
do $block$
begin
  if not exists (
    select 1 from vault.secrets where name = 'article_processing_scheduler_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'article_processing_scheduler_secret'
    );
  end if;
end;
$block$;

create or replace function public.article_processing_scheduler_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'article_processing_scheduler_secret'
  limit 1;
$function$;

revoke execute on function public.article_processing_scheduler_secret() from public, anon, authenticated;
grant execute on function public.article_processing_scheduler_secret() to service_role, postgres;

create or replace function public.enqueue_article_processing_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform net.http_post(
    url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/admin-article',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-article-processing-scheduler-secret', public.article_processing_scheduler_secret()
    ),
    body := jsonb_build_object('action', 'process-next'),
    timeout_milliseconds := 1_000
  );
  return new;
end;
$function$;

revoke execute on function public.enqueue_article_processing_job() from public, anon, authenticated;

drop trigger if exists enqueue_article_processing_job on public.article_processing_jobs;
create trigger enqueue_article_processing_job
after insert on public.article_processing_jobs
for each row
execute function public.enqueue_article_processing_job();

-- Retry the queue every minute. The Edge Function only claims one queued job at a time;
-- a stale processing job is returned to queued state after its progress heartbeat expires.
do $block$
begin
  if exists (select 1 from cron.job where jobname = 'admin-article-processing') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'admin-article-processing'),
      schedule => '* * * * *',
      command => $cron$
        select net.http_post(
          url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/admin-article',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-article-processing-scheduler-secret', public.article_processing_scheduler_secret()
          ),
          body := jsonb_build_object('action', 'process-next'),
          timeout_milliseconds := 1_000
        );
      $cron$,
      active => true
    );
  else
    perform cron.schedule('admin-article-processing', '* * * * *', $cron$
      select net.http_post(
        url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/admin-article',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-article-processing-scheduler-secret', public.article_processing_scheduler_secret()
        ),
        body := jsonb_build_object('action', 'process-next'),
        timeout_milliseconds := 1_000
      );
    $cron$);
  end if;
end;
$block$;
