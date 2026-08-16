-- Baseline: row-level security
-- Generated from the LIVE Supabase project (hetiycbotgjeluteicyk) by catalog
-- introspection on 2026-08-16. This is the DR/reproducibility baseline: applying
-- the migrations in this directory to an empty project recreates the backend.
-- Every app table has RLS enabled; a table with no policy is deny-all for anon/authenticated
-- (the service role bypasses RLS).

-- --------------------------------------------------------------- enable RLS
alter table public.article_keywords enable row level security;
alter table public.article_meanings enable row level security;
alter table public.articles enable row level security;
alter table public.billing_stops enable row level security;
alter table public.blog_post_likes enable row level security;
alter table public.blog_posts enable row level security;
alter table public.cefr enable row level security;
alter table public.cefr_runs enable row level security;
alter table public.celebrations enable row level security;
alter table public.community_announcements enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_topics enable row level security;
alter table public.en_dict enable row level security;
alter table public.feedback enable row level security;
alter table public.growth_config enable row level security;
alter table public.growth_iterations enable row level security;
alter table public.growth_posts enable row level security;
alter table public.links enable row level security;
alter table public.meetup_articles enable row level security;
alter table public.meetup_participants enable row level security;
alter table public.meetups enable row level security;
alter table public.payment_cancellations enable row level security;
alter table public.payment_orders enable row level security;
alter table public.phone_otp enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.shadow enable row level security;
alter table public.speaking_reports enable row level security;
alter table public.transcripts enable row level security;
alter table public.users enable row level security;
alter table public.words enable row level security;

-- ----------------------------------------------------------------- policies

-- article_keywords
drop policy if exists "keywords read" on public.article_keywords;
create policy "keywords read" on public.article_keywords
  as permissive for select to public
  using (true);

-- article_meanings
drop policy if exists "meanings read" on public.article_meanings;
create policy "meanings read" on public.article_meanings
  as permissive for select to public
  using (true);
drop policy if exists "meanings write" on public.article_meanings;
create policy "meanings write" on public.article_meanings
  as permissive for all to authenticated
  using (true)
  with check (true);

-- articles
drop policy if exists "admin write" on public.articles;
create policy "admin write" on public.articles
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
drop policy if exists "public read" on public.articles;
create policy "public read" on public.articles
  as permissive for select to public
  using (true);

-- billing_stops
drop policy if exists "own rows" on public.billing_stops;
create policy "own rows" on public.billing_stops
  as permissive for select to public
  using (((user_id = current_uid()) OR is_admin()));

-- blog_post_likes
drop policy if exists "like self" on public.blog_post_likes;
create policy "like self" on public.blog_post_likes
  as permissive for all to public
  using ((user_id = current_uid()))
  with check ((user_id = current_uid()));
drop policy if exists "read likes" on public.blog_post_likes;
create policy "read likes" on public.blog_post_likes
  as permissive for select to public
  using (true);

-- blog_posts
drop policy if exists "admin write" on public.blog_posts;
create policy "admin write" on public.blog_posts
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
drop policy if exists "published read" on public.blog_posts;
create policy "published read" on public.blog_posts
  as permissive for select to public
  using (((status = 'published'::text) OR is_admin()));

-- cefr
drop policy if exists "public read" on public.cefr;
create policy "public read" on public.cefr
  as permissive for select to public
  using (true);

-- celebrations
drop policy if exists "admin write" on public.celebrations;
create policy "admin write" on public.celebrations
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
drop policy if exists "public read" on public.celebrations;
create policy "public read" on public.celebrations
  as permissive for select to public
  using (true);

-- community_announcements
drop policy if exists "public read" on public.community_announcements;
create policy "public read" on public.community_announcements
  as permissive for select to public
  using (true);

-- community_comments
drop policy if exists "public read" on public.community_comments;
create policy "public read" on public.community_comments
  as permissive for select to public
  using (true);

-- community_topics
drop policy if exists "public read" on public.community_topics;
create policy "public read" on public.community_topics
  as permissive for select to public
  using (true);

-- en_dict
drop policy if exists "public read" on public.en_dict;
create policy "public read" on public.en_dict
  as permissive for select to public
  using (true);

-- feedback
drop policy if exists "own rows" on public.feedback;
create policy "own rows" on public.feedback
  as permissive for all to public
  using (((user_id = current_uid()) OR is_admin()))
  with check ((user_id = current_uid()));

-- growth_config
drop policy if exists "admin all" on public.growth_config;
create policy "admin all" on public.growth_config
  as permissive for all to public
  using (is_admin())
  with check (is_admin());

-- growth_iterations
drop policy if exists "admin all" on public.growth_iterations;
create policy "admin all" on public.growth_iterations
  as permissive for all to public
  using (is_admin())
  with check (is_admin());

-- growth_posts
drop policy if exists "admin all" on public.growth_posts;
create policy "admin all" on public.growth_posts
  as permissive for all to public
  using (is_admin())
  with check (is_admin());

-- links
drop policy if exists "public read" on public.links;
create policy "public read" on public.links
  as permissive for select to public
  using (true);

-- meetup_participants
drop policy if exists "join self" on public.meetup_participants;
create policy "join self" on public.meetup_participants
  as permissive for insert to public
  with check ((user_id = current_uid()));
drop policy if exists "leave self" on public.meetup_participants;
create policy "leave self" on public.meetup_participants
  as permissive for delete to public
  using (((user_id = current_uid()) OR is_admin()));
drop policy if exists "read participants" on public.meetup_participants;
create policy "read participants" on public.meetup_participants
  as permissive for select to public
  using (true);

-- meetups
drop policy if exists "admin write" on public.meetups;
create policy "admin write" on public.meetups
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
drop policy if exists "public read" on public.meetups;
create policy "public read" on public.meetups
  as permissive for select to public
  using (true);

-- payment_cancellations
drop policy if exists "own rows" on public.payment_cancellations;
create policy "own rows" on public.payment_cancellations
  as permissive for select to public
  using (((user_id = current_uid()) OR is_admin()));

-- payment_orders
drop policy if exists "own rows" on public.payment_orders;
create policy "own rows" on public.payment_orders
  as permissive for select to public
  using (((user_id = current_uid()) OR is_admin()));

-- referrals
drop policy if exists "public read" on public.referrals;
create policy "public read" on public.referrals
  as permissive for select to public
  using (true);

-- shadow
drop policy if exists "public read" on public.shadow;
create policy "public read" on public.shadow
  as permissive for select to public
  using (true);

-- speaking_reports
drop policy if exists "own rows" on public.speaking_reports;
create policy "own rows" on public.speaking_reports
  as permissive for select to public
  using (((user_id = current_uid()) OR is_admin()));
drop policy if exists "reports leader read" on public.speaking_reports;
create policy "reports leader read" on public.speaking_reports
  as permissive for select to public
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM (transcripts t
     JOIN meetup_participants mp ON ((mp.meetup_id = t.event_id)))
  WHERE ((t.id = speaking_reports.transcript_id) AND (mp.user_id = current_uid()) AND (mp.role = 'leader'::text))))));

-- transcripts
drop policy if exists "transcript insert" on public.transcripts;
create policy "transcript insert" on public.transcripts
  as permissive for insert to public
  with check (((created_by = current_uid()) OR is_admin()));
drop policy if exists "transcript read" on public.transcripts;
create policy "transcript read" on public.transcripts
  as permissive for select to public
  using (((created_by = current_uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM meetup_participants mp
  WHERE ((mp.meetup_id = transcripts.event_id) AND (mp.user_id = current_uid()))))));
drop policy if exists "transcript update" on public.transcripts;
create policy "transcript update" on public.transcripts
  as permissive for update to public
  using (((created_by = current_uid()) OR is_admin()));

-- users
drop policy if exists "own row" on public.users;
create policy "own row" on public.users
  as permissive for select to public
  using (((uid = current_uid()) OR is_admin()));
drop policy if exists "own update" on public.users;
create policy "own update" on public.users
  as permissive for update to public
  using (((uid = current_uid()) OR is_admin()));

-- words
drop policy if exists "public read" on public.words;
create policy "public read" on public.words
  as permissive for select to public
  using (true);
