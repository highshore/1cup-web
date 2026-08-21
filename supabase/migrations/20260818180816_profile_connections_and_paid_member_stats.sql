-- Mutual member connections are intentionally private. A one-sided like is visible
-- only to the person who made it and never becomes a public follower list.

create table if not exists public.profile_likes (
  liker_id text not null references public.users(uid) on delete cascade,
  liked_id text not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  constraint profile_likes_not_self check (liker_id <> liked_id)
);

create index if not exists profile_likes_liked_id_idx
  on public.profile_likes (liked_id, liker_id);

alter table public.profile_likes enable row level security;
revoke all on table public.profile_likes from anon, authenticated;

-- Return only the caller's relationship to one member. This keeps incoming and
-- outgoing one-sided likes private from every other user.
create or replace function public.profile_like_state(p_profile_user_id text)
returns table (liked_by_me boolean, likes_me boolean, mutual boolean)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id text;
  v_liked_by_me boolean;
  v_likes_me boolean;
begin
  if (select auth.uid()) is null then
    return query select false, false, false;
    return;
  end if;

  v_user_id := public.current_uid();
  if v_user_id is null or p_profile_user_id is null or btrim(p_profile_user_id) = '' then
    return query select false, false, false;
    return;
  end if;

  select exists (
    select 1 from public.profile_likes
    where liker_id = v_user_id and liked_id = p_profile_user_id
  ) into v_liked_by_me;

  select exists (
    select 1 from public.profile_likes
    where liker_id = p_profile_user_id and liked_id = v_user_id
  ) into v_likes_me;

  return query select v_liked_by_me, v_likes_me, v_liked_by_me and v_likes_me;
end;
$function$;

-- Toggle the caller's own like atomically. Blocks are respected in both
-- directions so a blocked member cannot infer a profile relationship.
create or replace function public.toggle_profile_like(p_profile_user_id text)
returns table (liked_by_me boolean, likes_me boolean, mutual boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id text;
  v_liked_by_me boolean;
  v_likes_me boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_user_id := public.current_uid();
  if v_user_id is null then
    raise exception 'Member profile not found' using errcode = '28000';
  end if;

  if p_profile_user_id is null or btrim(p_profile_user_id) = '' or p_profile_user_id = v_user_id then
    raise exception 'A different member is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.users u
    where u.uid = p_profile_user_id and coalesce(u.is_placeholder, false) = false
  ) then
    raise exception 'Member not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_user_id and b.blocked_user_id = p_profile_user_id)
       or (b.blocker_id = p_profile_user_id and b.blocked_user_id = v_user_id)
  ) then
    raise exception 'This connection is unavailable' using errcode = 'P0001';
  end if;

  delete from public.profile_likes
  where liker_id = v_user_id and liked_id = p_profile_user_id
  returning true into v_liked_by_me;

  if not found then
    insert into public.profile_likes (liker_id, liked_id)
    values (v_user_id, p_profile_user_id);
    v_liked_by_me := true;
  else
    v_liked_by_me := false;
  end if;

  select exists (
    select 1 from public.profile_likes
    where liker_id = p_profile_user_id and liked_id = v_user_id
  ) into v_likes_me;

  return query select v_liked_by_me, v_likes_me, v_liked_by_me and v_likes_me;
end;
$function$;

-- The only list endpoint: it includes people where both likes exist and omits
-- blocked relationships. It exposes just the public identity needed for cards.
create or replace function public.mutual_profile_friends()
returns table (
  uid text,
  display_name text,
  photo_url text,
  connected_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_user_id := public.current_uid();
  if v_user_id is null then
    raise exception 'Member profile not found' using errcode = '28000';
  end if;

  return query
  select
    u.uid,
    coalesce(u.display_name, 'Member ' || left(u.uid, 6)),
    u.photo_url,
    greatest(mine.created_at, theirs.created_at)
  from public.profile_likes mine
  join public.profile_likes theirs
    on theirs.liker_id = mine.liked_id
   and theirs.liked_id = mine.liker_id
  join public.users u on u.uid = mine.liked_id
  where mine.liker_id = v_user_id
    and coalesce(u.is_placeholder, false) = false
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = v_user_id and b.blocked_user_id = u.uid)
         or (b.blocker_id = u.uid and b.blocked_user_id = v_user_id)
    )
  order by greatest(mine.created_at, theirs.created_at) desc, u.uid;
end;
$function$;

revoke all on function public.profile_like_state(text) from public;
revoke all on function public.toggle_profile_like(text) from public;
revoke all on function public.mutual_profile_friends() from public;
grant execute on function public.profile_like_state(text) to authenticated;
grant execute on function public.toggle_profile_like(text) to authenticated;
grant execute on function public.mutual_profile_friends() to authenticated;

-- "Cumulative paid members" follows the same subscription-history definition as
-- the admin dashboard, rather than every account that has ever been created.
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
