-- Account deletion removes authentication and all directly identifying profile data.
-- A tombstone uid remains only on historical operational rows (meetup attendance and
-- accounting) so totals and financial records keep their integrity without a route
-- back to a person.
alter table public.users
  add column if not exists deleted_at timestamptz;

create index if not exists users_deleted_at_idx
  on public.users (deleted_at)
  where deleted_at is not null;

-- The public member projection must never expose a tombstoned account.
create or replace view public.public_users as
  select
    uid,
    display_name,
    photo_url,
    account_status,
    has_active_subscription,
    created_at,
    subscription_start_date
  from public.users
  where not is_placeholder
    and deleted_at is null;

grant select on public.public_users to anon, authenticated;

-- Deleted accounts do not contribute to customer-facing membership totals, even
-- though their de-identified subscription history is retained for accounting.
create or replace function public.home_stats_counts()
returns table(total_meetups integer, total_members integer, total_articles integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    (select count(*) from public.meetups)::int,
    (
      select count(*)
      from public.users u
      where u.account_status is distinct from 'admin'
        and coalesce(u.is_placeholder, false) = false
        and u.deleted_at is null
        and (
          coalesce(u.has_active_subscription, false)
          or u.subscription_start_date is not null
          or u.subscription_end_date is not null
        )
    )::int,
    (select count(*) from public.articles)::int;
$function$;
