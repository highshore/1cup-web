-- Pass refunds without the 7-day full-refund window (terms 제7조, version 2026-10-28.1).
--
-- 정기구독 payments keep the old rule: the full amount within 7 days (168 hours) of the
-- payment, then the unused days. 이용권 (one-time passes) bought under 2026-10-28.1 or
-- later have no such window:
--   * Before the pass's own days have begun, or before any lesson has been sent since
--     they began, nothing has been provided yet, so the whole amount comes back. This is
--     the part of 청약철회 the law keeps for a divisible service that has not started
--     (전자상거래법 제17조 제2항 제5호 단서) and it cannot be taken away.
--   * Once lessons have started, the unused days come back, counted from the start of the
--     pass's own days, elapsed time rounded up to whole 24-hour days.
-- Passes bought under earlier terms keep the 7-day window they were sold with.
--
-- A pass bought while time is already paid for starts after that time, so a checkout now
-- records where its days begin (daily_orders.period_start, until now only for renewals).
-- Older checkouts have none and fall back to completed_at.
--
-- daily_refund_quote also says why it priced a refund (basis), so the account page can
-- explain it: 'window' (within 7 days), 'not_started', or 'prorated'.

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
returns table (amount integer, days_refunded integer, full_refund boolean, basis text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order   public.daily_orders;
  v_product public.daily_products;
  v_start   timestamptz;
  v_elapsed interval;
  v_days    integer;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number;
  if not found or v_order.status <> 'completed' or v_order.completed_at is null then
    return query select 0, 0, false, 'none'::text;
    return;
  end if;
  select * into v_product from public.daily_products where id = v_order.product;

  if v_product.recurring or coalesce(v_order.terms_version, '') < '2026-10-28.1' then
    -- 정기구독, and passes sold under the earlier terms: the 7-day window, then the
    -- unused days counted from the payment.
    v_elapsed := greatest(now() - v_order.completed_at, interval '0');
    if v_elapsed <= interval '168 hours' then
      return query select v_order.amount, v_product.days, true, 'window'::text;
      return;
    end if;
  else
    -- 이용권: full only while nothing has been provided.
    v_start := greatest(coalesce(v_order.period_start, v_order.completed_at), v_order.completed_at);
    if now() < v_start
       or v_order.subscription_id is null
       or not exists (
         select 1 from public.daily_deliveries d
          where d.subscription_id = v_order.subscription_id
            and d.kind = 'lesson'
            and d.status = 'sent'
            and d.sent_at >= v_start
       ) then
      return query select v_order.amount, v_product.days, true, 'not_started'::text;
      return;
    end if;
    v_elapsed := greatest(now() - v_start, interval '0');
  end if;

  v_days := ceil(extract(epoch from v_elapsed) / 86400)::integer;
  return query select
    round(v_order.amount::numeric * greatest(v_product.days - v_days, 0) / v_product.days)::integer,
    greatest(v_product.days - v_days, 0),
    false,
    'prorated'::text;
end;
$$;

revoke execute on function public.daily_refund_quote(text) from public, anon, authenticated;
grant execute on function public.daily_refund_quote(text) to service_role;
