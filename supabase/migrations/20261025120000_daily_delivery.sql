-- 영어 한잔 Daily: lessons, subscriptions, deliveries, and the delivery scheduler.
--
-- Shape
-- -----
-- Lessons are on one calendar per track: everyone on the business track gets the same
-- lesson on a given weekday, written for that date. Saturday sends a review of the
-- lessons that subscriber actually received Mon–Fri. Sunday sends nothing.
--
-- A subscription carries its own next_send_at. The `daily` Edge Function's `tick` action
-- (every 5 minutes) picks up subscriptions that are due, writes one delivery row per
-- (subscription, kind, date) before sending — the unique key is what keeps an overlapping
-- or retried tick from sending the same lesson twice — then moves next_send_at on.
--
-- Free trial: the first lesson goes out at signup. The next due slot sends the
-- trial-ended notice instead of a lesson and the subscription stops there unless the
-- person subscribes. One trial per phone number per track, ever (daily_trial_claims).

-- ------------------------------------------------------------------ lessons
create table public.daily_lessons (
  id            uuid primary key default gen_random_uuid(),
  track         text not null check (track in ('business', 'tech')),
  -- The KST weekday this lesson is for. Saturdays and Sundays never get one.
  publish_on    date not null check (extract(isodow from publish_on) between 1 and 5),
  expression    text not null check (length(trim(expression)) > 0),
  meaning       text not null check (length(trim(meaning)) > 0),
  pronunciation text,
  stress        text,
  nuance        text,
  similar_expressions text[] not null default '{}',
  -- [{ "context": "회의", "en": "...", "ko": "..." }]
  examples      jsonb not null default '[]'::jsonb check (jsonb_typeof(examples) = 'array'),
  -- [{ "speaker": "A", "role": "Manager", "en": "...", "ko": "..." }]
  dialogue      jsonb not null default '[]'::jsonb check (jsonb_typeof(dialogue) = 'array'),
  -- { "prompt": "...", "options": ["..."], "answer": 0, "explanation": "..." }
  quiz          jsonb,
  audio_path    text,
  -- Only 'ready' lessons are sent. A draft on its date is treated as missing.
  status        text not null default 'draft' check (status in ('draft', 'ready')),
  created_by    text references public.users (uid) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (track, publish_on)
);

comment on table public.daily_lessons is
  'One lesson per track per KST weekday. Sent only when status = ready.';

-- ------------------------------------------------------------------ subscriptions
create table public.daily_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  uid               text not null references public.users (uid) on delete cascade,
  track             text not null check (track in ('business', 'tech')),
  -- Snapshot at signup, normalized to 010…, so a later profile edit or a gift
  -- recipient does not silently redirect someone else's lessons.
  recipient_phone   text not null check (recipient_phone ~ '^01[0-9]{8,9}$'),
  recipient_name    text,
  -- KST wall-clock time, on the hour or half hour.
  delivery_time     time not null check (
    delivery_time between time '06:00' and time '22:00'
    and extract(minute from delivery_time) in (0, 30)
    and extract(second from delivery_time) = 0
  ),
  status            text not null default 'trial'
                      check (status in ('trial', 'trial_ended', 'active', 'cancelled')),
  next_send_at      timestamptz,
  last_sent_at      timestamptz,
  -- Required consent to receive lesson messages, and the separate optional one.
  message_consent_at   timestamptz not null,
  marketing_consent_at timestamptz,
  trial_started_at  timestamptz,
  trial_ended_at    timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One live subscription per person per track.
create unique index daily_subscriptions_one_live_per_track
  on public.daily_subscriptions (uid, track)
  where status in ('trial', 'active');

-- The tick's only query.
create index daily_subscriptions_due
  on public.daily_subscriptions (next_send_at)
  where status in ('trial', 'active');

-- Kept after cancellation on purpose: the claim is what stops a second free trial.
create table public.daily_trial_claims (
  recipient_phone text not null,
  track           text not null check (track in ('business', 'tech')),
  subscription_id uuid references public.daily_subscriptions (id) on delete set null,
  claimed_at      timestamptz not null default now(),
  primary key (recipient_phone, track)
);

-- ------------------------------------------------------------------ deliveries
create table public.daily_deliveries (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.daily_subscriptions (id) on delete cascade,
  kind            text not null check (kind in ('lesson', 'review', 'trial_ended')),
  -- KST date of the slot this delivery fills.
  for_date        date not null,
  lesson_id       uuid references public.daily_lessons (id) on delete set null,
  -- Lessons included in a Saturday review.
  review_lesson_ids uuid[] not null default '{}',
  -- Opens the lesson/review page from the Kakao button without logging in.
  access_token    text not null unique
                    default encode(extensions.gen_random_bytes(18), 'hex'),
  status          text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_request_id text,
  error           text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (subscription_id, kind, for_date)
);

create index daily_deliveries_subscription_sent
  on public.daily_deliveries (subscription_id, for_date)
  where status = 'sent';

-- ------------------------------------------------------------------ updated_at
create or replace function private.daily_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger daily_lessons_touch before update on public.daily_lessons
  for each row execute function private.daily_touch_updated_at();
create trigger daily_subscriptions_touch before update on public.daily_subscriptions
  for each row execute function private.daily_touch_updated_at();

-- ------------------------------------------------------------------ schedule math
-- The first delivery slot strictly after `after`: delivery_time in KST on Mon–Sat.
-- Single source for the signup flow and the tick, so the two can never disagree.
create or replace function public.daily_next_send_at(p_delivery_time time, p_after timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  start_day date := (p_after at time zone 'Asia/Seoul')::date;
  d date;
  candidate timestamptz;
begin
  for i in 0..7 loop
    d := start_day + i;
    continue when extract(isodow from d) = 7;
    candidate := (d + p_delivery_time) at time zone 'Asia/Seoul';
    if candidate > p_after then
      return candidate;
    end if;
  end loop;
  return null; -- unreachable: some Mon–Sat slot is always within 8 days
end;
$$;

-- Moves each still-live subscription on to its first slot after now(). Called by the
-- tick after it has handled (or deliberately skipped) the slot that was due.
create or replace function public.daily_reschedule(p_subscription_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.daily_subscriptions s
     set next_send_at = public.daily_next_send_at(s.delivery_time, now())
   where s.id = any (p_subscription_ids)
     and s.status in ('trial', 'active');
$$;

revoke execute on function public.daily_reschedule(uuid[]) from public, anon, authenticated;
grant execute on function public.daily_reschedule(uuid[]) to service_role;

-- ------------------------------------------------------------------ RLS
alter table public.daily_lessons       enable row level security;
alter table public.daily_subscriptions enable row level security;
alter table public.daily_trial_claims  enable row level security;
alter table public.daily_deliveries    enable row level security;

-- Lesson content is the product: it reaches readers through the Edge Function by
-- delivery token, never by a direct table read. Admins write it.
create policy daily_lessons_admin_all on public.daily_lessons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Subscribers can see their own subscriptions; every write goes through the
-- Edge Function, which enforces trial claims and consent.
create policy daily_subscriptions_select_own on public.daily_subscriptions
  for select to authenticated
  using (uid = public.current_uid() or public.is_admin());

create policy daily_deliveries_select_own on public.daily_deliveries
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.daily_subscriptions s
       where s.id = daily_deliveries.subscription_id
         and s.uid = public.current_uid()
    )
  );

create policy daily_trial_claims_admin_select on public.daily_trial_claims
  for select to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------------ scheduler
-- Same shape as the marketing scheduler: the secret lives in Vault, pg_cron presents
-- it, and the Edge Function reads it back to compare. Nothing to paste by hand.
do $block$
begin
  if not exists (select 1 from vault.secrets where name = 'daily_scheduler_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'daily_scheduler_secret'
    );
  end if;
end;
$block$;

create or replace function public.daily_scheduler_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'daily_scheduler_secret'
  limit 1;
$function$;

revoke execute on function public.daily_scheduler_secret() from public, anon, authenticated;
grant execute on function public.daily_scheduler_secret() to service_role, postgres;

-- Every 5 minutes, so a 08:00 or 08:30 slot goes out within 5 minutes of its time.
-- With no subscriptions it sends nothing; until the Alimtalk template codes are set
-- as function secrets it sends nothing and says so in its heartbeat detail.
do $block$
begin
  if exists (select 1 from cron.job where jobname = 'daily-tick') then
    perform cron.unschedule('daily-tick');
  end if;
  perform cron.schedule(
    'daily-tick',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/daily',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-daily-scheduler-secret', public.daily_scheduler_secret()
        ),
        body := jsonb_build_object('action', 'tick')
      );
    $cron$
  );
end;
$block$;

insert into public.scheduler_heartbeats (job_name, expected_interval, last_success_at)
values ('daily.tick', interval '20 minutes', now())
on conflict (job_name) do nothing;
