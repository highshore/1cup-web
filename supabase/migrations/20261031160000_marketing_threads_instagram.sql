-- Threads and Instagram as marketing channels.
--
-- * Each template chooses the channels it posts to and carries channel-specific copy:
--   Threads posts are short (500 characters including the tracking link) and Instagram
--   captions cannot hold clickable links, so neither reuses the long Gopas body.
--   Existing templates keep posting only to Gopas.
-- * A due template creates one queued run per channel. The scheduler publishes one run
--   per tick, so a slow publisher on one channel cannot time out the others.
-- * Channel access tokens live in a table only the service role can read. The browser
--   sees connection status through the `marketing` Edge Function, never the token.

alter table public.marketing_templates
  add column if not exists channels          text[] not null default array['koreapas']::text[],
  add column if not exists threads_text      text   not null default '',
  add column if not exists instagram_caption text   not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'marketing_templates_channels_valid'
  ) then
    alter table public.marketing_templates
      add constraint marketing_templates_channels_valid
      check (channels <@ array['koreapas', 'threads', 'instagram']::text[]);
  end if;
end;
$$;

-- Threads and Instagram return a media id that the insights APIs need later.
alter table public.growth_posts
  add column if not exists external_id text not null default '';

create index if not exists marketing_cron_runs_queued_idx
  on public.marketing_cron_runs (created_at)
  where status = 'queued';

create table if not exists public.marketing_channel_accounts (
  channel            text primary key check (channel in ('threads', 'instagram')),
  account_id         text        not null default '',
  username           text        not null default '',
  access_token       text        not null default '',
  token_expires_at   timestamptz,
  token_refreshed_at timestamptz,
  last_error         text        not null default '',
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.marketing_channel_accounts enable row level security;
-- No policies: only the service role (the `marketing` Edge Function) may read or write.
revoke all on table public.marketing_channel_accounts from anon, authenticated;
