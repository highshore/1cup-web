-- First subscription-payment date per user, for the leaderboard's "Newest Members"
-- ordering. payment_orders is RLS-restricted to the caller's own rows, so the browser
-- can't compute this across users; this view exposes ONLY user_id + the earliest
-- subscription_initial_payment date (no amounts/status/PII).
create or replace view public.user_first_paid as
  select
    user_id,
    min(coalesce(completed_at, created_at, order_date)) as first_paid_at
  from public.payment_orders
  where type = 'subscription_initial_payment' and user_id is not null
  group by user_id;

grant select on public.user_first_paid to anon, authenticated;
