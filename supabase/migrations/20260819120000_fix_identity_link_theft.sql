-- Fixes the split-account bug that stranded a paying member on 2026-08-19.
--
-- What happened: a migrated profile had public.users.phone empty — the number lived
-- only on its auth.users row, reachable through user_auth_identities. handle_new_user
-- matches on public.users columns only, so a Kakao login for that same person found
-- nothing, created a second profile, and stamped the Kakao-supplied phone onto it.
-- The next phone OTP then resolved by users.phone to that *new* profile and the link
-- upsert below moved the original phone identity onto it, leaving the paid profile
-- with no auth identities at all. Both login methods landed on the empty account.
--
-- Two changes:
--   1. Match on auth.users.phone as well, so an existing auth user for the number is
--      found even when public.users.phone was never populated.
--   2. Never repoint an identity that already resolves to a profile. Linking is
--      additive; moving an existing link is how the first profile got orphaned.

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

  -- The number may only exist on an *earlier auth user* (migrated profiles often have
  -- public.users.phone empty). Resolve through the link table before giving up, or we
  -- create a duplicate profile for somebody who already has one.
  if matched is null and norm_phone is not null then
    select i.uid into matched
      from auth.users a
      join public.user_auth_identities i on i.auth_id = a.id
     where a.id <> new.id
       and regexp_replace(regexp_replace(coalesce(a.phone, ''), '\D', '', 'g'), '^82', '0') = norm_phone
     limit 1;
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

  -- Additive only. If this auth user is somehow already linked, the existing profile
  -- wins: repointing is what orphaned a paying member's account.
  insert into public.user_auth_identities (auth_id, uid)
  values (new.id, matched)
  on conflict (auth_id) do nothing;

  return new;
end $function$;
