-- Notice when a scheduled job stops working.
--
-- Why
-- ---
-- Recurring billing was rejected for two days and nothing said so. pg_cron recorded
-- every run as "succeeded", because succeeding at queueing an HTTP request is all it
-- claims; the 403 lived only in net._http_response, which nobody reads and which pg_net
-- clears after a few hours. It surfaced because somebody happened to ask.
--
-- Watching for failures is the wrong shape. A response in net._http_response cannot even
-- be traced back to the job that caused it — http_request_queue is emptied once the call
-- is made and _http_response keeps no url. And the failures that matter most are the
-- quiet ones: a job unscheduled, a function that never starts, a request that never
-- leaves. None of those produce a failure to find.
--
-- So watch for the absence of success instead. Each scheduled action reports in when it
-- finishes; anything that has not reported within the interval it promised is stale.
-- One signal covers auth rejections, crashes, disabled jobs and delivery failures alike.

create table if not exists public.scheduler_heartbeats (
  job_name          text primary key,
  expected_interval interval    not null,
  last_success_at   timestamptz,
  last_detail       jsonb,
  updated_at        timestamptz not null default now()
);

comment on table public.scheduler_heartbeats is
  'One row per scheduled action. expected_interval is the longest gap that is still '
  'healthy — set it well above the schedule so a single missed tick is not an alert.';

-- Generous on purpose: a daily job gets 25 hours, so one late run is tolerated and a
-- genuinely broken one is caught the next day rather than paging on jitter.
insert into public.scheduler_heartbeats (job_name, expected_interval) values
  ('payment.process-recurring', interval '25 hours'),
  ('cefr.poll',                 interval '30 minutes'),
  ('messaging.send-links',      interval '25 hours')
on conflict (job_name) do nothing;

-- Called by the Edge Functions themselves, at the end of a run that actually did its
-- work. Creates the row if the job is new, so adding a scheduled action does not mean
-- remembering to seed a table.
create or replace function public.record_scheduler_heartbeat(
  p_job_name text,
  p_detail   jsonb default null,
  p_expected interval default interval '25 hours'
)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.scheduler_heartbeats (job_name, expected_interval, last_success_at, last_detail, updated_at)
  values (p_job_name, p_expected, now(), p_detail, now())
  on conflict (job_name) do update
    set last_success_at = now(),
        last_detail     = excluded.last_detail,
        updated_at      = now();
$$;

create or replace view public.scheduler_health as
  select job_name,
         expected_interval,
         last_success_at,
         now() - last_success_at as since_last_success,
         (last_success_at is null
          or now() - last_success_at > expected_interval) as stale
    from public.scheduler_heartbeats;

comment on view public.scheduler_health is
  'stale = this job has not reported a successful run within the gap it promised.';

-- An alert stays open until the job reports in again, so a glance at the open rows
-- answers "is anything broken right now" without reading history.
create table if not exists public.scheduler_alerts (
  id              bigserial primary key,
  job_name        text        not null,
  detected_at     timestamptz not null default now(),
  last_success_at timestamptz,
  resolved_at     timestamptz
);

create unique index if not exists scheduler_alerts_open_uniq
  on public.scheduler_alerts (job_name) where resolved_at is null;

create or replace function public.check_scheduler_health()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_opened int := 0;
  v_closed int := 0;
begin
  -- Open one alert per newly stale job. The partial unique index keeps a job that stays
  -- broken for a week to a single row instead of one per check.
  insert into public.scheduler_alerts (job_name, last_success_at)
  select h.job_name, h.last_success_at
    from public.scheduler_health h
   where h.stale
  on conflict (job_name) where resolved_at is null do nothing;
  get diagnostics v_opened = row_count;

  update public.scheduler_alerts a
     set resolved_at = now()
   where a.resolved_at is null
     and exists (select 1 from public.scheduler_health h
                  where h.job_name = a.job_name and not h.stale);
  get diagnostics v_closed = row_count;

  return jsonb_build_object('opened', v_opened, 'closed', v_closed,
                            'open_total', (select count(*) from public.scheduler_alerts where resolved_at is null));
end $$;

-- Operational data: no reason for a browser to reach it. Service role bypasses RLS, and
-- no policy is defined, so anon and authenticated see nothing.
alter table public.scheduler_heartbeats enable row level security;
alter table public.scheduler_alerts     enable row level security;

revoke all on function public.record_scheduler_heartbeat(text, jsonb, interval) from public, anon, authenticated;
revoke all on function public.check_scheduler_health() from public, anon, authenticated;

-- ------------------------------------------------------------------------ the check
-- Runs in the database, so it does not depend on the same Edge Function plumbing it is
-- meant to watch. Every 15 minutes is frequent enough to catch a daily billing job the
-- same evening, and cheap enough not to think about.
do $$
begin
  perform cron.unschedule('scheduler-health-check');
exception when others then null;  -- not scheduled yet
end $$;

select cron.schedule('scheduler-health-check', '*/15 * * * *', $cron$
  select public.check_scheduler_health();
$cron$);
