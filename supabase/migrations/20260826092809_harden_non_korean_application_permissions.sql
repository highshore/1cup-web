-- RLS controls which application row a member may update. Restricting UPDATE
-- grants to contact columns also prevents a crafted client request from changing
-- the review status, which remains administrator-owned.
revoke update on table public.non_korean_applications from authenticated;
grant update (email, nationality, linkedin_url, updated_at)
  on table public.non_korean_applications to authenticated;

drop policy if exists "non-Korean applications admin manage"
  on public.non_korean_applications;

create policy "non-Korean applications admin read"
  on public.non_korean_applications
  for select to authenticated
  using (public.is_admin());
