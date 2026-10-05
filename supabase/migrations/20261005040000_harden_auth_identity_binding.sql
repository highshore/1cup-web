-- Harden auth identity binding.
--
-- A new auth.users row is NOT proof that the caller owns any pre-existing
-- public.users profile. In particular, raw_user_meta_data is caller-editable and
-- an auth email can be unconfirmed. The previous trigger used those values to
-- choose an existing UID and immediately wrote user_auth_identities, allowing a
-- new principal to inherit another member's RLS/admin identity.
--
-- From this migration forward the global auth trigger is create-only:
--   * every genuinely new auth principal starts mapped to its own UID;
--   * no phone/email/Kakao metadata is used to select an existing profile;
--   * returning-member merges happen only in proof-of-possession flows
--     (verified phone OTP, Kakao reconciliation bound to the same Kakao identity,
--     or Supabase manual identity linking).
--
-- Existing legitimate user_auth_identities rows are intentionally preserved.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  verified_phone text := case
    when new.phone_confirmed_at is not null and nullif(new.phone, '') is not null
      then regexp_replace(regexp_replace(new.phone, '\\D', '', 'g'), '^82', '0')
    else null
  end;
begin
  -- Never search for a pre-existing profile here. The auth UUID is the only
  -- identity this trigger is allowed to assert.
  insert into public.users (
    uid,
    auth_id,
    email,
    phone,
    created_at,
    last_login_at,
    identity_unmatched
  )
  values (
    new.id::text,
    new.id,
    new.email,
    verified_phone,
    now(),
    now(),
    true
  )
  on conflict (uid) do nothing;

  -- New principals initially resolve only to their own profile. A later,
  -- separately authenticated proof-of-possession flow may move this link.
  insert into public.user_auth_identities (auth_id, uid)
  values (new.id, new.id::text)
  on conflict (auth_id) do nothing;

  return new;
end
$function$;

-- The function exists only as an auth.users trigger target.
revoke all on function public.handle_new_user() from public, anon, authenticated;
