-- Approved cleanup after the Firestore-to-Supabase migration audit.
--
-- These tables have no current app, API route, Edge Function, view, or database
-- function dependency. Do not use CASCADE: an unexpected dependency must fail
-- the migration instead of being removed implicitly.

-- Legacy article-keyword import; the current article experience reads articles,
-- article_meanings, and words instead.
drop table if exists public.article_keywords;

-- Retired community prototype. Comments reference topics, so remove the child
-- table before its parent.
drop table if exists public.community_comments;
drop table if exists public.community_topics;
drop table if exists public.community_announcements;

-- Unused imported English dictionary; no current dictionary workflow reads it.
drop table if exists public.en_dict;

-- Superseded growth-agent iteration log. The active Gopas workflow uses
-- marketing_cron_runs and growth_posts.
drop table if exists public.growth_iterations;

-- Superseded referral tracker. Current attribution is stored on growth_posts and
-- resolved through /r/{trackingCode}.
drop table if exists public.referrals;
