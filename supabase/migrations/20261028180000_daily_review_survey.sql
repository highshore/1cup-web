-- The Daily review page asks the 1cup feedback questions too, and the review is shown
-- under the writer's 소속·직종 and family-name initial ("삼성전자 재무·회계 김00 님")
-- instead of a name they type (terms 제9조의3).
--
--   * q_continue / q_recommend / q_miss: 1–5, required on the page (old rows stay null).
--   * q_hardest / q_suggestion: free text, optional. None of the five is ever public.
--   * display_name: now the label built on the server from 소속, 직종 and the Kakao name,
--     kept as written so a later 내 계정 edit doesn't change an approved review. Up to 80.
--
-- Additive only, plus a wider display_name check.

alter table public.daily_reviews
  add column if not exists q_continue   smallint check (q_continue between 1 and 5),
  add column if not exists q_recommend  smallint check (q_recommend between 1 and 5),
  add column if not exists q_miss       smallint check (q_miss between 1 and 5),
  add column if not exists q_hardest    text check (q_hardest is null or length(q_hardest) <= 300),
  add column if not exists q_suggestion text check (q_suggestion is null or length(q_suggestion) <= 300);

alter table public.daily_reviews drop constraint if exists daily_reviews_display_name_check;
alter table public.daily_reviews
  add constraint daily_reviews_display_name_check check (display_name is null or length(display_name) <= 80);
