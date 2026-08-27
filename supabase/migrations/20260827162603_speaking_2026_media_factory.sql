alter type public.speaking_question_asset_type add value if not exists 'video';

alter table public.speaking_question_sets
  add column if not exists generation_status text not null default 'manual',
  add column if not exists generation_metadata jsonb not null default '{}'::jsonb;

alter table public.speaking_question_sets
  drop constraint if exists speaking_question_sets_generation_status_check;
alter table public.speaking_question_sets
  add constraint speaking_question_sets_generation_status_check
  check (generation_status in ('manual', 'generating', 'draft', 'media_pending', 'ready', 'failed'));

alter table public.speaking_question_sets
  alter column format_version set default 'speaking-2026';

alter table public.speaking_test_sections
  add column if not exists visual_asset_id uuid references public.speaking_question_assets(id) on delete set null;

alter table public.speaking_question_bank
  add column if not exists video_asset_id uuid references public.speaking_question_assets(id) on delete set null;

create index if not exists speaking_question_bank_video_asset_idx
  on public.speaking_question_bank(video_asset_id)
  where video_asset_id is not null;

comment on column public.speaking_test_sections.visual_asset_id is
  'Shared visual context for a 2026 speaking section, e.g. the Listen & Repeat composite scene or interviewer portrait.';
comment on column public.speaking_question_bank.video_asset_id is
  'Optional pre-rendered talking-interviewer clip for a Take an Interview prompt.';
comment on column public.speaking_question_sets.generation_metadata is
  'Server-authored metadata for the 2026 speaking content/media generation pipeline.';
