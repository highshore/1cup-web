-- 내 정보 gains 소속 and 직종; the review moves to its own page and earns 15 days; the
-- invite reward goes from 7 to 15 days (terms 제5조의2, 제9조의3, version 2026-10-27.1).
--
--   * daily_customers.workplace / job_category: typed on 내 계정 or on the review page,
--     where both are required. Cleared when the account is deleted.
--   * daily_reviews.promo_consent_at: the writer agreed the review may be used for
--     promotion. reward_earned_at / reward_applied_at: the 15-day reward, once per
--     customer — put on the live paid period at once, or on the next payment.
--   * daily_apply_invite: both invite rewards are 15 days, and it also applies a pending
--     review reward to the payment's period.
--
-- Additive only: new nullable columns, a trigger, functions.

alter table public.daily_customers
  add column if not exists workplace text check (workplace is null or length(workplace) <= 60),
  add column if not exists job_category text check (job_category is null or length(job_category) <= 40);

-- Account deletion keeps an anonymized row when payments exist; it must not keep these.
create or replace function private.daily_clear_profile_on_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.workplace := null;
    new.job_category := null;
  end if;
  return new;
end;
$$;

drop trigger if exists daily_customers_clear_profile on public.daily_customers;
create trigger daily_customers_clear_profile before update on public.daily_customers
  for each row execute function private.daily_clear_profile_on_delete();

alter table public.daily_reviews
  add column if not exists promo_consent_at timestamptz,
  add column if not exists reward_earned_at timestamptz,
  add column if not exists reward_applied_at timestamptz;

-- Called right after a review is saved. Earns the reward once, and puts 15 days on the
-- customer's live paid period (the one ending last); with none, daily_apply_invite adds
-- it to their next payment. Returns 'applied', 'pending' or 'none' (no review).
create or replace function public.daily_grant_review_reward(p_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.daily_reviews;
  v_sub    public.daily_subscriptions;
begin
  select * into v_review from public.daily_reviews where customer_id = p_customer_id for update;
  if not found then
    return 'none';
  end if;
  if v_review.reward_applied_at is not null then
    return 'applied';
  end if;
  if v_review.reward_earned_at is null then
    update public.daily_reviews set reward_earned_at = now() where id = v_review.id;
  end if;

  select * into v_sub from public.daily_subscriptions
   where customer_id = p_customer_id and status = 'active' and paid_until > now()
   order by paid_until desc limit 1 for update;
  if found then
    update public.daily_subscriptions set paid_until = paid_until + interval '15 days' where id = v_sub.id;
    update public.daily_reviews set reward_applied_at = now() where id = v_review.id;
    return 'applied';
  end if;
  return 'pending';
end;
$$;
revoke execute on function public.daily_grant_review_reward(uuid) from public, anon, authenticated;
grant execute on function public.daily_grant_review_reward(uuid) to service_role;

create or replace function public.daily_apply_invite(p_order_number text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.daily_orders;
  v_inviter public.daily_customers;
  v_sub     public.daily_subscriptions;
  v_pending integer;
  v_applied integer := 0;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number;
  if not found or v_order.status <> 'completed' or v_order.subscription_id is null then
    return 0;
  end if;

  -- 1. This payment was invited.
  if v_order.kind = 'checkout' and v_order.invite_code is not null
     and not exists (select 1 from public.daily_orders o
                      where o.customer_id = v_order.customer_id and o.status = 'completed'
                        and o.order_number <> v_order.order_number
                        and o.completed_at < v_order.completed_at) then
    select * into v_inviter from public.daily_customers
     where invite_code = v_order.invite_code and deleted_at is null and id <> v_order.customer_id;
    if found then
      insert into public.daily_invites (invitee_customer_id, inviter_customer_id, order_number, invitee_rewarded_at)
      values (v_order.customer_id, v_inviter.id, v_order.order_number, now())
      on conflict (invitee_customer_id) do nothing;
      if found then
        update public.daily_subscriptions set paid_until = paid_until + interval '15 days'
         where id = v_order.subscription_id and paid_until is not null;
        v_applied := v_applied + 1;
        -- The inviter's reward goes on their live paid period, the one ending last.
        select * into v_sub from public.daily_subscriptions
         where customer_id = v_inviter.id and status = 'active' and paid_until > now()
         order by paid_until desc limit 1 for update;
        if found then
          update public.daily_subscriptions set paid_until = paid_until + interval '15 days' where id = v_sub.id;
          update public.daily_invites set inviter_rewarded_at = now() where invitee_customer_id = v_order.customer_id;
        end if;
      end if;
    end if;
  end if;

  -- 2. Rewards this payer earned as an inviter while not subscribed.
  with pending as (
    update public.daily_invites set inviter_rewarded_at = now()
     where inviter_customer_id = v_order.customer_id and inviter_rewarded_at is null
       and invitee_customer_id <> v_order.customer_id
    returning 1
  )
  select count(*) into v_pending from pending;
  if v_pending > 0 then
    update public.daily_subscriptions set paid_until = paid_until + make_interval(days => 15 * v_pending)
     where id = v_order.subscription_id and paid_until is not null;
    v_applied := v_applied + v_pending;
  end if;

  -- 3. The review reward this payer earned while not subscribed (daily_grant_review_reward).
  update public.daily_reviews set reward_applied_at = now()
   where customer_id = v_order.customer_id and reward_earned_at is not null and reward_applied_at is null;
  if found then
    update public.daily_subscriptions set paid_until = paid_until + interval '15 days'
     where id = v_order.subscription_id and paid_until is not null;
    v_applied := v_applied + 1;
  end if;
  return v_applied;
end;
$$;

revoke execute on function public.daily_apply_invite(text) from public, anon, authenticated;
grant execute on function public.daily_apply_invite(text) to service_role;
