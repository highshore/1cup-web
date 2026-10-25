-- 영어 한잔 Daily: a short video clip per lesson, showing the expression in use.
--
-- Clips are supplied by the founder, who holds the rights to each one. They live in the
-- private `daily-clips` bucket and reach readers only through short-lived signed URLs
-- that the lesson page creates on the server, so a clip cannot be hotlinked from a
-- public bucket URL.
--
-- Adding a clip to a lesson (until the admin editor exists):
--   1. Supabase dashboard → Storage → daily-clips → upload, e.g. business/circle-back.mp4
--   2. update public.daily_lessons
--         set clip_path = 'business/circle-back.mp4',
--             clip_caption = 'Let''s circle back on that next week.',
--             clip_source = '촬영: 영어 한잔'
--       where track = 'business' and publish_on = '2026-10-23';
-- clip_path may also be a full https:// URL for a clip hosted elsewhere.

alter table public.daily_lessons
  add column clip_path    text,
  -- The line spoken in the clip; the expression is highlighted where it appears.
  add column clip_caption text,
  -- Credit shown under the player (who made it, or the licence it is used under).
  add column clip_source  text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'daily-clips',
  'daily-clips',
  false,
  52428800,
  array['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
