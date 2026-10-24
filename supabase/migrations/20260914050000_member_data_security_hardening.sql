-- Harden member data exposure without changing payment or billing-key storage.
--
-- Goals:
--   * public_users is signed-in only and security-invoker.
--   * only uid/display_name/photo_url are selectable by normal signed-in clients.
--   * backend/service-role callers retain temporary compatibility with leaderboard fields.
--   * profile_public is removed; membership profiles are no longer opt-out.
--   * meetup_participants is no longer anonymously readable.
--   * user_first_paid is backend-only.
--   * SECURITY DEFINER RPCs are not anonymously executable by default.

-- ---------------------------------------------------------------------------
-- 1. Signed-in-only member directory behind a security-invoker view.
-- ---------------------------------------------------------------------------

create schema if not exists private;

create table if not exists private.member_profile_directory (
  uid text primary key references public.users(uid) on delete cascade,
  display_name text,
  photo_url text,
  account_status text,
  has_active_subscription boolean not null default false,
  created_at timestamptz,
  subscription_start_date timestamptz
);

alter table private.member_profile_directory enable row level security;

revoke all on table private.member_profile_directory from public, anon, authenticated;
grant select on table private.member_profile_directory to authenticated;
grant all on table private.member_profile_directory to service_role;

-- The private schema is not exposed by the Data API. This policy exists so a
-- security-invoker public view can read the directory for signed-in members.
drop policy if exists "signed-in members read member directory" on private.member_profile_directory;
create policy "signed-in members read member directory"
  on private.member_profile_directory
  for select
  to authenticated
  using (true);

insert into private.member_profile_directory (
  uid,
  display_name,
  photo_url,
  account_status,
  has_active_subscription,
  created_at,
  subscription_start_date
)
select
  u.uid,
  u.display_name,
  u.photo_url,
  u.account_status,
  coalesce(u.has_active_subscription, false),
  u.created_at,
  u.subscription_start_date
from public.users u
where not coalesce(u.is_placeholder, false)
  and u.deleted_at is null
on conflict (uid) do update set
  display_name = excluded.display_name,
  photo_url = excluded.photo_url,
  account_status = excluded.account_status,
  has_active_subscription = excluded.has_active_subscription,
  created_at = excluded.created_at,
  subscription_start_date = excluded.subscription_start_date;

create or replace function private.sync_member_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_placeholder, false) or new.deleted_at is not null then
    delete from private.member_profile_directory where uid = new.uid;
    return new;
  end if;

  insert into private.member_profile_directory (
    uid,
    display_name,
    photo_url,
    account_status,
    has_active_subscription,
    created_at,
    subscription_start_date
  )
  values (
    new.uid,
    new.display_name,
    new.photo_url,
    new.account_status,
    coalesce(new.has_active_subscription, false),
    new.created_at,
    new.subscription_start_date
  )
  on conflict (uid) do update set
    display_name = excluded.display_name,
    photo_url = excluded.photo_url,
    account_status = excluded.account_status,
    has_active_subscription = excluded.has_active_subscription,
    created_at = excluded.created_at,
    subscription_start_date = excluded.subscription_start_date;

  return new;
end;
$$;

revoke all on function private.sync_member_profile_directory() from public, anon, authenticated;

drop trigger if exists sync_member_profile_directory on public.users;
create trigger sync_member_profile_directory
after insert or update of
  uid,
  display_name,
  photo_url,
  account_status,
  has_active_subscription,
  created_at,
  subscription_start_date,
  is_placeholder,
  deleted_at
on public.users
for each row
execute function private.sync_member_profile_directory();

-- Keep the existing seven-column shape temporarily for backend leaderboard
-- compatibility, while exposing only the three actual member-directory fields
-- to signed-in clients. security_invoker makes the caller's grants/RLS apply.
create or replace view public.public_users
with (security_invoker = true)
as
select
  uid,
  display_name,
  photo_url,
  account_status,
  has_active_subscription,
  created_at,
  subscription_start_date
from private.member_profile_directory;

revoke all on public.public_users from public, anon, authenticated;
grant select (uid, display_name, photo_url) on public.public_users to authenticated;
grant select on public.public_users to service_role;

-- ---------------------------------------------------------------------------
-- 2. Remove the profile visibility opt-out from the canonical users row.
-- ---------------------------------------------------------------------------

-- Recreate account deletion without referencing the column that is being removed.
create or replace function public.delete_account_data(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_phone text;
  v_meetups text[];
  v_now timestamptz := now();
begin
  if p_uid is null or btrim(p_uid) = '' then
    raise exception 'uid is required';
  end if;

  select phone into v_phone from public.users where uid = p_uid;

  select coalesce(array_agg(id), '{}') into v_meetups
    from public.meetups where date_time >= v_now;

  if array_length(v_meetups, 1) is not null then
    delete from public.meetup_participants
     where user_id = p_uid and meetup_id = any(v_meetups);

    update public.meetups m
       set current_participants = (
             select count(*) from public.meetup_participants p where p.meetup_id = m.id)
     where m.id = any(v_meetups);
  end if;

  delete from public.profile_likes where liker_id = p_uid or liked_id = p_uid;
  delete from public.user_blocks where blocker_id = p_uid or blocked_user_id = p_uid;
  delete from public.conversation_members where user_id = p_uid;
  delete from public.messages where sender_id = p_uid;
  update public.conversations set created_by = null where created_by = p_uid;
  delete from public.conversations where system_owner_user_id = p_uid;
  delete from public.article_discussion_votes where user_id = p_uid;
  delete from public.notification_reads where user_id = p_uid;
  delete from public.notification_deliveries where user_id = p_uid;

  delete from public.user_vocabulary where user_id = p_uid;
  delete from public.vocabulary_study_cards where user_id = p_uid;
  delete from public.vocabulary_review_events where user_id = p_uid;
  delete from public.vocabulary_deck_follows where user_id = p_uid;
  delete from public.vocabulary_deck_study_preferences where user_id = p_uid;
  delete from public.exam_attempts where user_id = p_uid;
  delete from public.speaking_test_attempts where user_id = p_uid;
  delete from public.blog_post_likes where user_id = p_uid;
  delete from public.non_korean_applications where user_id = p_uid;
  delete from public.auth_session_events where uid = p_uid;

  if v_phone is not null and btrim(v_phone) <> '' then
    delete from public.phone_otp where phone = v_phone;
  end if;

  update public.feedback
     set user_id = null, other_reason = null, survey = null where user_id = p_uid;
  update public.speaking_reports
     set user_script = null, speaker_id = null, metadata = '{}'::jsonb where user_id = p_uid;
  update public.billing_stops set reason = null where user_id = p_uid;
  update public.payment_cancellations
     set reason = null, payple_response = '{}'::jsonb, payple_error_message = null
   where user_id = p_uid;
  update public.payment_orders
     set billing_key_used = null,
         payment_result = '{}'::jsonb,
         payple_response = '{}'::jsonb,
         payple_params_attempted = '{}'::jsonb
   where user_id = p_uid;
  update public.participation_credit_transactions
     set metadata = jsonb_build_object('account_deleted', true, 'audit_retained', true)
   where user_id = p_uid;

  update public.referral_codes set active = false, referrer = null where referrer = p_uid;

  update public.users
     set email = null, display_name = 'Deleted member', photo_url = null, phone = null,
         kakao_id = null, auth_id = null, account_status = 'deleted', user_type = null,
         gdg_member = false, has_active_subscription = false, plan_price = null,
         billing_key = null, payment_method = null, billing_cancelled = true,
         subscription_start_date = null, subscription_end_date = null,
         last_billing_date = null, billing_updated_at = null,
         cancellation_timestamp = v_now, cancellation_type = 'account_deleted',
         cancellation_reason = null, cat_tech = false, cat_business = false,
         received_articles = '{}', last_received = null, left_count = null,
         saved_words = '{}', referral_code = null, referral_generated_at = null,
         bio = null, work = null, school = null, interests = null,
         location = 'anam', last_login_at = null, deleted_at = v_now,
         updated_at = v_now
   where uid = p_uid;

  return jsonb_build_object('uid', p_uid, 'erased_at', v_now);
end;
$$;

alter table public.users drop column if exists profile_public;

-- ---------------------------------------------------------------------------
-- 3. meetup_participants: signed-in read only; no anonymous table access.
-- ---------------------------------------------------------------------------

revoke all on table public.meetup_participants from anon;

drop policy if exists "read participants" on public.meetup_participants;
drop policy if exists "signed-in members read participants" on public.meetup_participants;
create policy "signed-in members read participants"
  on public.meetup_participants
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 4. user_first_paid: backend only and security-invoker.
-- ---------------------------------------------------------------------------

alter view public.user_first_paid set (security_invoker = true);
revoke all on public.user_first_paid from public, anon, authenticated;
grant select on public.user_first_paid to service_role;

-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER RPCs: anonymous execution is opt-in, not the default.
-- ---------------------------------------------------------------------------

-- Preserve existing authenticated/service-role behavior, but remove privileges
-- inherited through PUBLIC for SECURITY DEFINER functions that anon could call.
-- The three explicit anon exceptions below are required by current public RLS or
-- the intentionally public aggregate home stats endpoint.
do $$
declare
  r record;
  keep_anon boolean;
begin
  for r in
    select
      p.oid,
      p.oid::regprocedure as signature,
      p.proname,
      has_function_privilege('authenticated', p.oid, 'execute') as auth_execute,
      has_function_privilege('service_role', p.oid, 'execute') as service_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    keep_anon := r.proname in ('home_stats_counts', 'current_uid', 'is_admin');

    execute format('revoke execute on function %s from public, anon', r.signature);

    if r.auth_execute then
      execute format('grant execute on function %s to authenticated', r.signature);
    end if;

    if r.service_execute then
      execute format('grant execute on function %s to service_role', r.signature);
    end if;

    if keep_anon then
      execute format('grant execute on function %s to anon', r.signature);
    end if;
  end loop;
end;
$$;
