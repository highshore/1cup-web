-- Signing in from the Kakao message button.
--
-- Every delivery already carries a random access_token in its button link. Opening that
-- link now also signs the browser in as the subscriber, so the Kakao in-app browser
-- knows who is reading without a phone code. A forwarded link signs its holder in too,
-- so these sessions get the narrower 'link' scope: enough for what only touches the
-- reader's own learning (reviews, and later the sentence wall and streaks), not for
-- anything that records consent or moves money. Starting a trial, paying and turning off
-- auto-renew ask for the phone code once, which replaces the link session with a
-- 'phone' one.
--
-- Additive only: existing sessions all came from a phone code and default to 'phone'.

alter table public.daily_sessions
  add column scope text not null default 'phone' check (scope in ('phone', 'link')),
  add column delivery_id uuid references public.daily_deliveries (id) on delete set null;
