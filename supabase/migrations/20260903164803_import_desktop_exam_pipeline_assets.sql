-- The first web implementation substituted browser-generated stand-ins for the
-- desktop pipeline media. Keep the durable web model in sync with the source
-- workspace by recording real, public asset URLs instead.

alter table public.exam_interviewers
  add column if not exists image_url text,
  add column if not exists video_url text;

alter table public.exam_sets
  add column if not exists illustration_url text;

alter table public.exam_set_narration
  add column if not exists audio_url text;

alter table public.exam_set_items
  add column if not exists audio_url text,
  add column if not exists image_url text,
  add column if not exists video_url text;

-- The media is mock test content, not member data. A public bucket lets the
-- browser stream the audio and video without exposing any credentials. Writes
-- remain service-role-only and are performed by the import job below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exam-pipeline-assets',
  'exam-pipeline-assets',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'audio/wav', 'video/mp4']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The import job clears this bucket through the Storage API before it uploads
-- the desktop files. Storage deliberately rejects direct SQL deletion.

-- Clear the fabricated browser-preview references on every Test Center record.
-- The following updates attach only media that exists in the desktop pipeline.
update public.exam_interviewers
set
  image_url = null,
  video_url = null,
  image_status = 'idle',
  video_status = 'idle',
  media_mode = 'uploaded',
  updated_at = now();

update public.exam_sets
set
  illustration_url = null,
  media_mode = 'uploaded',
  updated_at = now();

update public.exam_set_narration
set
  audio_url = null,
  media_status = 'idle',
  updated_at = now();

update public.exam_set_items
set
  audio_url = null,
  image_url = null,
  video_url = null,
  audio_status = 'idle',
  visual_status = 'idle',
  video_status = 'idle',
  media_mode = 'uploaded',
  updated_at = now();

-- Stable object URLs written below correspond one-to-one with the original
-- desktop/exam-interviewer-pipeline media assets.
update public.exam_interviewers
set
  image_url = case id
    when '34bdb7a9-dc04-4494-ab80-672b4ab1b919'::uuid then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/interviewers/elena-rodriguez.jpg'
    when '4e946ca0-f9d5-4ab6-8b81-228dab74fb0e'::uuid then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/interviewers/robert-vance.jpg'
    when '7528b4bd-3345-4e71-8d16-f1355b052af2'::uuid then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/interviewers/david-chen.jpg'
  end,
  video_url = case id
    when '34bdb7a9-dc04-4494-ab80-672b4ab1b919'::uuid then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/interviewers/elena-rodriguez-listening.mp4'
    when '4e946ca0-f9d5-4ab6-8b81-228dab74fb0e'::uuid then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/interviewers/robert-vance-listening.mp4'
    when '7528b4bd-3345-4e71-8d16-f1355b052af2'::uuid then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/interviewers/david-chen-listening.mp4'
  end,
  image_status = 'ready',
  video_status = 'ready',
  media_mode = 'uploaded',
  source_metadata = coalesce(source_metadata, '{}'::jsonb) || jsonb_build_object(
    'media_source', 'desktop/exam-interviewer-pipeline',
    'media_import', '2026-09-03'
  ),
  updated_at = now()
where id in (
  '34bdb7a9-dc04-4494-ab80-672b4ab1b919'::uuid,
  '4e946ca0-f9d5-4ab6-8b81-228dab74fb0e'::uuid,
  '7528b4bd-3345-4e71-8d16-f1355b052af2'::uuid
);

update public.exam_sets
set
  illustration_url = 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/sets/b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c/illustration.jpg',
  media_mode = 'uploaded',
  updated_at = now()
where id = 'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid;

update public.exam_set_narration
set
  audio_url = 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/sets/b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c/narration/' || cue_key || '.wav',
  media_status = 'ready',
  updated_at = now()
where exam_set_id = 'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid;

update public.exam_set_items
set
  audio_url = case when module = 'listen_repeat'
    then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/sets/b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c/listen-repeat/sentence-' || position || '.wav'
    else null
  end,
  image_url = case when module = 'listen_repeat'
    then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/sets/b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c/masks/sentence-' || position || '.png'
    else null
  end,
  video_url = case when module = 'interview'
    then 'https://hetiycbotgjeluteicyk.supabase.co/storage/v1/object/public/exam-pipeline-assets/sets/b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c/interview/question-' || position || '.mp4'
    else null
  end,
  audio_status = case when module = 'listen_repeat' then 'ready' else 'idle' end,
  visual_status = case when module = 'listen_repeat' then 'ready' else 'idle' end,
  video_status = case when module = 'interview' then 'ready' else 'idle' end,
  media_mode = 'uploaded',
  updated_at = now()
where exam_set_id = 'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid;
