-- The non-Korean member application now accepts LinkedIn or another HTTPS
-- credential URL. Keep the existing column name for backwards compatibility,
-- but relax the original LinkedIn-only check constraint.
alter table public.non_korean_applications
  drop constraint if exists non_korean_applications_linkedin_url_check;

alter table public.non_korean_applications
  add constraint non_korean_applications_linkedin_url_check
  check (
    char_length(btrim(linkedin_url)) between 10 and 500
    and btrim(linkedin_url) ~* '^https://[^[:space:]]+$'
  );
