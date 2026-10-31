-- 영어 한잔 Daily "today's price" (terms 제5조, version 2026-10-31.1).
--
-- Every product has a regular price (daily_products.amount) and a today's price
-- (offer_amount), half of it. A customer pays the today's price only until their offer
-- deadline, and a 정기구독 bought at it renews at it for as long as it keeps renewing:
--
--               today's price    regular
--   sub_30d          3,700         7,400   (28일 정기구독)
--   pass_1m          4,500         9,000
--   pass_3m         12,300        24,600
--   pass_6m         23,400        46,800
--
-- The deadline (daily_customers.offer_expires_at):
--   * when the customer's first trial ends: midnight KST at the end of the day it ended
--     (the trigger below). A later trial on the other level does not move it;
--   * for someone who has had no trial: midnight KST at the end of the day they first
--     look at the price (daily_price_offer). If they start a trial later anyway, its end
--     sets the deadline again, as the first trial;
--   * for everyone already past their trial when this ships: 24 hours from now.
-- While a customer's first trial is still running, the today's price applies.
--
-- Renewals charge daily_subscriptions.renewal_amount, the amount the subscription was
-- bought at, not the product's current price. Existing subscribers are backfilled with
-- what they paid (₩3,700), so raising the regular price changes nothing for them
-- (terms 제5조 4항: a price change never applies to a running subscriber without notice).

-- ------------------------------------------------------------------ renewal price lock
alter table public.daily_subscriptions
  add column renewal_amount integer check (renewal_amount is null or renewal_amount > 0);

update public.daily_subscriptions s
   set renewal_amount = coalesce(
     (select o.amount from public.daily_orders o
       where o.subscription_id = s.id and o.product = 'sub_30d' and o.status = 'completed'
       order by o.completed_at desc
       limit 1),
     (select p.amount from public.daily_products p where p.id = 'sub_30d')
   )
 where s.plan = 'sub_30d' and s.renewal_amount is null;

-- ------------------------------------------------------------------ prices
alter table public.daily_products add column offer_amount integer;

update public.daily_products set amount = 7400,  offer_amount = 3700  where id = 'sub_30d';
update public.daily_products set amount = 9000,  offer_amount = 4500  where id = 'pass_1m';
update public.daily_products set amount = 24600, offer_amount = 12300 where id = 'pass_3m';
update public.daily_products set amount = 46800, offer_amount = 23400 where id = 'pass_6m';

alter table public.daily_products
  add constraint daily_products_offer_below_amount
  check (offer_amount is null or (offer_amount > 0 and offer_amount < amount));

-- ------------------------------------------------------------------ the deadline
alter table public.daily_customers add column offer_expires_at timestamptz;

-- Midnight KST at the end of the KST day `at` falls on.
create or replace function private.daily_kst_day_end(p_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (((p_at at time zone 'Asia/Seoul')::date + 1)::timestamp) at time zone 'Asia/Seoul';
$$;

-- The customer's first trial ending starts the clock; a second level's trial ending
-- later does not move it.
create or replace function private.daily_offer_on_trial_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.daily_customers c
     set offer_expires_at = private.daily_kst_day_end(coalesce(new.trial_ended_at, now()))
   where c.id = new.customer_id
     and (
       c.offer_expires_at is null
       or not exists (
         select 1 from public.daily_subscriptions s
          where s.customer_id = new.customer_id and s.id <> new.id and s.trial_ended_at is not null
       )
     );
  return new;
end;
$$;

create trigger daily_subscriptions_offer_on_trial_end
  after update of status on public.daily_subscriptions
  for each row
  when (old.status = 'trial' and new.status = 'trial_ended')
  execute function private.daily_offer_on_trial_end();

-- Everyone not in their first trial when this ships: 24 hours.
update public.daily_customers c
   set offer_expires_at = now() + interval '24 hours'
 where c.offer_expires_at is null
   and c.deleted_at is null
   and not (
     exists (select 1 from public.daily_subscriptions s where s.customer_id = c.id and s.status = 'trial')
     and not exists (select 1 from public.daily_subscriptions s where s.customer_id = c.id and s.trial_ended_at is not null)
   );

-- Whether the customer pays today's price right now, and until when.
--   (true,  null)  first trial still running: until midnight of the day it ends
--   (true,  t)     until t
--   (false, t)     the deadline t has passed
-- A customer with no deadline and no first trial running gets one here: midnight tonight,
-- unless their phone number already had a trial before today (an account deleted and
-- signed up again), whose window is over.
create or replace function public.daily_price_offer(p_customer_id uuid)
returns table (active boolean, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.daily_customers;
  v_deadline timestamptz;
begin
  select * into v_customer from public.daily_customers where id = p_customer_id;
  if not found then
    return query select false, null::timestamptz;
    return;
  end if;

  if exists (
       select 1 from public.daily_subscriptions s where s.customer_id = p_customer_id and s.status = 'trial'
     )
     and not exists (
       select 1 from public.daily_subscriptions s where s.customer_id = p_customer_id and s.trial_ended_at is not null
     ) then
    return query select true, null::timestamptz;
    return;
  end if;

  if v_customer.offer_expires_at is null then

    v_deadline := case
      when exists (
        select 1 from public.daily_trial_claims t
         where t.recipient_phone = v_customer.phone
           and t.claimed_at < private.daily_kst_day_end(now()) - interval '1 day'
      ) then now()
      else private.daily_kst_day_end(now())
    end;

    update public.daily_customers
       set offer_expires_at = v_deadline
     where id = p_customer_id and offer_expires_at is null
    returning offer_expires_at into v_deadline;
    if v_deadline is null then
      -- Another request set it first.
      select offer_expires_at into v_deadline from public.daily_customers where id = p_customer_id;
    end if;
    return query select now() < v_deadline, v_deadline;
    return;
  end if;

  return query select now() < v_customer.offer_expires_at, v_customer.offer_expires_at;
end;
$$;

revoke execute on function public.daily_price_offer(uuid) from public, anon, authenticated;
grant execute on function public.daily_price_offer(uuid) to service_role;

-- ------------------------------------------------------------------ checkout locks the renewal price
-- As in 20261028160000_daily_28_day_cycle, plus renewal_amount: a 정기구독 checkout sets
-- it to what was charged; a pass leaves it alone.
create or replace function public.daily_complete_order(
  p_order_number   text,
  p_payment_result jsonb,
  p_billing_key    text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    public.daily_orders;
  v_product  public.daily_products;
  v_customer public.daily_customers;
  v_sub      public.daily_subscriptions;
  v_now      timestamptz := now();
  v_from     timestamptz;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number for update;
  if not found then
    raise exception 'order-missing' using errcode = 'P0001';
  end if;
  if v_order.status = 'completed' then
    return v_order.subscription_id;
  end if;
  if v_order.status <> 'charging' or v_order.kind <> 'checkout' then
    raise exception 'order-not-charging' using errcode = 'P0001';
  end if;

  select * into v_product from public.daily_products where id = v_order.product;
  select * into v_customer from public.daily_customers where id = v_order.customer_id;

  -- The customer's subscription on this track: a live one first, else the latest.
  select * into v_sub from public.daily_subscriptions
   where customer_id = v_order.customer_id and track = v_order.track
   order by (status in ('trial', 'active')) desc, created_at desc
   limit 1
   for update;

  if found then
    -- Extend from the end of any time already paid for, never shorten it.
    v_from := greatest(coalesce(v_sub.paid_until, v_now), v_now);
    update public.daily_subscriptions s
       set status           = 'active',
           plan             = v_product.id,
           paid_until       = v_from + make_interval(days => v_order.days),
           auto_renew       = v_product.recurring,
           billing_key      = case when v_product.recurring then p_billing_key else s.billing_key end,
           renewal_amount   = case when v_product.recurring then v_order.amount else s.renewal_amount end,
           renewal_failures = 0,
           delivery_time    = v_order.delivery_time,
           recipient_phone  = v_customer.phone,
           next_send_at     = case
             when s.status = 'active' and s.next_send_at is not null then s.next_send_at
             else public.daily_next_send_at(v_order.delivery_time, v_now)
           end,
           terms_version    = coalesce(v_order.terms_version, s.terms_version),
           terms_agreed_at  = v_now,
           privacy_agreed_at = v_now,
           message_consent_at = v_now,
           marketing_consent_at = case when v_order.marketing_consent then v_now else s.marketing_consent_at end,
           cancelled_at     = null
     where s.id = v_sub.id
    returning * into v_sub;
  else
    v_from := v_now;
    insert into public.daily_subscriptions (
      customer_id, track, recipient_phone, recipient_name, delivery_time, status,
      plan, paid_until, auto_renew, billing_key, renewal_amount, next_send_at,
      message_consent_at, marketing_consent_at, terms_version, terms_agreed_at, privacy_agreed_at
    ) values (
      v_customer.id, v_order.track, v_customer.phone, v_customer.name, v_order.delivery_time, 'active',
      v_product.id, v_now + make_interval(days => v_order.days), v_product.recurring,
      case when v_product.recurring then p_billing_key end,
      case when v_product.recurring then v_order.amount end,
      public.daily_next_send_at(v_order.delivery_time, v_now),
      v_now, case when v_order.marketing_consent then v_now end, v_order.terms_version, v_now, v_now
    )
    returning * into v_sub;
  end if;

  update public.daily_orders
     set status = 'completed',
         subscription_id = v_sub.id,
         billing_key = p_billing_key,
         payment_result = p_payment_result,
         completed_at = v_now,
         -- Where this payment's own days begin: after any time already paid for.
         period_start = v_from,
         error = null
   where order_number = p_order_number;

  return v_sub.id;
end;
$$;

-- ------------------------------------------------------------------ renewals charge the locked price
-- As in 20261026000000_daily_payments, with the amount from the subscription. The
-- fallbacks only cover a row the backfill missed, and fall to the lower price.
create or replace function public.daily_claim_renewal(p_subscription_id uuid, p_order_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub     public.daily_subscriptions;
  v_product public.daily_products;
  v_created text;
begin
  select * into v_sub from public.daily_subscriptions where id = p_subscription_id for update;
  if not found or v_sub.status <> 'active' or not v_sub.auto_renew
     or v_sub.billing_key is null or v_sub.paid_until is null then
    return null;
  end if;
  select * into v_product from public.daily_products where id = coalesce(v_sub.plan, 'sub_30d');

  insert into public.daily_orders (
    order_number, charge_order_number, kind, customer_id, subscription_id, product, amount,
    track, delivery_time, period_start, status, billing_key, terms_version
  ) values (
    p_order_number, p_order_number, 'renewal', v_sub.customer_id, v_sub.id, v_product.id,
    coalesce(v_sub.renewal_amount, v_product.offer_amount, v_product.amount),
    v_sub.track, v_sub.delivery_time, v_sub.paid_until, 'charging', v_sub.billing_key, v_sub.terms_version
  )
  on conflict do nothing
  returning order_number into v_created;
  return v_created;
end;
$$;
