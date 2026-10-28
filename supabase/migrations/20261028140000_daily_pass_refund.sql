-- Refund rules for terms 제7조, version 2026-10-28.1.
--
-- 정기구독 (each payment, recurring or renewal):
--   * within 7 days (168 hours) of the payment: the full amount;
--   * after that: the unused days (elapsed time rounded up to whole 24-hour days),
--     less 10% of that unused amount as the 위약금.
-- 이용권 (one-time passes), measured by the lesson messages actually sent:
--   * before any message of the pass has been sent: the full amount. This is the part
--     of 청약철회 the law keeps for a divisible service that has not started
--     (전자상거래법 제17조 제2항 제5호 단서) and no term can take it away;
--   * after that: amount × unsent messages ÷ messages scheduled in the pass's period.
--     A message slot is each Mon–Sat date whose send time falls inside the period
--     (Sunday sends nothing); a sent lesson or Saturday review uses one;
--   * within 7 days of the payment that is a 청약철회, which cannot carry a 위약금
--     (제18조 제9항); after 7 days, 10% of the refund is kept as the 위약금.
-- The 10% is of the unused amount, the lower of the 소비자분쟁해결기준 readings, and
-- stays under the cap 방문판매법 제32조 puts on 계속거래 (all plans are ≥ 1 month).
--
-- Payments made under earlier terms keep the rules they were sold with: the 7-day
-- full refund, then the unused days with no 위약금. A renewal carries the terms its
-- subscriber last agreed to, so existing subscribers move to these rules only when
-- they agree to the new terms.
--
-- A pass bought while time is already paid for starts after that time, so a checkout
-- now records where its days begin (daily_orders.period_start, until now only for
-- renewals). Older checkouts have none and fall back to completed_at.
--
-- daily_refund_quote also returns how it priced the refund for the account page:
--   basis   'window' | 'not_started' | 'cooling_off' | 'penalty' | 'prorated'
--   penalty the 위약금 kept, in won
--   used, total  messages sent / scheduled for a pass; days elapsed / days otherwise

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
           paid_until       = v_from + make_interval(days => v_product.days),
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
      v_product.id, v_now + make_interval(days => v_product.days), v_product.recurring,
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

-- ------------------------------------------------------------------ quote
-- The return type changes, so the function is replaced rather than redefined.
drop function public.daily_refund_quote(text);

create function public.daily_refund_quote(p_order_number text)
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
      return query select v_order.amount, v_product.days, true, 'window'::text, 0, 0, v_product.days;
      return;
    end if;
    v_days := least(ceil(extract(epoch from now() - v_order.completed_at) / 86400)::integer, v_product.days);
    v_unused := round(v_order.amount::numeric * (v_product.days - v_days) / v_product.days)::integer;
    v_penalty := case when v_new_terms then round(v_unused * 0.1)::integer else 0 end;
    return query select
      v_unused - v_penalty, v_product.days - v_days, false,
      (case when v_new_terms then 'penalty' else 'prorated' end)::text,
      v_penalty, v_days, v_product.days;
    return;
  end if;

  -- 이용권: by messages sent in the pass's own period.
  v_start := greatest(coalesce(v_order.period_start, v_order.completed_at), v_order.completed_at);
  v_end := v_start + make_interval(days => v_product.days);

  select count(*)::integer into v_used
    from public.daily_deliveries d
   where v_order.subscription_id is not null
     and d.subscription_id = v_order.subscription_id
     and d.kind in ('lesson', 'review')
     and d.status = 'sent'
     and d.sent_at >= v_start and d.sent_at < v_end;

  if v_used = 0 then
    return query select v_order.amount, v_product.days, true, 'not_started'::text, 0, 0, 0;
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
  v_used := least(v_used, v_total);

  v_unused := round(v_order.amount::numeric * (v_total - v_used) / v_total)::integer;
  v_penalty := case when v_window then 0 else round(v_unused * 0.1)::integer end;
  -- Days of access the refund takes back: whatever of the period has not yet passed.
  v_days := greatest(v_product.days - ceil(extract(epoch from greatest(now() - v_start, interval '0')) / 86400)::integer, 0);

  return query select
    v_unused - v_penalty, v_days, false,
    (case when v_window then 'cooling_off' else 'penalty' end)::text,
    v_penalty, v_used, v_total;
end;
$$;

revoke execute on function public.daily_refund_quote(text) from public, anon, authenticated;
grant execute on function public.daily_refund_quote(text) to service_role;
