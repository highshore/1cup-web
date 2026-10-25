-- 영어 한잔 Daily signup: Daily's own customers and phone-code login, consent records,
-- the start-trial transaction, and retention.
--
-- Daily is a separate service from the 1cup membership. It shares the database and the
-- NHN Cloud / Payple accounts, but not people: a Daily customer is a verified phone
-- number in daily_customers, signed in with a Daily-only code, and nothing here reads or
-- references public.users or Supabase Auth. Phase 1 pointed subscriptions at
-- public.users; this moves them onto daily_customers while every Daily table is still
-- empty.

do $guard$
begin
  if exists (select 1 from public.daily_subscriptions) then
    raise exception 'daily_subscriptions has rows; this migration assumes it is empty';
  end if;
end;
$guard$;

-- ------------------------------------------------------------------ customers
create table public.daily_customers (
  id            uuid primary key default gen_random_uuid(),
  -- Verified by code, normalized to 010…. One customer per number.
  phone         text not null unique check (phone ~ '^01[0-9]{8,9}$'),
  name          text check (name is null or length(name) <= 20),
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger daily_customers_touch before update on public.daily_customers
  for each row execute function private.daily_touch_updated_at();

-- Sign-in codes. Only an HMAC of the code is stored; rows live for a day (see retention).
create table public.daily_otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code_hash   text not null,
  -- Hash of the requesting IP, for the per-IP send limit. Never the IP itself.
  ip_hash     text,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index daily_otp_codes_phone on public.daily_otp_codes (phone, created_at desc);
create index daily_otp_codes_ip on public.daily_otp_codes (ip_hash, created_at desc);

-- Signed-in sessions. The browser holds a random token in an httpOnly cookie; only its
-- SHA-256 is stored here.
create table public.daily_sessions (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.daily_customers (id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);

create index daily_sessions_customer on public.daily_sessions (customer_id);

-- ------------------------------------------------------------------ config
-- Opening trials to the public, and the phone numbers allowed to try the flow before
-- that, are data rather than deploy-time settings: flipping them is an UPDATE.
create table public.daily_config (
  id            text primary key default 'settings' check (id = 'settings'),
  trial_open    boolean not null default false,
  tester_phones text[] not null default '{}',
  updated_at    timestamptz not null default now()
);

insert into public.daily_config (id) values ('settings') on conflict do nothing;

-- ------------------------------------------------------------------ subscriptions → customers
drop policy if exists daily_subscriptions_select_own on public.daily_subscriptions;
drop policy if exists daily_deliveries_select_own on public.daily_deliveries;
drop index if exists public.daily_subscriptions_one_live_per_track;

alter table public.daily_subscriptions
  drop column uid,
  add column customer_id uuid not null references public.daily_customers (id) on delete cascade,
  add column terms_version     text,
  add column terms_agreed_at   timestamptz,
  add column privacy_agreed_at timestamptz;

create unique index daily_subscriptions_one_live_per_track
  on public.daily_subscriptions (customer_id, track)
  where status in ('trial', 'active');

-- Lessons are written by 1cup staff through the admin tools; keep who wrote one as a
-- plain id rather than a reference into the 1cup users table.
alter table public.daily_lessons drop constraint if exists daily_lessons_created_by_fkey;

-- ------------------------------------------------------------------ RLS
-- Customers, codes, sessions and config are reached only through the server (service
-- role). RLS on with no policies means no client can read or write them.
alter table public.daily_customers enable row level security;
alter table public.daily_otp_codes enable row level security;
alter table public.daily_sessions  enable row level security;
alter table public.daily_config    enable row level security;

-- ------------------------------------------------------------------ start a trial
-- One transaction for the two rows a trial needs: the claim that uses up this phone's
-- free trial on this track, and the subscription itself. Either both land or neither
-- does, so a failed signup never burns someone's trial.
--
-- The first lesson is sent by the Edge Function right after this returns. next_send_at
-- is the first slot at least 12 hours out, which is when the trial-ended notice goes:
-- someone signing up at 07:00 for an 08:00 slot should not hear "your trial is over"
-- an hour after their free lesson.
create or replace function public.daily_start_trial(
  p_customer_id   uuid,
  p_track         text,
  p_name          text,
  p_delivery_time time,
  p_marketing     boolean,
  p_terms_version text
)
returns public.daily_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now      timestamptz := now();
  v_customer public.daily_customers;
  v_name     text := nullif(btrim(coalesce(p_name, '')), '');
  v_sub      public.daily_subscriptions;
begin
  update public.daily_customers
     set name = coalesce(v_name, name)
   where id = p_customer_id
  returning * into v_customer;
  if not found then
    raise exception 'customer-not-found' using errcode = 'P0001';
  end if;

  insert into public.daily_trial_claims (recipient_phone, track)
  values (v_customer.phone, p_track)
  on conflict do nothing;
  if not found then
    raise exception 'trial-used' using errcode = 'P0001';
  end if;

  begin
    insert into public.daily_subscriptions (
      customer_id, track, recipient_phone, recipient_name, delivery_time, status,
      next_send_at, trial_started_at,
      message_consent_at, marketing_consent_at,
      terms_version, terms_agreed_at, privacy_agreed_at
    )
    values (
      v_customer.id, p_track, v_customer.phone, v_customer.name, p_delivery_time, 'trial',
      public.daily_next_send_at(p_delivery_time, v_now + interval '12 hours'), v_now,
      v_now, case when p_marketing then v_now end,
      p_terms_version, v_now, v_now
    )
    returning * into v_sub;
  exception when unique_violation then
    -- Raising here aborts the whole call, the claim above included.
    raise exception 'already-subscribed' using errcode = 'P0001';
  end;

  update public.daily_trial_claims
     set subscription_id = v_sub.id
   where recipient_phone = v_customer.phone and track = p_track;

  return v_sub;
end;
$$;

revoke execute on function public.daily_start_trial(uuid, text, text, time, boolean, text)
  from public, anon, authenticated;
grant execute on function public.daily_start_trial(uuid, text, text, time, boolean, text)
  to service_role;

-- ------------------------------------------------------------------ retention
-- What the Daily privacy notice promises:
--   sign-in codes: 1 day; sessions: 30 days after they end;
--   subscriptions and their deliveries: 1 year after a trial or subscription ends;
--   trial history (phone + track, only to stop repeat free trials): 1 year;
--   customers: 1 year after their last sign-in once they hold no subscription.
-- Payment records are kept separately under the e-commerce act.
create or replace function private.daily_apply_retention()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.daily_otp_codes
   where created_at < now() - interval '1 day';

  delete from public.daily_sessions
   where coalesce(revoked_at, expires_at) < now() - interval '30 days';

  delete from public.daily_subscriptions
   where status in ('trial_ended', 'cancelled')
     and coalesce(cancelled_at, trial_ended_at, updated_at) < now() - interval '1 year';

  delete from public.daily_trial_claims
   where claimed_at < now() - interval '1 year';

  delete from public.daily_customers c
   where coalesce(c.last_login_at, c.created_at) < now() - interval '1 year'
     and not exists (select 1 from public.daily_subscriptions s where s.customer_id = c.id);
$$;

do $block$
begin
  if exists (select 1 from cron.job where jobname = 'daily-retention') then
    perform cron.unschedule('daily-retention');
  end if;
  -- 04:00 KST.
  perform cron.schedule('daily-retention', '0 19 * * *', 'select private.daily_apply_retention();');
end;
$block$;
