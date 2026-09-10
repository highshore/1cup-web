-- Structured member-profile fields used by the redesigned private profile editor.
-- This is intentionally additive and idempotent because the production project may
-- already have the column from an earlier design iteration.
alter table public.users
  add column if not exists profile_details jsonb not null default '{}'::jsonb;

comment on column public.users.profile_details is
  'Structured member-profile details such as nationality, languages, English level, and meetup preferences.';
