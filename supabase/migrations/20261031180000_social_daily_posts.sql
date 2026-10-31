-- Daily Threads / Instagram posts.
--
-- Unlike marketing templates (one reusable post on a schedule), a daily post is
-- written fresh each day: the nightly /api/cron/social-drafts job drafts tomorrow's
-- Threads thread and Instagram card news from the latest articles and Daily lessons,
-- renders the card images, and picks a posting time. An admin approves (or edits,
-- regenerates, reschedules, rejects) each draft in /admin/threads and /admin/instagram.
-- The `marketing` Edge Function publishes approved posts when they are due and records
-- each one as a marketing_cron_runs row (trigger 'daily') plus a growth_posts row, so
-- the existing run history, tracking links and insights refresh cover them too.

create table if not exists public.social_daily_posts (
  id             uuid primary key default gen_random_uuid(),
  channel        text not null check (channel in ('threads', 'instagram')),
  format         text not null check (format in ('thread', 'carousel', 'reel')),
  post_date      date not null,                       -- the KST day the post is for
  pillar         text not null default '',            -- content theme of the weekday
  status         text not null default 'draft'
                 check (status in ('draft', 'approved', 'rejected', 'publishing', 'published', 'failed', 'expired')),
  scheduled_for  timestamptz,
  slot           text not null default '',            -- 'HH:MM' KST slot the time came from
  slot_reason    text not null default '',            -- explore | best | try | manual
  content        jsonb not null default '{}'::jsonb,  -- threads: {text, replies[]}; instagram: {caption, slides[]}
  media          jsonb not null default '[]'::jsonb,  -- [{url, kind}] rendered card images / video
  source         jsonb not null default '{}'::jsonb,  -- what the draft was written from
  run_id         text,
  growth_post_id text,
  external_url   text not null default '',
  error          text not null default '',
  approved_at    timestamptz,
  approved_by    text,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (channel, post_date)
);

create index if not exists social_daily_posts_due_idx
  on public.social_daily_posts (scheduled_for)
  where status in ('draft', 'approved');

alter table public.social_daily_posts enable row level security;
drop policy if exists "social_daily_posts admin" on public.social_daily_posts;
create policy "social_daily_posts admin" on public.social_daily_posts
  for all using (is_admin()) with check (is_admin());

-- Views 24 hours after posting, so posts at different times compare fairly when the
-- posting-time optimizer ranks slots. Filled once by the insights refresh.
alter table public.growth_posts
  add column if not exists metrics_24h jsonb;
