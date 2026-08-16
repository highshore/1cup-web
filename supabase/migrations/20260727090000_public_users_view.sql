-- Public-safe projection of users for browser reads (leaderboard, etc.).
-- RLS on public.users restricts the browser to its own row, which is correct for
-- protecting phone/email/billing — but the leaderboard needs every member's name,
-- avatar, badges and join date. This view exposes ONLY public-safe columns and is
-- granted to anon/authenticated. It runs with the view owner's rights (not
-- security_invoker), so it bypasses the underlying users RLS for these columns only.
create or replace view public.public_users as
  select
    uid,
    display_name,
    photo_url,
    account_status,
    has_active_subscription,
    created_at,
    subscription_start_date
  from public.users;

grant select on public.public_users to anon, authenticated;
