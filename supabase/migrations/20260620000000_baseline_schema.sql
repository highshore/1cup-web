-- Baseline: extensions, tables, constraints, indexes, functions, views
-- Generated from the LIVE Supabase project (hetiycbotgjeluteicyk) by catalog
-- introspection on 2026-08-16. This is the DR/reproducibility baseline: applying
-- the migrations in this directory to an empty project recreates the backend.
-- RLS policies live in the next migration; storage/realtime/cron in the one after.

-- ---------------------------------------------------------------- extensions
create extension if not exists "pg_cron" with schema pg_catalog;
create extension if not exists "pg_net" with schema public;
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "supabase_vault" with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- ------------------------------------------------------------------- tables

create table if not exists public.article_keywords (
  article_id text not null,
  word text not null
);

create table if not exists public.article_meanings (
  article_id text not null,
  word text not null,
  definition text
);

create table if not exists public.articles (
  id text not null,
  title jsonb,
  content jsonb,
  url text,
  source_url text,
  image_url text,
  audio jsonb,
  timestamps jsonb,
  discussion_topics jsonb,
  pronunciation_keywords jsonb,
  "timestamp" timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.billing_stops (
  id text not null,
  user_id text,
  reason text,
  status text,
  original_end_date timestamp with time zone,
  requested_at timestamp with time zone default now()
);

create table if not exists public.blog_post_likes (
  post_id text not null,
  user_id text not null
);

create table if not exists public.blog_posts (
  id text not null,
  title text,
  slug text,
  excerpt text,
  content text,
  featured_image text,
  category text,
  status text default 'draft'::text,
  tags text[] default '{}'::text[],
  featured boolean default false,
  views integer default 0,
  likes integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  published_at timestamp with time zone
);

create table if not exists public.cefr (
  word text not null,
  level text,
  source text,
  freq integer,
  first_seen_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

create table if not exists public.cefr_runs (
  id text not null,
  status text,
  total integer,
  counts jsonb,
  unique_counts jsonb,
  words_by_level jsonb,
  existing jsonb,
  acronyms jsonb,
  pending jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.celebrations (
  id text not null,
  member_name text,
  headline text,
  description text,
  logo_url text,
  "order" integer,
  achieved_at timestamp with time zone
);

create table if not exists public.community_announcements (
  id text not null,
  payload jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.community_comments (
  id text not null,
  topic_id text,
  content text,
  author text,
  author_id text,
  likes integer default 0,
  liked_by text[] default '{}'::text[],
  created_at timestamp with time zone default now()
);

create table if not exists public.community_topics (
  id text not null,
  title text,
  content text,
  author text,
  author_id text,
  likes integer default 0,
  liked_by text[] default '{}'::text[],
  created_at timestamp with time zone default now()
);

create table if not exists public.en_dict (
  headword text not null,
  en text,
  ko text,
  pos text,
  label text,
  "order" integer,
  senses jsonb,
  examples jsonb,
  definition text
);

create table if not exists public.feedback (
  id text not null,
  kind text,
  user_id text,
  category text,
  survey jsonb,
  reasons text[],
  other_reason text,
  created_at timestamp with time zone default now()
);

create table if not exists public.growth_config (
  id text not null,
  agent_active boolean default false,
  approve_first boolean default true,
  updated_at timestamp with time zone default now()
);

create table if not exists public.growth_iterations (
  id text not null,
  run_at timestamp with time zone,
  channel text,
  observation text,
  decision text,
  strategy_change text,
  variant jsonb,
  post_id text,
  model text,
  tokens_used integer
);

create table if not exists public.growth_posts (
  id text not null,
  channel text,
  title text,
  content text,
  image_url text,
  variant jsonb,
  tracking_code text,
  status text default 'draft'::text,
  external_url text,
  iteration_id text,
  metrics jsonb,
  scheduled_for timestamp with time zone,
  posted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.links (
  category text not null,
  url text,
  updated_at timestamp with time zone default now()
);

create table if not exists public.meetup_articles (
  meetup_id text not null,
  article_id text not null
);

create table if not exists public.meetup_participants (
  meetup_id text not null,
  user_id text not null,
  role text default 'participant'::text,
  leader_details jsonb
);

create table if not exists public.meetups (
  id text not null,
  title text,
  description text,
  date_time timestamp with time zone,
  duration_minutes integer,
  lockdown_minutes integer,
  max_participants integer,
  current_participants integer,
  image_urls text[] default '{}'::text[],
  location_name text,
  location_address text,
  location_map_url text,
  location_extra_info text,
  latitude numeric,
  longitude numeric,
  topics jsonb,
  seating_arrangement jsonb,
  assignments jsonb,
  generated_at timestamp with time zone,
  generated_by text,
  created_at timestamp with time zone default now()
);

create table if not exists public.payment_cancellations (
  id text not null,
  user_id text,
  original_order_id text,
  status text,
  reason text,
  refund_amount_attempted numeric,
  refund_amount_processed numeric,
  payple_error_code text,
  payple_error_message text,
  payple_response jsonb,
  requested_at timestamp with time zone default now()
);

create table if not exists public.payment_orders (
  order_number text not null,
  user_id text,
  amount numeric,
  status text,
  type text,
  referral_code text,
  billing_key_used text,
  payment_method text,
  related_auth_order text,
  selected_categories jsonb,
  payment_result jsonb,
  payple_response jsonb,
  payple_params_attempted jsonb,
  error_code text,
  error_message text,
  order_date timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.phone_otp (
  id uuid not null default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  attempts integer not null default 0,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.referral_codes (
  code text not null,
  active boolean default true,
  discount numeric,
  type text,
  referrer text,
  created_at timestamp with time zone default now()
);

create table if not exists public.referrals (
  code text not null,
  post_id text,
  channel text,
  visits integer default 0,
  signups integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.shadow (
  id text not null,
  youtube_url text,
  audio_timestamps jsonb
);

create table if not exists public.speaking_reports (
  transcript_id text not null,
  user_id text not null,
  speaker_id text,
  user_script text,
  word_count integer,
  speaking_duration_sec numeric,
  avg_wpm numeric,
  speaking_turns integer,
  avg_turn_sec numeric,
  longest_turn_sec numeric,
  avg_response_latency_sec numeric,
  interruptions integer,
  unique_words integer,
  lexical_diversity_pct numeric,
  talk_time_share_pct numeric,
  overall_score numeric,
  article_id text,
  session_number integer,
  analysis jsonb,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.transcripts (
  id text not null,
  event_id text,
  article_id text,
  created_by text,
  session_number integer,
  report_count integer,
  leader_uids text[] default '{}'::text[],
  participant_uids text[] default '{}'::text[],
  custom_keywords text[] default '{}'::text[],
  speaker_mappings jsonb,
  transcript_content jsonb,
  transcript_metadata jsonb,
  hide_unidentified_speakers boolean default false,
  reports_generated boolean default false,
  preserve_spacing boolean,
  total_words integer,
  total_recording_duration numeric,
  total_paused_duration numeric,
  created_at timestamp with time zone default now(),
  reports_generated_at timestamp with time zone,
  last_updated timestamp with time zone
);

create table if not exists public.users (
  uid text not null,
  email text,
  display_name text,
  photo_url text,
  phone text,
  kakao_id text,
  account_status text default 'user'::text,
  user_type text,
  gdg_member boolean default false,
  has_active_subscription boolean default false,
  plan_price numeric,
  billing_key text,
  payment_method text,
  billing_cancelled boolean default false,
  subscription_start_date timestamp with time zone,
  subscription_end_date timestamp with time zone,
  last_billing_date timestamp with time zone,
  billing_updated_at timestamp with time zone,
  cancellation_timestamp timestamp with time zone,
  cancellation_type text,
  cancellation_reason text,
  cat_tech boolean default false,
  cat_business boolean default false,
  received_articles text[] default '{}'::text[],
  last_received timestamp with time zone,
  left_count integer,
  saved_words text[] default '{}'::text[],
  referral_code text,
  referral_generated_at timestamp with time zone,
  bio text,
  work text,
  school text,
  location text,
  interests text,
  profile_public boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_login_at timestamp with time zone,
  auth_id uuid
);

create table if not exists public.words (
  word text not null,
  categories jsonb,
  definitions jsonb,
  examples jsonb,
  synonyms text[] default '{}'::text[],
  antonyms text[] default '{}'::text[]
);

-- -------------------------------------------------------------- constraints
-- (idempotent: skipped when a constraint of the same name already exists)
do $$ begin
  alter table public.article_keywords add constraint article_keywords_pkey PRIMARY KEY (article_id, word);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.article_meanings add constraint article_meanings_pkey PRIMARY KEY (article_id, word);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.articles add constraint articles_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.billing_stops add constraint billing_stops_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.blog_post_likes add constraint blog_post_likes_pkey PRIMARY KEY (post_id, user_id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.blog_posts add constraint blog_posts_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.cefr add constraint cefr_pkey PRIMARY KEY (word);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.cefr_runs add constraint cefr_runs_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.celebrations add constraint celebrations_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.community_announcements add constraint community_announcements_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.community_comments add constraint community_comments_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.community_topics add constraint community_topics_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.en_dict add constraint en_dict_pkey PRIMARY KEY (headword);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.feedback add constraint feedback_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.growth_config add constraint growth_config_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.growth_iterations add constraint growth_iterations_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.growth_posts add constraint growth_posts_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.links add constraint links_pkey PRIMARY KEY (category);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetup_articles add constraint meetup_articles_pkey PRIMARY KEY (meetup_id, article_id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetup_participants add constraint meetup_participants_pkey PRIMARY KEY (meetup_id, user_id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetups add constraint meetups_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.payment_cancellations add constraint payment_cancellations_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.payment_orders add constraint payment_orders_pkey PRIMARY KEY (order_number);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.phone_otp add constraint phone_otp_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.referral_codes add constraint referral_codes_pkey PRIMARY KEY (code);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.referrals add constraint referrals_pkey PRIMARY KEY (code);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.shadow add constraint shadow_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.speaking_reports add constraint speaking_reports_pkey PRIMARY KEY (transcript_id, user_id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.transcripts add constraint transcripts_pkey PRIMARY KEY (id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.users add constraint users_pkey PRIMARY KEY (uid);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.words add constraint words_pkey PRIMARY KEY (word);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.blog_posts add constraint blog_posts_slug_key UNIQUE (slug);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.users add constraint users_auth_id_key UNIQUE (auth_id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetup_participants add constraint meetup_participants_role_check CHECK ((role = ANY (ARRAY['participant'::text, 'leader'::text])));
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.article_keywords add constraint article_keywords_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.article_meanings add constraint article_meanings_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.billing_stops add constraint billing_stops_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.blog_post_likes add constraint blog_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.blog_post_likes add constraint blog_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.community_comments add constraint community_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.community_comments add constraint community_comments_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES community_topics(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.community_topics add constraint community_topics_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.feedback add constraint feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.growth_iterations add constraint growth_iterations_post_id_fkey FOREIGN KEY (post_id) REFERENCES growth_posts(id) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetup_articles add constraint meetup_articles_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetup_articles add constraint meetup_articles_meetup_id_fkey FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetup_participants add constraint meetup_participants_meetup_id_fkey FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetup_participants add constraint meetup_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.meetups add constraint meetups_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.payment_cancellations add constraint payment_cancellations_original_order_id_fkey FOREIGN KEY (original_order_id) REFERENCES payment_orders(order_number) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.payment_cancellations add constraint payment_cancellations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.payment_orders add constraint payment_orders_referral_code_fkey FOREIGN KEY (referral_code) REFERENCES referral_codes(code) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.payment_orders add constraint payment_orders_related_auth_order_fkey FOREIGN KEY (related_auth_order) REFERENCES payment_orders(order_number);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.payment_orders add constraint payment_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.referral_codes add constraint referral_codes_referrer_fkey FOREIGN KEY (referrer) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.speaking_reports add constraint speaking_reports_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.speaking_reports add constraint speaking_reports_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.speaking_reports add constraint speaking_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.transcripts add constraint transcripts_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.transcripts add constraint transcripts_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uid) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.transcripts add constraint transcripts_event_id_fkey FOREIGN KEY (event_id) REFERENCES meetups(id) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.users add constraint users_referral_code_fkey FOREIGN KEY (referral_code) REFERENCES referral_codes(code) ON DELETE SET NULL;
exception when duplicate_object or duplicate_table then null; end $$;

-- ------------------------------------------------------------------ indexes
CREATE INDEX IF NOT EXISTS billing_stops_user_id_idx ON public.billing_stops USING btree (user_id);
CREATE INDEX IF NOT EXISTS blog_posts_status_published_at_idx ON public.blog_posts USING btree (status, published_at DESC);
CREATE INDEX IF NOT EXISTS cefr_level_idx ON public.cefr USING btree (level);
CREATE INDEX IF NOT EXISTS cefr_runs_status_idx ON public.cefr_runs USING btree (status);
CREATE INDEX IF NOT EXISTS growth_posts_status_created_at_idx ON public.growth_posts USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS meetup_participants_user_id_idx ON public.meetup_participants USING btree (user_id);
CREATE INDEX IF NOT EXISTS meetups_date_time_idx ON public.meetups USING btree (date_time);
CREATE INDEX IF NOT EXISTS payment_cancellations_user_id_idx ON public.payment_cancellations USING btree (user_id);
CREATE INDEX IF NOT EXISTS payment_orders_status_user_id_completed_at_idx ON public.payment_orders USING btree (status, user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_user_id_completed_at_idx ON public.payment_orders USING btree (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS phone_otp_phone_created_idx ON public.phone_otp USING btree (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS speaking_reports_article_id_idx ON public.speaking_reports USING btree (article_id);
CREATE INDEX IF NOT EXISTS speaking_reports_user_id_idx ON public.speaking_reports USING btree (user_id);
CREATE INDEX IF NOT EXISTS transcripts_article_id_idx ON public.transcripts USING btree (article_id);
CREATE INDEX IF NOT EXISTS transcripts_event_id_idx ON public.transcripts USING btree (event_id);
CREATE INDEX IF NOT EXISTS users_auth_id_idx ON public.users USING btree (auth_id);
CREATE INDEX IF NOT EXISTS users_cat_business_left_count_idx ON public.users USING btree (cat_business, left_count);
CREATE INDEX IF NOT EXISTS users_cat_tech_left_count_idx ON public.users USING btree (cat_tech, left_count);
CREATE INDEX IF NOT EXISTS users_gdg_member_idx ON public.users USING btree (gdg_member) WHERE gdg_member;
CREATE INDEX IF NOT EXISTS users_has_active_subscription_subscription_end_date_idx ON public.users USING btree (has_active_subscription, subscription_end_date);
CREATE INDEX IF NOT EXISTS users_kakao_id_idx ON public.users USING btree (kakao_id);

-- ---------------------------------------------------------------- functions

CREATE OR REPLACE FUNCTION public.current_uid()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select uid from public.users where auth_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  norm_phone text := case when new.phone is not null and new.phone <> ''
                          then regexp_replace(new.phone, '^82', '0') end;
  kakao text := coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'kakao_id');
  matched text;
begin
  -- Link the person's existing row by kakao id, then phone, then email. Repoint even
  -- if auth_id is already set (seeded migrated users), so OAuth/phone logins converge
  -- on the existing account instead of creating a duplicate.
  update public.users u set auth_id = new.id, last_login_at = now()
   where ( (kakao is not null and u.kakao_id = kakao)
        or (norm_phone is not null and u.phone = norm_phone)
        or (new.email is not null and u.email is not null and lower(u.email) = lower(new.email)) )
  returning u.uid into matched;

  if matched is null then
    insert into public.users (uid, auth_id, email, phone, display_name, photo_url, kakao_id, created_at, last_login_at)
    values (new.id::text, new.id, new.email, norm_phone,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
      kakao, now(), now())
    on conflict (uid) do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.home_stats_counts()
 RETURNS TABLE(total_meetups integer, total_members integer, total_articles integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (select count(*) from public.meetups)::int,
         (select count(*) from public.users)::int,
         (select count(*) from public.articles)::int;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (auth.jwt() ->> 'role') = 'admin',
    exists (select 1 from public.users u
            where u.auth_id = auth.uid() and u.account_status = 'admin'),
    false);
$function$
;

-- -------------------------------------------------------------------- views

create or replace view public.home_stats as
 SELECT total_meetups,
    total_members,
    total_articles,
    now() AS last_updated
   FROM home_stats_counts() home_stats_counts(total_meetups, total_members, total_articles);

create or replace view public.meetup_report_users as
 WITH per_user AS (
         SELECT t.event_id,
            sr.user_id,
            array_agg(DISTINCT sr.transcript_id) AS transcripts,
            count(*) AS sessions_count,
            sum(sr.word_count) AS total_words,
            sum(sr.speaking_duration_sec) AS total_speaking_duration,
            sum(sr.speaking_turns) AS total_turns,
            sum(sr.interruptions) AS interruptions,
            max(sr.longest_turn_sec) AS longest_turn_sec,
            avg(sr.overall_score) AS avg_overall_score,
                CASE
                    WHEN sum(sr.speaking_duration_sec) > 0::numeric THEN sum(sr.word_count)::numeric / (sum(sr.speaking_duration_sec) / 60.0)
                    ELSE NULL::numeric
                END AS average_wpm,
                CASE
                    WHEN sum(sr.speaking_turns) > 0 THEN sum(sr.avg_turn_sec * sr.speaking_turns::numeric) / sum(sr.speaking_turns)::numeric
                    ELSE NULL::numeric
                END AS weighted_avg_turn_sec,
                CASE
                    WHEN sum(sr.speaking_turns) > 0 THEN sum(sr.avg_response_latency_sec * sr.speaking_turns::numeric) / sum(sr.speaking_turns)::numeric
                    ELSE NULL::numeric
                END AS weighted_avg_response_latency_sec,
                CASE
                    WHEN sum(sr.word_count) > 0 THEN sum(sr.lexical_diversity_pct * sr.word_count::numeric) / sum(sr.word_count)::numeric
                    ELSE NULL::numeric
                END AS weighted_lexical_diversity_pct,
                CASE
                    WHEN sum(sr.speaking_duration_sec) > 0::numeric THEN sum(sr.talk_time_share_pct * sr.speaking_duration_sec) / sum(sr.speaking_duration_sec)
                    ELSE NULL::numeric
                END AS weighted_talk_time_share_pct
           FROM speaking_reports sr
             JOIN transcripts t ON t.id = sr.transcript_id
          WHERE t.event_id IS NOT NULL
          GROUP BY t.event_id, sr.user_id
        )
 SELECT event_id,
    user_id,
    transcripts,
    sessions_count,
    total_words,
    total_speaking_duration,
    total_turns,
    interruptions,
    longest_turn_sec,
    avg_overall_score,
    average_wpm,
    weighted_avg_turn_sec,
    weighted_avg_response_latency_sec,
    weighted_lexical_diversity_pct,
    weighted_talk_time_share_pct,
        CASE
            WHEN sum(total_speaking_duration) OVER (PARTITION BY event_id) > 0::numeric THEN total_speaking_duration / sum(total_speaking_duration) OVER (PARTITION BY event_id) * 100::numeric
            ELSE NULL::numeric
        END AS duration_share_pct
   FROM per_user;

create or replace view public.meetup_reports as
 SELECT t.event_id,
    array_agg(DISTINCT t.id) AS transcripts,
    jsonb_build_object('words', COALESCE(sum(sr.word_count), 0::bigint), 'duration', COALESCE(sum(sr.speaking_duration_sec), 0::numeric)) AS totals,
    max(sr.created_at) AS updated_at
   FROM transcripts t
     LEFT JOIN speaking_reports sr ON sr.transcript_id = t.id
  WHERE t.event_id IS NOT NULL
  GROUP BY t.event_id;

create or replace view public.meetups_with_counts as
 SELECT id,
    title,
    description,
    date_time,
    duration_minutes,
    lockdown_minutes,
    max_participants,
    current_participants,
    image_urls,
    location_name,
    location_address,
    location_map_url,
    location_extra_info,
    latitude,
    longitude,
    topics,
    seating_arrangement,
    assignments,
    generated_at,
    generated_by,
    created_at,
    ( SELECT count(*) AS count
           FROM meetup_participants p
          WHERE p.meetup_id = m.id AND p.role = 'participant'::text) AS participant_count,
    ( SELECT count(*) AS count
           FROM meetup_participants p
          WHERE p.meetup_id = m.id AND p.role = 'leader'::text) AS leader_count
   FROM meetups m;

create or replace view public.public_users as
 SELECT uid,
    display_name,
    photo_url,
    account_status,
    has_active_subscription,
    created_at,
    subscription_start_date
   FROM users;

create or replace view public.user_first_paid as
 SELECT user_id,
    min(COALESCE(completed_at, created_at, order_date)) AS first_paid_at
   FROM payment_orders
  WHERE type = 'subscription_initial_payment'::text AND user_id IS NOT NULL
  GROUP BY user_id;

-- ------------------------------------------------------------------- grants
grant delete, insert, references, select, trigger, truncate, update on public.article_keywords to anon;
grant delete, insert, references, select, trigger, truncate, update on public.article_keywords to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.article_keywords to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.article_meanings to anon;
grant delete, insert, references, select, trigger, truncate, update on public.article_meanings to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.article_meanings to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.articles to anon;
grant delete, insert, references, select, trigger, truncate, update on public.articles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.articles to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.billing_stops to anon;
grant delete, insert, references, select, trigger, truncate, update on public.billing_stops to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.billing_stops to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.blog_post_likes to anon;
grant delete, insert, references, select, trigger, truncate, update on public.blog_post_likes to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.blog_post_likes to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.blog_posts to anon;
grant delete, insert, references, select, trigger, truncate, update on public.blog_posts to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.blog_posts to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cefr to anon;
grant delete, insert, references, select, trigger, truncate, update on public.cefr to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.cefr to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cefr_runs to anon;
grant delete, insert, references, select, trigger, truncate, update on public.cefr_runs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.cefr_runs to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.celebrations to anon;
grant delete, insert, references, select, trigger, truncate, update on public.celebrations to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.celebrations to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.community_announcements to anon;
grant delete, insert, references, select, trigger, truncate, update on public.community_announcements to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.community_announcements to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.community_comments to anon;
grant delete, insert, references, select, trigger, truncate, update on public.community_comments to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.community_comments to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.community_topics to anon;
grant delete, insert, references, select, trigger, truncate, update on public.community_topics to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.community_topics to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.en_dict to anon;
grant delete, insert, references, select, trigger, truncate, update on public.en_dict to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.en_dict to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.feedback to anon;
grant delete, insert, references, select, trigger, truncate, update on public.feedback to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.feedback to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.growth_config to anon;
grant delete, insert, references, select, trigger, truncate, update on public.growth_config to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.growth_config to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.growth_iterations to anon;
grant delete, insert, references, select, trigger, truncate, update on public.growth_iterations to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.growth_iterations to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.growth_posts to anon;
grant delete, insert, references, select, trigger, truncate, update on public.growth_posts to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.growth_posts to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.links to anon;
grant delete, insert, references, select, trigger, truncate, update on public.links to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.links to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_articles to anon;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_articles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_articles to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_participants to anon;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_participants to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_participants to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.meetups to anon;
grant delete, insert, references, select, trigger, truncate, update on public.meetups to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.meetups to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.payment_cancellations to anon;
grant delete, insert, references, select, trigger, truncate, update on public.payment_cancellations to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.payment_cancellations to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.payment_orders to anon;
grant delete, insert, references, select, trigger, truncate, update on public.payment_orders to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.payment_orders to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.phone_otp to anon;
grant delete, insert, references, select, trigger, truncate, update on public.phone_otp to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.phone_otp to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.referral_codes to anon;
grant delete, insert, references, select, trigger, truncate, update on public.referral_codes to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.referral_codes to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.referrals to anon;
grant delete, insert, references, select, trigger, truncate, update on public.referrals to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.referrals to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.shadow to anon;
grant delete, insert, references, select, trigger, truncate, update on public.shadow to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.shadow to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.speaking_reports to anon;
grant delete, insert, references, select, trigger, truncate, update on public.speaking_reports to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.speaking_reports to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.transcripts to anon;
grant delete, insert, references, select, trigger, truncate, update on public.transcripts to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.transcripts to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.users to anon;
grant delete, insert, references, select, trigger, truncate, update on public.users to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.users to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.words to anon;
grant delete, insert, references, select, trigger, truncate, update on public.words to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.words to service_role;

grant delete, insert, references, select, trigger, truncate, update on public.home_stats to anon;
grant delete, insert, references, select, trigger, truncate, update on public.home_stats to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.home_stats to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_report_users to anon;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_report_users to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_report_users to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_reports to anon;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_reports to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.meetup_reports to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.meetups_with_counts to anon;
grant delete, insert, references, select, trigger, truncate, update on public.meetups_with_counts to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.meetups_with_counts to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.public_users to anon;
grant delete, insert, references, select, trigger, truncate, update on public.public_users to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.public_users to service_role;
grant delete, insert, references, select, trigger, truncate, update on public.user_first_paid to anon;
grant delete, insert, references, select, trigger, truncate, update on public.user_first_paid to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.user_first_paid to service_role;

-- ----------------------------------------------------------------- triggers
drop trigger if exists on_auth_user_created on auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
