-- A deliberate marker means onboarding is only shown to accounts created after
-- this feature ships. Existing members should never be interrupted merely
-- because some older profile fields are blank.
alter table public.users
  add column if not exists onboarding_completed_at timestamptz;

update public.users
   set onboarding_completed_at = now()
 where onboarding_completed_at is null;
