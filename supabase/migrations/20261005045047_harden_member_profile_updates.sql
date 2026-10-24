-- Close self-service privilege escalation through public.users.
--
-- public.users mixes member-editable profile data with server-owned identity,
-- authorization, billing and entitlement state. RLS restricts rows, not columns,
-- so table-wide UPDATE allowed a member to promote their own row to admin or
-- grant themselves paid access.
--
-- Browser roles now receive UPDATE only on presentation/profile columns.
-- Sensitive changes are additionally rejected by a BEFORE UPDATE guard even if
-- a broad grant is accidentally reintroduced later.

revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;

grant update (
  display_name,
  photo_url,
  bio,
  work,
  school,
  location,
  interests,
  profile_details,
  onboarding_completed_at,
  updated_at
) on table public.users to authenticated;

drop policy if exists "own update" on public.users;
create policy "own update" on public.users
  for update
  to authenticated
  using ((uid = public.current_uid()) or public.is_admin())
  with check ((uid = public.current_uid()) or public.is_admin());

create or replace function private.guard_users_sensitive_update()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       new.uid is distinct from old.uid
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.kakao_id is distinct from old.kakao_id
    or new.account_status is distinct from old.account_status
    or new.user_type is distinct from old.user_type
    or new.gdg_member is distinct from old.gdg_member
    or new.has_active_subscription is distinct from old.has_active_subscription
    or new.plan_price is distinct from old.plan_price
    or new.billing_key is distinct from old.billing_key
    or new.payment_method is distinct from old.payment_method
    or new.billing_cancelled is distinct from old.billing_cancelled
    or new.subscription_start_date is distinct from old.subscription_start_date
    or new.subscription_end_date is distinct from old.subscription_end_date
    or new.last_billing_date is distinct from old.last_billing_date
    or new.billing_updated_at is distinct from old.billing_updated_at
    or new.cancellation_timestamp is distinct from old.cancellation_timestamp
    or new.cancellation_type is distinct from old.cancellation_type
    or new.cancellation_reason is distinct from old.cancellation_reason
    or new.cat_tech is distinct from old.cat_tech
    or new.cat_business is distinct from old.cat_business
    or new.received_articles is distinct from old.received_articles
    or new.last_received is distinct from old.last_received
    or new.left_count is distinct from old.left_count
    or new.saved_words is distinct from old.saved_words
    or new.referral_code is distinct from old.referral_code
    or new.referral_generated_at is distinct from old.referral_generated_at
    or new.created_at is distinct from old.created_at
    or new.last_login_at is distinct from old.last_login_at
    or new.auth_id is distinct from old.auth_id
    or new.is_placeholder is distinct from old.is_placeholder
    or new.deleted_at is distinct from old.deleted_at
    or new.identity_unmatched is distinct from old.identity_unmatched
    or new.pricing_version is distinct from old.pricing_version
  ) then
    raise exception 'Sensitive member fields are server-managed'
      using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all on function private.guard_users_sensitive_update()
  from public, anon, authenticated;

drop trigger if exists guard_users_sensitive_update on public.users;
create trigger guard_users_sensitive_update
before update on public.users
for each row execute function private.guard_users_sensitive_update();

-- Legitimate member billing reactivation remains available, but only through a
-- narrow server-owned transaction after proving the caller's session.
create or replace function public.reactivate_own_billing()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := public.current_uid();
  v_user public.users%rowtype;
begin
  if auth.uid() is null or v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_user
  from public.users
  where uid = v_uid
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0001';
  end if;

  if coalesce(v_user.has_active_subscription, false) is not true then
    raise exception 'No active subscription to reactivate' using errcode = 'P0001';
  end if;

  if nullif(v_user.billing_key, '') is null then
    raise exception 'No billing method to reactivate' using errcode = 'P0001';
  end if;

  update public.users
  set billing_cancelled = false,
      billing_updated_at = now()
  where uid = v_uid;

  return true;
end
$$;

revoke all on function public.reactivate_own_billing()
  from public, anon, authenticated;
grant execute on function public.reactivate_own_billing()
  to authenticated;

-- Admins previously extended subscription dates with a browser-side table
-- update. Keep that capability behind an explicit admin check instead.
create or replace function public.admin_extend_member_subscription(
  p_user_id text,
  p_days integer default 14
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base timestamptz;
  v_new_end timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_user_id is null or p_days < 1 or p_days > 365 then
    raise exception 'Invalid extension request' using errcode = '22023';
  end if;

  select coalesce(subscription_end_date, subscription_start_date, now())
    into v_base
  from public.users
  where uid = p_user_id
    and coalesce(has_active_subscription, false) = true
    and coalesce(account_status, 'user') <> 'admin'
  for update;

  if not found then
    raise exception 'Active member not found' using errcode = 'P0001';
  end if;

  v_new_end := v_base + make_interval(days => p_days);

  update public.users
  set subscription_end_date = v_new_end
  where uid = p_user_id;

  return v_new_end;
end
$$;

revoke all on function public.admin_extend_member_subscription(text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_extend_member_subscription(text, integer)
  to authenticated;
