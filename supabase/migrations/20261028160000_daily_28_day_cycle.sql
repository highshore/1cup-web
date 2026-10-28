-- Daily periods move from 30 days to 28 (terms 제5조·제7조, version 2026-10-28.2):
-- 정기구독 28일, 1개월 이용권 28일, 3개월 84일, 6개월 168일. Prices do not change.
--
-- Each order now records the days it paid for (daily_orders.days), and everything that
-- grants or refunds a period reads the order, not the product. So:
--   * orders already placed keep the days they were sold with (backfilled below from
--     the products as they were: 30/90/180);
--   * a 정기구독 renewal for a subscriber whose agreed terms predate 2026-10-28.2 stays
--     at 30 days, since fewer days for the same price is a change against them that
--     needs their agreement. Their next checkout under the new terms moves them to 28;
--   * new checkouts and renewals under the new terms get the product's days.
-- The days are filled by a BEFORE INSERT trigger, so the edge function's order
-- inserts need no change.

-- ------------------------------------------------------------------ order days
alter table public.daily_orders add column days integer check (days > 0);

update public.daily_orders o
   set days = p.days
  from public.daily_products p
 where p.id = o.product and o.days is null;

alter table public.daily_orders alter column days set not null;

update public.daily_products set days = 28, name = '영어 한잔 Daily 28일 정기구독' where id = 'sub_30d';
update public.daily_products set days = 28 where id = 'pass_1m';
update public.daily_products set days = 84 where id = 'pass_3m';
update public.daily_products set days = 168 where id = 'pass_6m';

create or replace function private.daily_order_days()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.days is null then
    select p.days into new.days from public.daily_products p where p.id = new.product;
    if new.kind = 'renewal' and new.product = 'sub_30d'
       and coalesce(new.terms_version, '') < '2026-10-28.2' then
      new.days := 30;
    end if;
  end if;
  return new;
end;
$$;

create trigger daily_orders_days
  before insert on public.daily_orders
  for each row execute function private.daily_order_days();

-- ------------------------------------------------------------------ periods from the order
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
      plan, paid_until, auto_renew, billing_key, next_send_at,
      message_consent_at, marketing_consent_at, terms_version, terms_agreed_at, privacy_agreed_at
    ) values (
      v_customer.id, v_order.track, v_customer.phone, v_customer.name, v_order.delivery_time, 'active',
      v_product.id, v_now + make_interval(days => v_order.days), v_product.recurring,
      case when v_product.recurring then p_billing_key end,
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

create or replace function public.daily_finish_renewal(
  p_order_number   text,
  p_success        boolean,
  p_payment_result jsonb,
  p_error          text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.daily_orders;
  v_product public.daily_products;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number for update;
  if not found or v_order.status <> 'charging' or v_order.kind <> 'renewal' then
    return;
  end if;
  if p_success then
    select * into v_product from public.daily_products where id = v_order.product;
    update public.daily_subscriptions
       set paid_until = v_order.period_start + make_interval(days => v_order.days),
           renewal_failures = 0
     where id = v_order.subscription_id
       and paid_until = v_order.period_start;
    update public.daily_orders
       set status = 'completed', payment_result = p_payment_result, completed_at = now()
     where order_number = p_order_number;
  else
    update public.daily_subscriptions
       set renewal_failures = renewal_failures + 1,
           -- Three failed days in a row: stop trying; access ends at paid_until.
           auto_renew = renewal_failures + 1 < 3
     where id = v_order.subscription_id;
    update public.daily_orders
       set status = 'failed', payment_result = p_payment_result, error = left(p_error, 500), failed_at = now()
     where order_number = p_order_number;
  end if;
end;
$$;

-- Same return type as before; only where the days come from changes.
create or replace function public.daily_refund_quote(p_order_number text)
returns table (
  amount        integer,
  days_refunded integer,
  full_refund   boolean,
  basis         text,
  penalty       integer,
  used          integer,
  total         integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order     public.daily_orders;
  v_product   public.daily_products;
  v_new_terms boolean;
  v_window    boolean;
  v_start     timestamptz;
  v_end       timestamptz;
  v_days      integer;
  v_used      integer;
  v_total     integer;
  v_unused    integer;
  v_penalty   integer;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number;
  if not found or v_order.status <> 'completed' or v_order.completed_at is null then
    return query select 0, 0, false, 'none'::text, 0, 0, 0;
    return;
  end if;
  select * into v_product from public.daily_products where id = v_order.product;
  v_new_terms := coalesce(v_order.terms_version, '') >= '2026-10-28.1';
  v_window := now() - v_order.completed_at <= interval '168 hours';

  -- 정기구독, and passes sold under earlier terms: by days elapsed since the payment.
  if v_product.recurring or not v_new_terms then
    if v_window then
      return query select v_order.amount, v_order.days, true, 'window'::text, 0, 0, v_order.days;
      return;
    end if;
    v_days := least(ceil(extract(epoch from now() - v_order.completed_at) / 86400)::integer, v_order.days);
    v_unused := round(v_order.amount::numeric * (v_order.days - v_days) / v_order.days)::integer;
    v_penalty := case when v_new_terms then round(v_unused * 0.1)::integer else 0 end;
    return query select
      v_unused - v_penalty, v_order.days - v_days, false,
      (case when v_new_terms then 'penalty' else 'prorated' end)::text,
      v_penalty, v_days, v_order.days;
    return;
  end if;

  -- 이용권: by messages sent in the pass's own period.
  v_start := greatest(coalesce(v_order.period_start, v_order.completed_at), v_order.completed_at);
  v_end := v_start + make_interval(days => v_order.days);

  select count(*)::integer into v_used
    from public.daily_deliveries d
   where v_order.subscription_id is not null
     and d.subscription_id = v_order.subscription_id
     and d.kind in ('lesson', 'review')
     and d.status = 'sent'
     and d.sent_at >= v_start and d.sent_at < v_end;

  if v_used = 0 then
    return query select v_order.amount, v_order.days, true, 'not_started'::text, 0, 0, 0;
    return;
  end if;

  select count(*)::integer into v_total
    from generate_series(
           (v_start at time zone 'Asia/Seoul')::date,
           (v_end at time zone 'Asia/Seoul')::date,
           interval '1 day'
         ) as g(day)
   where extract(isodow from g.day) <> 7
     and ((g.day::date + v_order.delivery_time) at time zone 'Asia/Seoul') >= v_start
     and ((g.day::date + v_order.delivery_time) at time zone 'Asia/Seoul') < v_end;
  -- A delivery-time change can move a send outside the counted slots; never let the
  -- sent messages exceed the scheduled ones (or divide by zero).
  v_total := greatest(v_total, v_used);

  v_unused := round(v_order.amount::numeric * (v_total - v_used) / v_total)::integer;
  v_penalty := case when v_window then 0 else round(v_unused * 0.1)::integer end;
  -- Days of access the refund takes back: whatever of the period has not yet passed.
  v_days := greatest(v_order.days - ceil(extract(epoch from greatest(now() - v_start, interval '0')) / 86400)::integer, 0);

  return query select
    v_unused - v_penalty, v_days, false,
    (case when v_window then 'cooling_off' else 'penalty' end)::text,
    v_penalty, v_used, v_total;
end;
$$;
