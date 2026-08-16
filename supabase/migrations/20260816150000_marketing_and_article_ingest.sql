-- Schema for the features main added while this branch was in flight: the Gopas
-- marketing cron, admin article ingest, and discussion-topic voting. All three were
-- written against Firestore; these are the Postgres equivalents.

-- ------------------------------------------------------------ marketing templates
create table if not exists public.marketing_templates (
  id              text primary key,
  name            text not null default '',
  destination_url text not null default '',
  title           text not null default '',
  copy            text not null default '',
  call_to_action  text not null default '',
  photos          jsonb not null default '[]'::jsonb,   -- [{url, alt}]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------------- cron run history
create table if not exists public.marketing_cron_runs (
  id                    text primary key,
  channel               text not null default 'koreapas',
  trigger               text not null default 'schedule',   -- schedule | manual
  status                text not null default 'queued',
  scheduled_for         timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  post_id               text,
  post_title            text not null default '',
  post_copy             text not null default '',
  tracking_code         text not null default '',
  tracking_url          text not null default '',
  hidden_post_id        text not null default '',
  external_post_url     text not null default '',
  photos                jsonb not null default '[]'::jsonb,
  performance           jsonb not null default '{}'::jsonb, -- impressions/clicks/signups/likes/comments/trackedPosts
  performance_checked_at timestamptz,
  error                 text not null default '',
  created_at            timestamptz not null default now()
);

create index if not exists marketing_cron_runs_started_idx
  on public.marketing_cron_runs (started_at desc nulls last);

-- ------------------------------------------------- marketing cron settings (singleton)
-- growth_config already holds the agent toggles; the cron settings live alongside them.
alter table public.growth_config
  add column if not exists enabled              boolean     not null default false,
  add column if not exists next_run_at          timestamptz,
  add column if not exists schedule             jsonb       not null default '{"minute":0,"hour":9,"daysOfWeek":[1,3,5]}'::jsonb,
  add column if not exists template_id          text,
  add column if not exists template_assignments jsonb       not null default '{}'::jsonb,
  add column if not exists destination_url      text        not null default '',
  add column if not exists title                text        not null default '',
  add column if not exists copy                 text        not null default '',
  add column if not exists call_to_action       text        not null default '',
  add column if not exists photos               jsonb       not null default '[]'::jsonb,
  add column if not exists time_zone            text        not null default 'Asia/Seoul',
  add column if not exists last_run_at          timestamptz;

-- ------------------------------------------------------------------- growth posts
-- The /r/<code> redirect resolves a post by tracking_code and needs where to send the
-- visitor plus which run produced the link.
alter table public.growth_posts
  add column if not exists destination_url text,
  add column if not exists run_id          text;

create index if not exists growth_posts_tracking_code_idx
  on public.growth_posts (tracking_code);

-- --------------------------------------------------------- discussion topic voting
create table if not exists public.article_discussion_votes (
  article_id text not null references public.articles(id) on delete cascade,
  topic_id   text not null,
  user_id    text not null references public.users(uid) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (article_id, topic_id, user_id)
);

create table if not exists public.article_discussion_stats (
  article_id  text not null references public.articles(id) on delete cascade,
  topic_id    text not null,
  topic_text  text not null default '',
  topic_index integer,
  upvotes     integer not null default 0,
  downvotes   integer not null default 0,
  score       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (article_id, topic_id)
);

-- Firestore did the tally inside a transaction; here the counts are derived from the
-- votes table, so they cannot drift no matter who writes.
create or replace function public.recount_discussion_topic(p_article_id text, p_topic_id text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into public.article_discussion_stats (article_id, topic_id, upvotes, downvotes, score, updated_at)
  select p_article_id, p_topic_id,
         count(*) filter (where vote = 1)::int,
         count(*) filter (where vote = -1)::int,
         (count(*) filter (where vote = 1) - count(*) filter (where vote = -1))::int,
         now()
    from public.article_discussion_votes
   where article_id = p_article_id and topic_id = p_topic_id
  on conflict (article_id, topic_id) do update
    set upvotes = excluded.upvotes,
        downvotes = excluded.downvotes,
        score = excluded.score,
        updated_at = excluded.updated_at;
$function$;

-- --------------------------------------------------------- admin article ingest job
create table if not exists public.article_processing_jobs (
  article_id  text primary key references public.articles(id) on delete cascade,
  title       text not null default '',
  status      text not null default 'queued',   -- queued | processing | completed | failed
  stage       text not null default 'queued',
  progress    integer not null default 0,
  provider    text,
  model       text,
  workflow    text,
  error       text,
  created_by  text references public.users(uid) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The ingest flow publishes progressively, so an article exists before it is finished.
alter table public.articles
  add column if not exists publication_status text default 'published',
  add column if not exists processing         jsonb,
  add column if not exists created_by         text,
  add column if not exists updated_at         timestamptz;

-- Voting addresses a topic by id; the ids sit alongside the topic strings.
alter table public.articles
  add column if not exists discussion_topic_ids text[];

-- ---------------------------------------------------------------------------- RLS
alter table public.marketing_templates      enable row level security;
alter table public.marketing_cron_runs      enable row level security;
alter table public.article_processing_jobs  enable row level security;
alter table public.article_discussion_votes enable row level security;
alter table public.article_discussion_stats enable row level security;

-- Marketing is admin-only in the UI; the cron itself runs as service role.
drop policy if exists "marketing_templates admin" on public.marketing_templates;
create policy "marketing_templates admin" on public.marketing_templates
  as permissive for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "marketing_cron_runs admin read" on public.marketing_cron_runs;
create policy "marketing_cron_runs admin read" on public.marketing_cron_runs
  as permissive for select to authenticated
  using (public.is_admin());

drop policy if exists "article_processing_jobs admin read" on public.article_processing_jobs;
create policy "article_processing_jobs admin read" on public.article_processing_jobs
  as permissive for select to authenticated
  using (public.is_admin());

-- Anyone may read the tallies; a member may only cast their own vote.
drop policy if exists "discussion stats read" on public.article_discussion_stats;
create policy "discussion stats read" on public.article_discussion_stats
  as permissive for select to anon, authenticated using (true);

drop policy if exists "discussion votes read own" on public.article_discussion_votes;
create policy "discussion votes read own" on public.article_discussion_votes
  as permissive for select to authenticated
  using (user_id = public.current_uid());

drop policy if exists "discussion votes write own" on public.article_discussion_votes;
create policy "discussion votes write own" on public.article_discussion_votes
  as permissive for all to authenticated
  using (user_id = public.current_uid()) with check (user_id = public.current_uid());

grant execute on function public.recount_discussion_topic(text, text) to authenticated, service_role;

-- ------------------------------------------------- marketing cron bookkeeping
-- The Firestore version held a run lease on the config document so the scheduled tick
-- and a manual "run now" could not both fire. Postgres does the same with a conditional
-- UPDATE ... RETURNING, which needs somewhere to keep the lease.
alter table public.growth_config
  add column if not exists active_run_id          text,
  add column if not exists active_run_lease_until timestamptz;

-- Each run snapshots the settings it ran with, so history stays readable after edits.
alter table public.marketing_cron_runs
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.growth_posts
  add column if not exists hidden_post_id   text,
  add column if not exists photos           jsonb not null default '[]'::jsonb,
  add column if not exists publisher_status text;

-- ------------------------------------------------------------- marketing cron job
-- Ticks every 10 minutes and does nothing unless growth_config says a run is due, which
-- is how the Firestore version behaved (Cloud Scheduler fired, the function decided).
-- Registered PAUSED: enable it once the Gopas publisher endpoint is configured.
-- Replace <SERVICE_ROLE_KEY> when applying to a fresh project.
--   select cron.schedule('marketing-tick', '*/10 * * * *', $cron$
--     select net.http_post(
--       url     := 'https://<ref>.supabase.co/functions/v1/marketing',
--       headers := jsonb_build_object('Content-Type','application/json',
--                                     'Authorization','Bearer <SERVICE_ROLE_KEY>'),
--       body    := jsonb_build_object('action','tick'));
--   $cron$);
--   select cron.alter_job((select jobid from cron.job where jobname='marketing-tick'),
--                         active := false);
