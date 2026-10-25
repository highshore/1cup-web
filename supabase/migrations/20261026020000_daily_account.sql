-- The Daily account page: settings a customer changes themselves, and refund requests
-- that the founder approves before any money moves.
--
-- Refund flow
--   1. The customer asks on /daily/account. daily_request_refund prices the request from
--      the terms (제7조) with daily_refund_quote, the one place that formula lives, and
--      turns off auto-renew so nothing is charged while the request waits.
--   2. The founder is notified (daily_config.admin_phones) and approves or rejects it on
--      /admin/daily-refunds.
--   3. Approval claims the request (requested/failed → refunding, once), the edge function
--      cancels that amount through Payple, and daily_finish_refund records the outcome.
--      A refunded order takes back the days it paid for from the subscription.
--
-- Additive only: one new table, one config column, functions.

-- ------------------------------------------------------------------ refunds
create table public.daily_refunds (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null references public.daily_orders (order_number) on delete restrict,
  customer_id     uuid not null references public.daily_customers (id) on delete restrict,
  -- Priced at request time, from the terms in force then.
  amount          integer not null check (amount > 0),
  -- The days this refund takes back from the subscription's paid period.
  days_refunded   integer not null check (days_refunded >= 0),
  full_refund     boolean not null,
  reason          text check (reason is null or length(reason) <= 500),
  status          text not null default 'requested'
                    check (status in ('requested', 'refunding', 'refunded', 'rejected', 'failed')),
  requested_at    timestamptz not null default now(),
  -- A 1cup staff admin's uid (public.users), kept as plain text like daily lesson authors.
  decided_by      text,
  decided_at      timestamptz,
  note            text check (note is null or length(note) <= 500),
  payment_result  jsonb,
  error           text,
  refunded_at     timestamptz
);

-- One open or finished refund per order. A rejected request does not block a new one.
create unique index daily_refunds_one_per_order
  on public.daily_refunds (order_number)
  where status <> 'rejected';

create index daily_refunds_status on public.daily_refunds (status, requested_at desc);
create index daily_refunds_customer on public.daily_refunds (customer_id, requested_at desc);

alter table public.daily_refunds enable row level security;

-- Who hears about new refund requests (KakaoTalk). Data, set with an UPDATE.
alter table public.daily_config
  add column admin_phones text[] not null default '{}';

-- ------------------------------------------------------------------ quote
-- 제7조: the full amount within 7 days (168 hours) of the payment completing; after that
-- amount × max(days − elapsed days, 0) ÷ days, with elapsed time rounded up to whole
-- 24-hour days. Rounded to the won like the 1cup membership refund.
create or replace function public.daily_refund_quote(p_order_number text)
returns table (amount integer, days_refunded integer, full_refund boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order   public.daily_orders;
  v_product public.daily_products;
  v_elapsed interval;
  v_days    integer;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number;
  if not found or v_order.status <> 'completed' or v_order.completed_at is null then
    return query select 0, 0, false;
    return;
  end if;
  select * into v_product from public.daily_products where id = v_order.product;
  v_elapsed := greatest(now() - v_order.completed_at, interval '0');
  if v_elapsed <= interval '168 hours' then
    return query select v_order.amount, v_product.days, true;
    return;
  end if;
  v_days := ceil(extract(epoch from v_elapsed) / 86400)::integer;
  return query select
    round(v_order.amount::numeric * greatest(v_product.days - v_days, 0) / v_product.days)::integer,
    greatest(v_product.days - v_days, 0),
    false;
end;
$$;

-- ------------------------------------------------------------------ request
create or replace function public.daily_request_refund(
  p_customer_id  uuid,
  p_order_number text,
  p_reason       text
)
returns public.daily_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.daily_orders;
  v_product public.daily_products;
  v_quote   record;
  v_refund  public.daily_refunds;
begin
  select * into v_order from public.daily_orders
   where order_number = p_order_number and customer_id = p_customer_id
   for update;
  if not found or v_order.status <> 'completed' then
    raise exception 'order-missing' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.daily_refunds r
              where r.order_number = p_order_number and r.status <> 'rejected') then
    raise exception 'already-requested' using errcode = 'P0001';
  end if;

  select * into v_quote from public.daily_refund_quote(p_order_number);
  if v_quote.amount <= 0 then
    raise exception 'nothing-to-refund' using errcode = 'P0001';
  end if;

  insert into public.daily_refunds (order_number, customer_id, amount, days_refunded, full_refund, reason)
  values (p_order_number, p_customer_id, v_quote.amount, v_quote.days_refunded, v_quote.full_refund,
          nullif(left(trim(coalesce(p_reason, '')), 500), ''))
  returning * into v_refund;

  -- Nothing is charged while the request waits: a refund of the subscription's payment
  -- also stops its renewal. The customer can turn it back on if the request is rejected.
  select * into v_product from public.daily_products where id = v_order.product;
  if v_product.recurring and v_order.subscription_id is not null then
    update public.daily_subscriptions
       set auto_renew = false, cancelled_at = coalesce(cancelled_at, now())
     where id = v_order.subscription_id;
  end if;

  return v_refund;
end;
$$;

-- ------------------------------------------------------------------ decide
-- requested (or failed, to retry) → refunding, once. Returns null when another approval
-- got there first or the request is no longer open.
create or replace function public.daily_claim_refund(p_refund_id uuid, p_admin text)
returns public.daily_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.daily_refunds;
begin
  update public.daily_refunds
     set status = 'refunding', decided_by = p_admin, decided_at = now(), error = null
   where id = p_refund_id and status in ('requested', 'failed')
  returning * into v_refund;
  return v_refund;
end;
$$;

-- refunding → refunded or failed. A refund takes its days back from the paid period;
-- when nothing paid is left, the subscription ends.
create or replace function public.daily_finish_refund(
  p_refund_id      uuid,
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
  v_refund public.daily_refunds;
  v_order  public.daily_orders;
  v_sub    public.daily_subscriptions;
  v_until  timestamptz;
begin
  select * into v_refund from public.daily_refunds where id = p_refund_id for update;
  if not found or v_refund.status <> 'refunding' then
    return;
  end if;
  if not p_success then
    update public.daily_refunds
       set status = 'failed', payment_result = p_payment_result, error = left(p_error, 500)
     where id = p_refund_id;
    return;
  end if;

  update public.daily_refunds
     set status = 'refunded', payment_result = p_payment_result, refunded_at = now(), error = null
   where id = p_refund_id;

  select * into v_order from public.daily_orders where order_number = v_refund.order_number;
  select * into v_sub from public.daily_subscriptions where id = v_order.subscription_id for update;
  if not found or v_sub.paid_until is null then
    return;
  end if;
  v_until := greatest(v_sub.paid_until - make_interval(days => v_refund.days_refunded), now());
  if v_until <= now() then
    update public.daily_subscriptions
       set paid_until = now(), auto_renew = false, status = 'cancelled',
           cancelled_at = coalesce(cancelled_at, now()), next_send_at = null
     where id = v_sub.id and status = 'active';
  else
    update public.daily_subscriptions set paid_until = v_until where id = v_sub.id;
  end if;
end;
$$;

create or replace function public.daily_reject_refund(p_refund_id uuid, p_admin text, p_note text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with rejected as (
    update public.daily_refunds
       set status = 'rejected', decided_by = p_admin, decided_at = now(),
           note = nullif(left(trim(coalesce(p_note, '')), 500), '')
     where id = p_refund_id and status = 'requested'
    returning 1
  )
  select exists (select 1 from rejected);
$$;

-- ------------------------------------------------------------------ settings
-- The customer's own settings. Time is per track; name and marketing consent are the
-- customer's and apply to every track. Moving the time reschedules the next slot.
create or replace function public.daily_update_settings(
  p_customer_id uuid,
  p_track       text,
  p_time        time,
  p_name        text,
  p_marketing   boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_time is not null then
    if p_time < time '06:00' or p_time > time '22:00' or extract(minute from p_time) not in (0, 30) then
      raise exception 'invalid-time' using errcode = 'P0001';
    end if;
    update public.daily_subscriptions s
       set delivery_time = p_time,
           -- A trial keeps its notice at least 12 hours after signup, as daily_start_trial set it.
           next_send_at = case
             when s.next_send_at is null then null
             when s.status = 'trial' then public.daily_next_send_at(
               p_time, greatest(now(), coalesce(s.trial_started_at, now()) + interval '12 hours'))
             else public.daily_next_send_at(p_time, now())
           end
     where s.customer_id = p_customer_id and s.track = p_track and s.status in ('trial', 'active');
  end if;
  if p_name is not null then
    update public.daily_customers set name = nullif(left(trim(p_name), 20), '') where id = p_customer_id;
    update public.daily_subscriptions set recipient_name = nullif(left(trim(p_name), 20), '')
     where customer_id = p_customer_id;
  end if;
  if p_marketing is not null then
    update public.daily_subscriptions
       set marketing_consent_at = case when p_marketing then coalesce(marketing_consent_at, now()) end
     where customer_id = p_customer_id;
  end if;
end;
$$;

revoke execute on function public.daily_refund_quote(text) from public, anon, authenticated;
revoke execute on function public.daily_request_refund(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.daily_claim_refund(uuid, text) from public, anon, authenticated;
revoke execute on function public.daily_finish_refund(uuid, boolean, jsonb, text) from public, anon, authenticated;
revoke execute on function public.daily_reject_refund(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.daily_update_settings(uuid, text, time, text, boolean) from public, anon, authenticated;
grant execute on function public.daily_refund_quote(text) to service_role;
grant execute on function public.daily_request_refund(uuid, text, text) to service_role;
grant execute on function public.daily_claim_refund(uuid, text) to service_role;
grant execute on function public.daily_finish_refund(uuid, boolean, jsonb, text) to service_role;
grant execute on function public.daily_reject_refund(uuid, text, text) to service_role;
grant execute on function public.daily_update_settings(uuid, text, time, text, boolean) to service_role;
