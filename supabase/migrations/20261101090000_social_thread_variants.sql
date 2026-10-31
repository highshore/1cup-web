-- Threads format experiments for daily posts.
--
-- Each Threads post now gets a media style (text only, text + card images, text + a
-- narrated video) and a structure (one self-contained post, or a first post with
-- replies under it). The web app's optimizer tries every option until each has enough
-- 24-hour view counts (growth_posts.metrics_24h), then mostly uses the best one. Both
-- columns stay null on Instagram posts. The opening style of each post (hookStyle) is
-- kept inside `content`, since an admin can swap it while editing.

alter table public.social_daily_posts
  add column if not exists thread_media text check (thread_media in ('text', 'image', 'video')),
  add column if not exists thread_structure text check (thread_structure in ('single', 'chain'));

-- Every Threads post so far was a text thread with replies.
update public.social_daily_posts
   set thread_media = 'text', thread_structure = 'chain'
 where channel = 'threads' and thread_media is null;
