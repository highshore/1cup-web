-- Let a returning member attach a new login method to the profile they already have.
--
-- Why
-- ---
-- handle_new_user guesses whether an incoming auth user is somebody we already know,
-- from kakao_id, then phone, then email. The guess is only as good as what the provider
-- hands over, and Kakao withholds the phone number for roughly half our members. 27
-- profiles carry a phone and nothing else: if one of those people signs in with Kakao
-- and Kakao stays quiet about the number, nothing matches, a second profile is created,
-- and their subscription and history stay behind on the first one — silently.
--
-- Guessing harder is the wrong fix. This lets the person prove it themselves with the
-- phone OTP they already use to sign in, which works no matter what the provider shares.

-- ----------------------------------------------------------- flag the unmatched signup
alter table public.users
  add column if not exists identity_unmatched boolean not null default false;

comment on column public.users.identity_unmatched is
  'True when handle_new_user created this profile without matching an existing member. '
  'The app offers to link an older account; cleared once linked or dismissed.';

-- ------------------------------------------------------------------- handle_new_user
-- Unchanged except for the one flag: keeping the body here rather than patching it in
-- place so the matching order stays readable in a single file.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
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
  -- a.id <> new.id matters: this trigger fires after the row is inserted, so without it
  -- a phone signup can match its own brand-new auth user and "find" itself.
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
    update public.users u
       set auth_id       = coalesce(u.auth_id, new.id),
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
                              created_at, last_login_at, identity_unmatched)
    -- The flag is the only change: nothing here identified an existing member, so this
    -- may be a duplicate rather than a genuinely new one. Only the person can say which.
    values (matched, new.id, new.email, norm_phone, new_name, new_photo, kakao, now(), now(), true)
    on conflict (uid) do nothing;
  end if;

  insert into public.user_auth_identities (auth_id, uid)
  values (new.id, matched)
  on conflict (auth_id) do nothing;

  return new;
end $function$;

-- ------------------------------------------------------------------- relink function
-- Moves one auth identity onto the profile the member proved they own, and disposes of
-- the profile that was created for them by mistake.
--
-- Repointing an identity is exactly what orphaned a paying member once before, so this
-- is deliberately narrow: it only ever moves the CALLER's own identity, only away from a
-- profile that was flagged identity_unmatched, and it refuses to delete anything that
-- has data behind it. Everything happens in one statement block so a half-moved identity
-- cannot survive an error.
create or replace function public.link_identity_to_profile(
  p_auth_id uuid,
  p_target_uid text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current_uid text;
  v_has_data boolean;
  v_deleted boolean := false;
begin
  if p_auth_id is null or p_target_uid is null then
    raise exception 'auth id and target uid are required';
  end if;

  select uid into v_current_uid
    from public.user_auth_identities where auth_id = p_auth_id;

  if v_current_uid is null then
    raise exception 'this login is not linked to any profile';
  end if;
  if not exists (select 1 from public.users where uid = p_target_uid) then
    raise exception 'target profile does not exist';
  end if;

  if v_current_uid = p_target_uid then
    return jsonb_build_object('status', 'already_linked', 'uid', p_target_uid);
  end if;

  -- Only a profile this trigger flagged as unmatched may be left behind. Anything else
  -- is somebody's real account and must not be silently reassigned.
  if not exists (
    select 1 from public.users where uid = v_current_uid and identity_unmatched
  ) then
    raise exception 'refusing to move an identity away from an established profile';
  end if;

  update public.user_auth_identities
     set uid = p_target_uid
   where auth_id = p_auth_id;

  update public.users
     set identity_unmatched = false,
         auth_id = coalesce(auth_id, p_auth_id),
         last_login_at = now()
   where uid = p_target_uid;

  -- Drop the stand-in profile, but only once it is provably empty. A single surprise row
  -- anywhere is reason enough to keep it and let a human look.
  select exists (select 1 from public.payment_orders        where user_id = v_current_uid)
      or exists (select 1 from public.meetup_participants   where user_id = v_current_uid)
      or exists (select 1 from public.speaking_reports      where user_id = v_current_uid)
      or exists (select 1 from public.user_vocabulary       where user_id = v_current_uid)
      or exists (select 1 from public.feedback             where user_id = v_current_uid)
      or exists (select 1 from public.conversation_members  where user_id = v_current_uid)
      or exists (select 1 from public.user_auth_identities  where uid     = v_current_uid)
    into v_has_data;

  if not v_has_data then
    delete from public.users where uid = v_current_uid and identity_unmatched;
    v_deleted := true;
  end if;

  return jsonb_build_object(
    'status', 'linked',
    'uid', p_target_uid,
    'previous_uid', v_current_uid,
    'previous_profile_deleted', v_deleted
  );
end $$;

revoke all on function public.link_identity_to_profile(uuid, text) from public, anon, authenticated;
