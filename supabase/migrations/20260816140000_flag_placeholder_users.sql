-- Keep import placeholders out of member-facing counts.
--
-- The Firestore import found references to users that had no document — payment orders
-- whose userId was a bare number, meetup participant lists containing "ghost" — and
-- created stub rows so the foreign keys would hold. They are not people: no name, no
-- phone, no kakao id, all stamped with the import date. They still inflate the home page
-- member count (135 instead of 130) and show up blank in public_users, which the
-- leaderboard reads.
--
-- They cannot simply be deleted: four of them are still referenced by real payment_orders
-- and meetup_participants rows, and dropping those references would corrupt genuine
-- records. Flag them instead and filter the member-facing surfaces.
--
-- NOTE: "has no auth account" is NOT the test for a placeholder. Seven real members
-- (김우진, 김민영, 선민, Carol, 조랭이, Tony Ryu, 최진수) also lack one simply because they
-- signed up in Firebase after the auth seeding; they get one on their first login.

alter table public.users
  add column if not exists is_placeholder boolean not null default false;

comment on column public.users.is_placeholder is
  'True for rows the Firestore import created only to satisfy a foreign key. Excluded '
  'from member counts and public listings; never shown as a member.';

update public.users
   set is_placeholder = true
 where uid in ('5401', '83', '415442', 'ghost', 'anonymous');

-- Home page counters: count people, not placeholders.
create or replace function public.home_stats_counts()
 returns table(total_meetups integer, total_members integer, total_articles integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select (select count(*) from public.meetups)::int,
         (select count(*) from public.users where not is_placeholder)::int,
         (select count(*) from public.articles)::int;
$function$;

-- Public projection used by the leaderboard.
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
  where not is_placeholder;

grant select on public.public_users to anon, authenticated;
