-- The production Test Center owns its generation state. Provider operation
-- references are private server metadata; public rows contain only durable
-- Supabase Storage URLs once an asset has completed.

alter table public.exam_interviewers
  add column if not exists image_error text,
  add column if not exists video_error text;

alter table public.exam_sets
  add column if not exists media_metadata jsonb not null default '{}'::jsonb;

alter table public.exam_set_narration
  add column if not exists media_error text,
  add column if not exists media_metadata jsonb not null default '{}'::jsonb;

alter table public.exam_set_items
  add column if not exists audio_error text,
  add column if not exists visual_error text,
  add column if not exists video_error text,
  add column if not exists media_metadata jsonb not null default '{}'::jsonb;

comment on column public.exam_sets.media_metadata is
  'Server-owned model and SAM 3 generation metadata. Never return to public test clients.';
comment on column public.exam_set_narration.media_metadata is
  'Server-owned Gemini TTS generation metadata. Never return to public test clients.';
comment on column public.exam_set_items.media_metadata is
  'Server-owned Gemini, Veo, and SAM 3 generation metadata. Never return to public test clients.';
