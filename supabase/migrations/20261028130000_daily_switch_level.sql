-- 레벨 바꾸기: a paid subscription moves to the other level in place. Everything else
-- (paid period, auto-renew, card, delivery time, next slot) stays, so the next lesson
-- simply comes from the new level's calendar. Renewals are claimed with the
-- subscription's track at the time, so the next charge is for the new level too.
--
-- Returns 'switched', or why not: 'invalid', 'not-active' (no paid period running on
-- the level), 'already-live' (the customer already gets the other level, trial
-- included) or 'refund-open' (a refund on this subscription is still being handled).
create or replace function public.daily_switch_track(
  p_customer_id uuid,
  p_from        text,
  p_to          text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.daily_subscriptions;
begin
  if p_from is null or p_to is null or p_from = p_to or p_to not in ('basic', 'advanced') then
    return 'invalid';
  end if;
  select * into v_sub from public.daily_subscriptions
   where customer_id = p_customer_id and track = p_from and status = 'active'
   for update;
  if not found or v_sub.paid_until is null or v_sub.paid_until <= now() then
    return 'not-active';
  end if;
  if exists (
    select 1 from public.daily_subscriptions
     where customer_id = p_customer_id and track = p_to and status in ('trial', 'active')
  ) then
    return 'already-live';
  end if;
  if exists (
    select 1 from public.daily_refunds r
      join public.daily_orders o on o.order_number = r.order_number
     where o.subscription_id = v_sub.id and r.status in ('requested', 'refunding')
  ) then
    return 'refund-open';
  end if;
  update public.daily_subscriptions set track = p_to where id = v_sub.id;
  return 'switched';
end;
$$;

revoke execute on function public.daily_switch_track(uuid, text, text) from public, anon, authenticated;
grant execute on function public.daily_switch_track(uuid, text, text) to service_role;
