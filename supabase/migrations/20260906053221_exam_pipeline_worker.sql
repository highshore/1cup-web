-- Durable, server-owned orchestration for the exam-interviewer pipeline.
--
-- Exam media generation used to execute inside the Next.js request that an admin
-- started. That request could time out after a few assets, and Veo completion
-- depended on an administrator keeping the Test Center tab open. Jobs below are
-- private, scheduled by Postgres, and picked up by the Edge worker independently
-- of the originating browser session.

create table if not exists public.exam_pipeline_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('interviewer', 'exam', 'narration', 'item', 'visuals')),
  scope_key text not null check (char_length(scope_key) between 3 and 180),
  interviewer_id uuid references public.exam_interviewers(id) on delete cascade,
  exam_set_id uuid references public.exam_sets(id) on delete cascade,
  narration_id uuid references public.exam_set_narration(id) on delete cascade,
  item_id uuid references public.exam_set_items(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  stage text not null default 'queued' check (char_length(stage) between 1 and 80),
  progress smallint not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error text,
  requested_by text references public.users(uid) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  check (
    (job_type = 'interviewer' and interviewer_id is not null and exam_set_id is null and narration_id is null and item_id is null)
    or (job_type = 'exam' and exam_set_id is not null and interviewer_id is null and narration_id is null and item_id is null)
    or (job_type = 'narration' and narration_id is not null and interviewer_id is null and exam_set_id is null and item_id is null)
    or (job_type = 'item' and item_id is not null and interviewer_id is null and exam_set_id is null and narration_id is null)
    or (job_type = 'visuals' and exam_set_id is not null and interviewer_id is null and narration_id is null and item_id is null)
  )
);

create index if not exists exam_pipeline_jobs_queue_idx
  on public.exam_pipeline_jobs (status, created_at);
create index if not exists exam_pipeline_jobs_scope_idx
  on public.exam_pipeline_jobs (scope_key, created_at desc);
create index if not exists exam_pipeline_jobs_exam_set_idx
  on public.exam_pipeline_jobs (exam_set_id, created_at desc)
  where exam_set_id is not null;

-- Do not let a double-click create concurrent billable work for the same target.
create unique index if not exists exam_pipeline_jobs_one_active_scope_idx
  on public.exam_pipeline_jobs (scope_key)
  where status in ('queued', 'processing');

alter table public.exam_pipeline_jobs enable row level security;
revoke all on table public.exam_pipeline_jobs from anon, authenticated;

-- Claim through Postgres rather than a select-then-update race. Every pg_net
-- trigger invocation can therefore take a different job, while SKIP LOCKED
-- keeps a concurrent Edge Function from charging for the same asset twice.
create or replace function public.claim_exam_pipeline_job()
returns setof public.exam_pipeline_jobs
language sql
security definer
set search_path = ''
as $function$
  with candidate as (
    select id
    from public.exam_pipeline_jobs
    where status = 'queued'
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.exam_pipeline_jobs as job
  set
    status = 'processing',
    stage = 'claimed',
    progress = 5,
    attempt_count = job.attempt_count + 1,
    started_at = now(),
    updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
$function$;

revoke execute on function public.claim_exam_pipeline_job() from public, anon, authenticated;
grant execute on function public.claim_exam_pipeline_job() to service_role, postgres;

do $block$
begin
  if not exists (
    select 1 from vault.secrets where name = 'exam_pipeline_scheduler_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'exam_pipeline_scheduler_secret'
    );
  end if;
end;
$block$;

create or replace function public.exam_pipeline_scheduler_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'exam_pipeline_scheduler_secret'
  limit 1;
$function$;

revoke execute on function public.exam_pipeline_scheduler_secret() from public, anon, authenticated;
grant execute on function public.exam_pipeline_scheduler_secret() to service_role, postgres;

create or replace function public.enqueue_exam_pipeline_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform net.http_post(
    url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/exam-pipeline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-exam-pipeline-scheduler-secret', public.exam_pipeline_scheduler_secret()
    ),
    body := jsonb_build_object('action', 'process-next'),
    timeout_milliseconds := 1_000
  );
  return new;
end;
$function$;

revoke execute on function public.enqueue_exam_pipeline_job() from public, anon, authenticated;

drop trigger if exists enqueue_exam_pipeline_job on public.exam_pipeline_jobs;
create trigger enqueue_exam_pipeline_job
after insert on public.exam_pipeline_jobs
for each row
execute function public.enqueue_exam_pipeline_job();

-- The trigger makes a newly queued job promptly visible; the cron retry covers a
-- lost pg_net request and also continues Veo operation polling without a browser.
do $block$
begin
  if exists (select 1 from cron.job where jobname = 'exam-pipeline-processing') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'exam-pipeline-processing'),
      schedule => '* * * * *',
      command => $cron$
        select net.http_post(
          url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/exam-pipeline',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-exam-pipeline-scheduler-secret', public.exam_pipeline_scheduler_secret()
          ),
          body := jsonb_build_object('action', 'process-next'),
          timeout_milliseconds := 1_000
        );
      $cron$,
      active => true
    );
  else
    perform cron.schedule('exam-pipeline-processing', '* * * * *', $cron$
      select net.http_post(
        url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/exam-pipeline',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-exam-pipeline-scheduler-secret', public.exam_pipeline_scheduler_secret()
        ),
        body := jsonb_build_object('action', 'process-next'),
        timeout_milliseconds := 1_000
      );
    $cron$);
  end if;
end;
$block$;
