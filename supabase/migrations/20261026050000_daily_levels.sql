-- Daily is one business-English product in two levels, not a business track and a tech
-- track. The `track` column keeps its name and now holds the level:
--   basic     초중급  everyday meeting, email and report expressions
--   advanced  고급    the harder end of the same business range
-- Lessons cover consulting, finance, tech and consumer goods alike; `field` records which
-- one a lesson comes from, for the pill on the lesson page.
--
-- Existing data moves to 초중급, as decided: every subscription, trial claim, order and
-- review becomes 'basic'. Business lessons become 'basic' lessons. Tech lessons cannot
-- share their dates with them, so they become 'advanced' drafts (never sent), and 고급
-- starts empty until its own lessons are written.

alter table public.daily_lessons       drop constraint daily_lessons_track_check;
alter table public.daily_subscriptions drop constraint daily_subscriptions_track_check;
alter table public.daily_trial_claims  drop constraint daily_trial_claims_track_check;
alter table public.daily_reviews       drop constraint daily_reviews_track_check;
alter table public.daily_orders        drop constraint daily_orders_track_check;

update public.daily_lessons set track = 'advanced', status = 'draft' where track = 'tech';
update public.daily_lessons set track = 'basic' where track = 'business';

-- A free trial was once per number per track; one per number per level now. A number
-- that tried both old tracks keeps its earliest claim.
delete from public.daily_trial_claims t
 where t.track = 'tech'
   and exists (select 1 from public.daily_trial_claims b where b.recipient_phone = t.recipient_phone and b.track = 'business');
update public.daily_trial_claims set track = 'basic';

update public.daily_subscriptions set track = 'basic';
update public.daily_orders        set track = 'basic';
update public.daily_reviews       set track = 'basic';

alter table public.daily_lessons       add constraint daily_lessons_track_check       check (track in ('basic', 'advanced'));
alter table public.daily_subscriptions add constraint daily_subscriptions_track_check check (track in ('basic', 'advanced'));
alter table public.daily_trial_claims  add constraint daily_trial_claims_track_check  check (track in ('basic', 'advanced'));
alter table public.daily_reviews       add constraint daily_reviews_track_check       check (track in ('basic', 'advanced'));
alter table public.daily_orders        add constraint daily_orders_track_check        check (track in ('basic', 'advanced'));

alter table public.daily_lessons
  add column field text check (field is null or field in ('consulting', 'finance', 'tech', 'consumer'));

update public.daily_lessons set field = 'tech' where track = 'advanced' and status = 'draft';
