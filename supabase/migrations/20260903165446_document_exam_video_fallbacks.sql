-- The desktop workspace retained expiring Veo file references, not their MP4
-- bytes. The seven references returned 403 at import time. These silent motion
-- fallbacks are derived from the exact saved interviewer portraits so the mock
-- test remains visually complete until the original Veo clips are regenerated.
update public.exam_interviewers
set
  source_metadata = coalesce(source_metadata, '{}'::jsonb) || jsonb_build_object(
    'video_source', 'portrait-motion-fallback',
    'original_video_state', 'desktop-provider-reference-expired'
  ),
  updated_at = now()
where id in (
  '34bdb7a9-dc04-4494-ab80-672b4ab1b919'::uuid,
  '4e946ca0-f9d5-4ab6-8b81-228dab74fb0e'::uuid,
  '7528b4bd-3345-4e71-8d16-f1355b052af2'::uuid
);

update public.exam_set_items
set
  media_mode = 'uploaded',
  updated_at = now()
where exam_set_id = 'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid
  and module = 'interview';
