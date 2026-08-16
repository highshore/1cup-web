-- One person = one public.users row, however many ways they log in.
--
-- Problem
-- -------
-- The app offers phone-OTP login and Kakao OAuth. Each produces its own row in
-- auth.users unless GoTrue auto-links them, and GoTrue only auto-links an OAuth
-- identity to an existing account when that account's email is already CONFIRMED.
-- Right now 1 of 123 auth users has a confirmed email, so a Kakao login by an
-- existing phone user creates a SECOND auth user.
--
-- public.users.auth_id is a single uuid, so the old handle_new_user() repointed it at
-- whichever auth user logged in most recently. Everything that resolves a session —
-- current_uid(), is_admin(), and the app's `.eq("auth_id", user.id)` lookups — then
-- stopped matching the other login method: the user appeared signed in but had no
-- profile row and RLS denied their own data. And a Kakao-only user with no phone on
-- file (11 of them) got a brand-new duplicate users row on their first phone login.
--
-- Fix
-- ---
-- Keep the one-to-many relationship explicitly: user_auth_identities maps every
-- auth.users id to a single public.users row. Session resolution goes through it, so
-- both login methods land on the same profile. users.auth_id stays as the "primary"
-- id for backwards compatibility and is only filled when empty — never repointed.

-- ---------------------------------------------------------------- link table
create table if not exists public.user_auth_identities (
  auth_id    uuid primary key,
  uid        text not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists user_auth_identities_uid_idx
  on public.user_auth_identities (uid);

-- Backfill from the existing single-column link.
insert into public.user_auth_identities (auth_id, uid)
select auth_id, uid from public.users
 where auth_id is not null
on conflict (auth_id) do nothing;

-- Service-role only: every reader goes through the security-definer functions below.
alter table public.user_auth_identities enable row level security;

-- ------------------------------------------------------- session resolution
-- auth.uid() -> public.users.uid, via the link table, falling back to the legacy
-- users.auth_id column so nothing breaks if a row is missing from the table.
create or replace function public.current_uid()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (select l.uid from public.user_auth_identities l where l.auth_id = auth.uid()),
    (select u.uid from public.users u where u.auth_id = auth.uid())
  );
$function$;

create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((auth.jwt() ->> 'role') = 'admin', false)
      or exists (
        select 1 from public.users u
         where u.uid = public.current_uid()
           and u.account_status = 'admin');
$function$;

-- The app used to look up its profile with .eq("auth_id", session.user.id), which only
-- ever matches one of a person's auth users. This returns the caller's row through the
-- link table instead.
create or replace function public.current_user_row()
 returns setof public.users
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select * from public.users where uid = public.current_uid();
$function$;

grant execute on function public.current_user_row() to anon, authenticated, service_role;

-- Lets the phone-OTP route find the auth user that actually owns a number, instead of
-- assuming it is users.auth_id (auth.users is not reachable over PostgREST).
create or replace function public.auth_user_id_by_phone(p_phone text)
 returns uuid
 language sql
 stable security definer
 set search_path to 'auth', 'public'
as $function$
  select id from auth.users where phone = p_phone limit 1;
$function$;

revoke execute on function public.auth_user_id_by_phone(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_phone(text) to service_role;

-- --------------------------------------------------------- signup / linking
-- Runs on every new auth.users row (phone signup, Kakao OAuth, admin-created).
-- Matches an existing person by kakao id, then phone, then email; on a match it ADDS a
-- link rather than repointing, so the earlier login method keeps working.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  -- The number can arrive on the auth user itself (phone OTP) or in the OAuth profile
  -- (Kakao returns phone_number as "+82 10-1234-5678" when the scope is granted).
  -- Both are normalized to the 010… form stored in public.users.phone.
  raw_phone text := coalesce(
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data->>'phone_number', ''),
    nullif(new.raw_user_meta_data->>'phone', ''));
  norm_phone text := case
    when raw_phone is null then null
    else regexp_replace(regexp_replace(raw_phone, '\D', '', 'g'), '^82', '0')
  end;
  kakao text := coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'kakao_id');
  new_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  new_photo text := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');
  matched text;
begin
  -- Most specific identifier first. Kakao ids are exact; phone is normalized to 010…;
  -- email is compared case-insensitively.
  select u.uid into matched
    from public.users u
   where (kakao is not null and u.kakao_id = kakao)
   limit 1;

  if matched is null and norm_phone is not null then
    select u.uid into matched from public.users u where u.phone = norm_phone limit 1;
  end if;

  if matched is null and new.email is not null then
    select u.uid into matched from public.users u
     where u.email is not null and lower(u.email) = lower(new.email) limit 1;
  end if;

  if matched is not null then
    -- Same person, new way of logging in: link it and fill in whatever we just learned.
    update public.users u
       set auth_id       = coalesce(u.auth_id, new.id),   -- never repoint an existing link
           kakao_id      = coalesce(u.kakao_id, kakao),
           phone         = coalesce(nullif(u.phone, ''), norm_phone),
           email         = coalesce(nullif(u.email, ''), new.email),
           display_name  = coalesce(nullif(u.display_name, ''), new_name),
           photo_url     = coalesce(nullif(u.photo_url, ''), new_photo),
           last_login_at = now()
     where u.uid = matched;
  else
    matched := new.id::text;
    insert into public.users (uid, auth_id, email, phone, display_name, photo_url, kakao_id,
                              created_at, last_login_at)
    values (matched, new.id, new.email, norm_phone, new_name, new_photo, kakao, now(), now())
    on conflict (uid) do nothing;
  end if;

  insert into public.user_auth_identities (auth_id, uid)
  values (new.id, matched)
  on conflict (auth_id) do update set uid = excluded.uid;

  return new;
end $function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
