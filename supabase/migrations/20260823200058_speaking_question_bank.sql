-- Authorable question-bank model for the speaking-test builder. The public
-- question and private scoring data are deliberately separate: expected Listen
-- & Repeat transcripts must never be returned to a test-taker's browser.

create type public.speaking_question_type as enum (
  'listen_repeat',
  'picture_description',
  'interview'
);

create type public.speaking_question_asset_type as enum ('image', 'audio');

create table public.speaking_question_sets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '',
  format_version text not null default 'speaking-v2',
  is_published boolean not null default false,
  created_by text references public.users(uid) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.speaking_test_sections (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.speaking_question_sets(id) on delete cascade,
  question_type public.speaking_question_type not null,
  position smallint not null check (position > 0),
  title text not null,
  directions text not null,
  preparation_seconds smallint not null default 10 check (preparation_seconds between 0 and 120),
  response_seconds smallint not null default 45 check (response_seconds between 5 and 180),
  required_question_count smallint not null default 1 check (required_question_count between 1 and 20),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (question_set_id, position)
);

create table public.speaking_question_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type public.speaking_question_asset_type not null,
  storage_path text not null unique,
  alt_text text not null default '',
  duration_seconds numeric(6, 2) check (duration_seconds is null or duration_seconds >= 0),
  created_by text references public.users(uid) on delete set null,
  created_at timestamp with time zone not null default now()
);

create table public.speaking_question_bank (
  id uuid primary key default gen_random_uuid(),
  question_type public.speaking_question_type not null,
  version integer not null default 1 check (version > 0),
  topic text not null default '',
  cefr_target text check (cefr_target is null or cefr_target in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  prompt text not null default '',
  scenario text not null default '',
  image_asset_id uuid references public.speaking_question_assets(id) on delete set null,
  audio_asset_id uuid references public.speaking_question_assets(id) on delete set null,
  is_active boolean not null default true,
  created_by text references public.users(uid) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (
    (question_type = 'listen_repeat' and audio_asset_id is not null)
    or (question_type = 'picture_description' and image_asset_id is not null)
    or question_type = 'interview'
  )
);

create table public.speaking_question_private (
  question_id uuid primary key references public.speaking_question_bank(id) on delete cascade,
  expected_transcript text,
  scoring_notes jsonb not null default '{}'::jsonb,
  internal_notes text not null default '',
  updated_at timestamp with time zone not null default now(),
  check (expected_transcript is null or char_length(expected_transcript) <= 2000)
);

create table public.speaking_section_questions (
  section_id uuid not null references public.speaking_test_sections(id) on delete cascade,
  question_id uuid not null references public.speaking_question_bank(id) on delete restrict,
  position smallint not null check (position > 0),
  primary key (section_id, question_id),
  unique (section_id, position)
);

create index speaking_test_sections_set_position_idx
  on public.speaking_test_sections(question_set_id, position);
create index speaking_question_bank_type_active_idx
  on public.speaking_question_bank(question_type, is_active);
create index speaking_section_questions_question_idx
  on public.speaking_section_questions(question_id);

alter table public.speaking_question_sets enable row level security;
alter table public.speaking_test_sections enable row level security;
alter table public.speaking_question_assets enable row level security;
alter table public.speaking_question_bank enable row level security;
alter table public.speaking_question_private enable row level security;
alter table public.speaking_section_questions enable row level security;

revoke all on table public.speaking_question_sets from anon, authenticated;
revoke all on table public.speaking_test_sections from anon, authenticated;
revoke all on table public.speaking_question_assets from anon, authenticated;
revoke all on table public.speaking_question_bank from anon, authenticated;
revoke all on table public.speaking_question_private from anon, authenticated;
revoke all on table public.speaking_section_questions from anon, authenticated;
