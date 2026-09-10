-- Structured fields for the member-owned profile editor.
-- Keep the long-lived public.users columns (bio/work/school/interests/profile_public)
-- for backwards compatibility with the public profile and existing clients, while
-- grouping newer profile-editor fields in one extensible JSON object.
alter table public.users
  add column if not exists profile_details jsonb not null default '{}'::jsonb;

alter table public.users
  drop constraint if exists users_profile_details_object_check;

alter table public.users
  add constraint users_profile_details_object_check
  check (jsonb_typeof(profile_details) = 'object');

comment on column public.users.profile_details is
  'Member-editable structured profile fields: nationality, english_level, languages, discussion_topics, meetup_preferences.';

-- Seed the new structured discussion-topic field from the existing comma-separated
-- interests column so current member profiles do not look empty after rollout.
update public.users
set profile_details = jsonb_set(
  profile_details,
  '{discussion_topics}',
  to_jsonb(
    array(
      select btrim(topic)
      from unnest(string_to_array(coalesce(interests, ''), ',')) as topic
      where btrim(topic) <> ''
      limit 12
    )
  ),
  true
)
where nullif(btrim(interests), '') is not null
  and not (profile_details ? 'discussion_topics');
