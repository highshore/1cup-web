-- 친구 초대 rewards once per phone number (terms 제5조의2), also across account deletion.
--
-- daily_invites holds one reward per invited customer, but deleting the account deleted
-- that row, so the same number could sign up again and be invited again for another
-- reward on both sides. The number now leaves a mark that outlives the account: a
-- SHA-256 hash of it (not the number), kept for 1 year from the reward like the
-- free-trial record, which the privacy notice now says.
--
-- daily_apply_invite is the live definition (20261028230000_daily_reward_14_days) with
-- one change: the invited payer's number must not have had an invite reward already.

create table public.daily_invite_phones (
  phone_hash  text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  rewarded_at timestamptz not null default now()
);

alter table public.daily_invite_phones enable row level security;

create or replace function private.daily_phone_hash(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_phone, 'UTF8')), 'hex');
$$;

-- Rewards already given count too.
insert into public.daily_invite_phones (phone_hash, rewarded_at)
select private.daily_phone_hash(c.phone), coalesce(i.invitee_rewarded_at, i.created_at)
  from public.daily_invites i
  join public.daily_customers c on c.id = i.invitee_customer_id
 where c.phone is not null
on conflict do nothing;

create or replace function public.daily_apply_invite(p_order_number text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.daily_orders;
  v_inviter public.daily_customers;
  v_payer   public.daily_customers;
  v_sub     public.daily_subscriptions;
  v_pending integer;
  v_applied integer := 0;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number;
  if not found or v_order.status <> 'completed' or v_order.subscription_id is null then
    return 0;
  end if;
  select * into v_payer from public.daily_customers where id = v_order.customer_id;

  -- 1. This payment was invited, and this number has never had an invite reward.
  if v_order.kind = 'checkout' and v_order.invite_code is not null and v_payer.phone is not null
     and not exists (select 1 from public.daily_orders o
                      where o.customer_id = v_order.customer_id and o.status = 'completed'
                        and o.order_number <> v_order.order_number
                        and o.completed_at < v_order.completed_at) then
    select * into v_inviter from public.daily_customers
     where invite_code = v_order.invite_code and deleted_at is null and id <> v_order.customer_id;
    if found then
      -- Claim the number first; a number already claimed (also by a deleted account) gets nothing.
      insert into public.daily_invite_phones (phone_hash)
      values (private.daily_phone_hash(v_payer.phone))
      on conflict do nothing;
      if found then
        insert into public.daily_invites (invitee_customer_id, inviter_customer_id, order_number, invitee_rewarded_at)
        values (v_order.customer_id, v_inviter.id, v_order.order_number, now())
        on conflict (invitee_customer_id) do nothing;
        if found then
          update public.daily_subscriptions set paid_until = paid_until + interval '14 days'
           where id = v_order.subscription_id and paid_until is not null;
          v_applied := v_applied + 1;
          -- The inviter's reward goes on their live paid period, the one ending last.
          select * into v_sub from public.daily_subscriptions
           where customer_id = v_inviter.id and status = 'active' and paid_until > now()
           order by paid_until desc limit 1 for update;
          if found then
            update public.daily_subscriptions set paid_until = paid_until + interval '14 days' where id = v_sub.id;
            update public.daily_invites set inviter_rewarded_at = now() where invitee_customer_id = v_order.customer_id;
          end if;
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
    update public.daily_subscriptions set paid_until = paid_until + make_interval(days => 14 * v_pending)
     where id = v_order.subscription_id and paid_until is not null;
    v_applied := v_applied + v_pending;
  end if;

  -- 3. The review reward this payer earned while not subscribed (daily_grant_review_reward).
  update public.daily_reviews set reward_applied_at = now()
   where customer_id = v_order.customer_id and reward_earned_at is not null and reward_applied_at is null;
  if found then
    update public.daily_subscriptions set paid_until = paid_until + interval '14 days'
     where id = v_order.subscription_id and paid_until is not null;
    v_applied := v_applied + 1;
  end if;
  return v_applied;
end;
$$;

-- Retention: the live definition plus the invite-number marks after 1 year.
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

  delete from public.daily_invite_phones
   where rewarded_at < now() - interval '1 year';

  delete from public.daily_customers c
   where coalesce(c.last_login_at, c.created_at) < now() - interval '1 year'
     and not exists (select 1 from public.daily_subscriptions s where s.customer_id = c.id)
     and not exists (select 1 from public.daily_orders o where o.customer_id = c.id);
$$;

revoke execute on function private.daily_phone_hash(text) from public, anon, authenticated;
