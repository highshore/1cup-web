# 영어 한잔 Daily: day-to-day operations

Until the admin editor exists, Daily content and settings are changed in the Supabase
dashboard (project "1 Cup English"): **Table editor** for rows, **SQL editor** for the
statements below, **Storage** for clips.

## Add a lesson

A lesson is one row in `daily_lessons`, one per track per weekday (Mon–Fri, KST).
Only `status = 'ready'` lessons are sent; a weekday with no ready lesson sends nothing to
subscribers that day. `supabase/seed/daily_dry_run_lessons.sql` is a full example.

```sql
insert into public.daily_lessons (track, publish_on, expression, meaning, pronunciation, stress,
  nuance, similar_expressions, examples, dialogue, quiz, status)
values ('business', '2026-10-27', 'loop in', '(논의에) 끌어들이다', '/luːp ɪn/', '룹 인',
  '…', array['include', 'cc'],
  '[{"context":"메일","en":"…","ko":"…"}]'::jsonb,
  '[{"speaker":"A","role":"Manager","en":"…","ko":"…"},{"speaker":"B","role":"You","en":"…","ko":"…"}]'::jsonb,
  '{"prompt":"…","options":["loop in","circle back","ship"],"answer":0,"explanation":"…"}'::jsonb,
  'ready');
```

## Add a video clip to a lesson

Only clips you hold the rights to (your own recordings, or footage licensed for this use).

1. **Storage → daily-clips → Upload** an `.mp4` (or `.webm`/`.mov`), up to 50 MB,
   e.g. `business/loop-in.mp4`. The bucket is private; readers get a 6-hour signed link.
2. Attach it:

```sql
update public.daily_lessons
   set clip_path    = 'business/loop-in.mp4',
       clip_caption = 'Could you loop him in on this thread?',  -- the line spoken
       clip_source  = '촬영: 영어 한잔'                            -- credit or licence
 where track = 'business' and publish_on = '2026-10-27';
```

`clip_path` can also be a full `https://` URL for a clip hosted elsewhere. Remove a
clip by setting `clip_path = null`.

## Approve or hide a review

```sql
select id, rating, body, display_name, status from public.daily_reviews order by created_at desc;
update public.daily_reviews set status = 'approved', approved_at = now() where id = '…';
update public.daily_reviews set status = 'hidden' where id = '…';
```

The landing page shows the reviews section once 3 are approved (refreshes every 5 minutes).

## Open or close trials, switch templates

```sql
update public.daily_config set trial_open = true  where id = 'settings';   -- or false
update public.daily_config
   set template_style = 'daily', lesson_template = 'DAILY_LESSON',
       review_template = 'DAILY_REVIEW', trial_ended_template = 'DAILY_TRIAL_END'
 where id = 'settings';  -- once Kakao approves the Daily templates
```
