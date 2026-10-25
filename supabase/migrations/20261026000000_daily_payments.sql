-- 영어 한잔 Daily payments (Payple), in Daily's own tables.
--
-- Same Payple flow as the 1cup membership checkout: the browser opens Payple in CERT
-- mode, which only registers the card and returns a billing key; the server then charges
-- that key for the amount stored here. Nothing the browser sends decides the amount.
--
-- Idempotency, in one place each:
--   * An order is claimed once: daily_claim_order moves pending_auth → charging under a
--     row lock and hands out the charge order number. A second verify call for the same
--     order sees charging/completed and never charges again.
--   * An order is settled once: daily_complete_order locks the order, and if it is
--     already completed returns the subscription it already produced.
--   * A renewal is charged once per period: daily_claim_renewal inserts the renewal
--     order keyed by (subscription, period_start); the partial unique index means two
--     concurrent billing runs cannot both create a live order for the same period, and a
--     failed attempt does not block tomorrow's retry.

-- ------------------------------------------------------------------ products
-- Prices live here (and in app/lib/features/daily/constants.ts for display); the server
-- charges the amount copied onto the order from this table.
create table public.daily_products (
  id        text primary key check (id in ('sub_30d', 'pass_1m', 'pass_3m', 'pass_6m')),
  name      text not null,
  amount    integer not null check (amount > 0),
  days      integer not null check (days > 0),
  recurring boolean not null,
  active    boolean not null default true
);

insert into public.daily_products (id, name, amount, days, recurring) values
  ('sub_30d', '영어 한잔 Daily 30일 정기구독', 3700, 30, true),
  ('pass_1m', '영어 한잔 Daily 1개월 이용권', 4500, 30, false),
  ('pass_3m', '영어 한잔 Daily 3개월 이용권', 13500, 90, false),
  ('pass_6m', '영어 한잔 Daily 6개월 이용권', 27000, 180, false)
on conflict (id) do nothing;

-- ------------------------------------------------------------------ subscriptions
alter table public.daily_subscriptions
  add column plan             text references public.daily_products (id),
  -- Paid access ends here; deliveries stop after it unless a renewal extends it.
  add column paid_until       timestamptz,
  -- Payple billing key (PCD_PAYER_ID) for renewals. Only for the recurring plan.
  add column billing_key      text,
  add column auto_renew       boolean not null default false,
  add column renewal_failures integer not null default 0;

create index daily_subscriptions_renewal_due
  on public.daily_subscriptions (paid_until)
  where status = 'active' and auto_renew;

-- ------------------------------------------------------------------ orders
create table public.daily_orders (
  -- Payple PCD_PAY_OID for the card registration (≤ 30 chars).
  order_number        text primary key check (length(order_number) <= 30),
  -- Payple PCD_PAY_OID for the actual charge, issued at claim time.
  charge_order_number text unique check (length(charge_order_number) <= 30),
  kind                text not null check (kind in ('checkout', 'renewal')),
  customer_id         uuid not null references public.daily_customers (id) on delete restrict,
  subscription_id     uuid references public.daily_subscriptions (id) on delete set null,
  product             text not null references public.daily_products (id),
  amount              integer not null check (amount > 0),
  track               text not null check (track in ('business', 'tech')),
  delivery_time       time not null,
  -- For renewals: the paid_until the renewal extends from.
  period_start        timestamptz,
  status              text not null default 'pending_auth'
                        check (status in ('pending_auth', 'charging', 'completed', 'failed')),
  billing_key         text,
  payment_result      jsonb,
  error               text,
  terms_version       text,
  marketing_consent   boolean not null default false,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,
  failed_at           timestamptz
);

create index daily_orders_customer on public.daily_orders (customer_id, created_at desc);

-- One live (not failed) renewal per subscription per period.
create unique index daily_orders_one_renewal_per_period
  on public.daily_orders (subscription_id, period_start)
  where kind = 'renewal' and status <> 'failed';

alter table public.daily_products enable row level security;
alter table public.daily_orders   enable row level security;

-- Payment records are kept for 5 years (e-commerce act), so retention must not cascade
-- an old subscription's deletion into its orders: subscription_id is set null instead,
-- and customers with orders are never deleted by retention.
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
     and not exists (select 1 from public.daily_subscriptions s where s.customer_id = c.id)
     and not exists (select 1 from public.daily_orders o where o.customer_id = c.id);
$$;

-- ------------------------------------------------------------------ claim / settle
-- pending_auth → charging, once. Returns the state and the charge order number.
create or replace function public.daily_claim_order(p_order_number text, p_customer_id uuid)
returns table (state text, charge_order_number text, payment_result jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.daily_orders;
begin
  select * into v_order from public.daily_orders
   where order_number = p_order_number and customer_id = p_customer_id
   for update;
  if not found then
    return query select 'missing'::text, null::text, null::jsonb;
    return;
  end if;
  if v_order.status = 'completed' then
    return query select 'completed'::text, v_order.charge_order_number, v_order.payment_result;
    return;
  end if;
  if v_order.status = 'charging' then
    return query select 'charging'::text, v_order.charge_order_number, v_order.payment_result;
    return;
  end if;
  if v_order.status <> 'pending_auth' then
    return query select v_order.status, v_order.charge_order_number, v_order.payment_result;
    return;
  end if;

  update public.daily_orders
     set status = 'charging',
         charge_order_number = left(order_number, 28) || 'C'
   where order_number = p_order_number
  returning * into v_order;
  return query select 'claimed'::text, v_order.charge_order_number, null::jsonb;
end;
$$;

-- charging → completed, once, granting the paid period. Returns the subscription id.
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
         error = null
   where order_number = p_order_number;

  return v_sub.id;
end;
$$;

-- ------------------------------------------------------------------ renewals
-- Creates the renewal order for the subscription's current period, or returns null when
-- one already exists (another run got there first, or it already succeeded).
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
    p_order_number, p_order_number, 'renewal', v_sub.customer_id, v_sub.id, v_product.id, v_product.amount,
    v_sub.track, v_sub.delivery_time, v_sub.paid_until, 'charging', v_sub.billing_key, v_sub.terms_version
  )
  on conflict do nothing
  returning order_number into v_created;
  return v_created;
end;
$$;

-- Records a renewal charge outcome. Success extends paid_until by the plan's days from
-- the period it was claimed for; failure counts toward stopping auto-renew.
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
       set paid_until = v_order.period_start + make_interval(days => v_product.days),
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

revoke execute on function public.daily_claim_order(text, uuid) from public, anon, authenticated;
revoke execute on function public.daily_complete_order(text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.daily_claim_renewal(uuid, text) from public, anon, authenticated;
revoke execute on function public.daily_finish_renewal(text, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.daily_claim_order(text, uuid) to service_role;
grant execute on function public.daily_complete_order(text, jsonb, text) to service_role;
grant execute on function public.daily_claim_renewal(uuid, text) to service_role;
grant execute on function public.daily_finish_renewal(text, boolean, jsonb, text) to service_role;

-- ------------------------------------------------------------------ switches and schedule
alter table public.daily_config
  add column payments_open boolean not null default false;

-- 09:10 KST: charge renewals whose paid period ends within the next day. Runs ten
-- minutes after the 1cup membership billing so the two never overlap on Payple.
do $block$
begin
  if exists (select 1 from cron.job where jobname = 'daily-billing') then
    perform cron.unschedule('daily-billing');
  end if;
  perform cron.schedule(
    'daily-billing',
    '10 0 * * *',
    $cron$
      select net.http_post(
        url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/daily',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-daily-scheduler-secret', public.daily_scheduler_secret()
        ),
        body := jsonb_build_object('action', 'billing')
      );
    $cron$
  );
end;
$block$;

insert into public.scheduler_heartbeats (job_name, expected_interval, expected_daily_at, last_success_at)
values ('daily.billing', interval '26 hours', time '09:25', now())
on conflict (job_name) do nothing;
