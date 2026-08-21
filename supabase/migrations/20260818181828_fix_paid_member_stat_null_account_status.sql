-- Match the dashboard's JavaScript check (`account_status !== 'admin'`). In SQL,
-- `<> 'admin'` excludes NULL account_status values, even for genuine members.

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
        and (
          coalesce(u.has_active_subscription, false)
          or u.subscription_start_date is not null
          or u.subscription_end_date is not null
        )
    )::int,
    (select count(*) from public.articles)::int;
$function$;
