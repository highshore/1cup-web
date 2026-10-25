-- 영어 한잔 Daily reviews: written by verified Daily customers, shown only after the
-- founder approves them.
--
-- Verified means: signed in with a Daily phone code, and at least one lesson was
-- actually delivered to that customer (checked by the server before insert). One review
-- per customer; they can rewrite it until it is approved.
--
-- Approving (until an admin screen exists):
--   update public.daily_reviews set status = 'approved', approved_at = now() where id = '…';
-- Hiding an approved review:
--   update public.daily_reviews set status = 'hidden' where id = '…';
-- The landing page shows the section only once 3 or more reviews are approved.
create table public.daily_reviews (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null unique references public.daily_customers (id) on delete cascade,
  track        text not null check (track in ('business', 'tech')),
  rating       smallint not null check (rating between 1 and 5),
  body         text not null check (length(btrim(body)) between 10 and 300),
  -- Null shows as 익명.
  display_name text check (display_name is null or length(display_name) <= 12),
  -- Lessons received when the review was written, shown as "레슨 n개 받음".
  lessons_received integer not null default 0,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index daily_reviews_approved on public.daily_reviews (approved_at desc) where status = 'approved';

create trigger daily_reviews_touch before update on public.daily_reviews
  for each row execute function private.daily_touch_updated_at();

-- Server only, like the other Daily customer tables.
alter table public.daily_reviews enable row level security;
