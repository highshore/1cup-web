-- 영어 한잔 Daily signup: consent records, the start-trial transaction, and retention.

-- ------------------------------------------------------------------ consent records
-- Which version of the Daily terms the person agreed to, and when they agreed to the
-- terms and to the collection of their details. message_consent_at (lesson messages)
-- and marketing_consent_at already exist.
alter table public.daily_subscriptions
  add column terms_version     text,
  add column terms_agreed_at   timestamptz,
  add column privacy_agreed_at timestamptz;

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
  p_uid           text,
  p_track         text,
  p_phone         text,
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
  v_now timestamptz := now();
  v_sub public.daily_subscriptions;
begin
  insert into public.daily_trial_claims (recipient_phone, track)
  values (p_phone, p_track)
  on conflict do nothing;
  if not found then
    raise exception 'trial-used' using errcode = 'P0001';
  end if;

  begin
    insert into public.daily_subscriptions (
      uid, track, recipient_phone, recipient_name, delivery_time, status,
      next_send_at, trial_started_at,
      message_consent_at, marketing_consent_at,
      terms_version, terms_agreed_at, privacy_agreed_at
    )
    values (
      p_uid, p_track, p_phone, nullif(btrim(p_name), ''), p_delivery_time, 'trial',
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
   where recipient_phone = p_phone and track = p_track;

  return v_sub;
end;
$$;

revoke execute on function public.daily_start_trial(text, text, text, text, time, boolean, text)
  from public, anon, authenticated;
grant execute on function public.daily_start_trial(text, text, text, text, time, boolean, text)
  to service_role;

-- ------------------------------------------------------------------ account deletion
-- Account deletion keeps a tombstone users row rather than deleting it, so the uid
-- cascade never fires. Daily holds a phone number and a name per subscription; drop
-- them when the account is deleted. Trial claims stay for their year (see below), as
-- the Daily privacy notice says.
create or replace function private.daily_forget_deleted_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.daily_subscriptions where uid = new.uid;
  return new;
end;
$$;

create trigger daily_forget_deleted_account
  after update of account_status on public.users
  for each row
  when (new.account_status = 'deleted' and old.account_status is distinct from 'deleted')
  execute function private.daily_forget_deleted_account();

-- ------------------------------------------------------------------ retention
-- What the Daily privacy notice promises: subscription details are kept for one year
-- after a trial or subscription ends, and trial history (phone + track, used only to
-- stop repeat free trials) for one year after the trial. Deliveries go with their
-- subscription. Payment records are kept separately under the e-commerce act.
create or replace function private.daily_apply_retention()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.daily_subscriptions
   where status in ('trial_ended', 'cancelled')
     and coalesce(cancelled_at, trial_ended_at, updated_at) < now() - interval '1 year';

  delete from public.daily_trial_claims
   where claimed_at < now() - interval '1 year';
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
