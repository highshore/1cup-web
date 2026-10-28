-- A refund ends the access it paid for, now.
--
-- daily_finish_refund moved paid_until back by the quote's days_refunded, which counts
-- the order's remaining days rounded down to whole days. The rest of the day the refund
-- happened on stayed paid, so a fully refunded pass still read as 받는 중 until that
-- point, and the start page refused a free trial with "이미 이 레벨을 받고 있어요".
--
-- It now takes back exactly the part of the order's period that has not passed: all of
-- it for an order whose period has not started, the remainder for the current one
-- (paid_until lands on now(), which ends the subscription), nothing for one that is over.
-- The amount refunded is unchanged; daily_refund_quote still decides it.
--
-- Otherwise the live definition (20261026020000_daily_account).

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
  v_start  timestamptz;
  v_end    timestamptz;
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
  -- The order's period, as daily_refund_quote counts it.
  v_start := greatest(coalesce(v_order.period_start, v_order.completed_at), v_order.completed_at);
  v_end := v_start + make_interval(days => v_order.days);
  v_until := greatest(v_sub.paid_until - greatest(v_end - greatest(now(), v_start), interval '0'), now());
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

revoke execute on function public.daily_finish_refund(uuid, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.daily_finish_refund(uuid, boolean, jsonb, text) to service_role;

-- Refunds already made under the old rule: a subscription still active on less than a
-- day left over from its last order's refund ends at the time of that refund.
update public.daily_subscriptions s
   set paid_until = r.refunded_at, auto_renew = false, status = 'cancelled',
       cancelled_at = coalesce(s.cancelled_at, r.refunded_at), next_send_at = null
  from public.daily_refunds r
  join public.daily_orders o on o.order_number = r.order_number
 where o.subscription_id = s.id
   and r.status = 'refunded'
   and s.status = 'active'
   and s.paid_until <= r.refunded_at + interval '1 day'
   and not exists (select 1 from public.daily_orders later
                    where later.subscription_id = s.id and later.status = 'completed'
                      and later.completed_at > o.completed_at);
