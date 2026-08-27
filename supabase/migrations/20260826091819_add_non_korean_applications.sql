-- Long-term international applicants submit the contact details described on
-- /non-korean-applicants. A member may maintain one current application; its
-- data is visible only to that member and administrators.
create table public.non_korean_applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique references public.users(uid) on delete cascade,
  email text not null check (char_length(btrim(email)) between 3 and 320),
  nationality text not null check (char_length(btrim(nationality)) between 2 and 100),
  linkedin_url text not null check (
    char_length(btrim(linkedin_url)) between 10 and 500
    and btrim(linkedin_url) ~* '^https://([a-z0-9-]+\\.)*linkedin\\.com/'
  ),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index non_korean_applications_created_at_idx
  on public.non_korean_applications (created_at desc, id desc);

alter table public.non_korean_applications enable row level security;

-- New Supabase projects do not expose new tables through the Data API by
-- default, so make the authenticated access surface explicit and keep it RLS
-- protected. Anonymous users receive no access.
revoke all on table public.non_korean_applications from public, anon;
grant select, insert, update on table public.non_korean_applications to authenticated;

create policy "non-Korean applications own read"
  on public.non_korean_applications
  for select to authenticated
  using (user_id = public.current_uid());

create policy "non-Korean applications own submit"
  on public.non_korean_applications
  for insert to authenticated
  with check (user_id = public.current_uid());

create policy "non-Korean applications own update"
  on public.non_korean_applications
  for update to authenticated
  using (user_id = public.current_uid())
  with check (user_id = public.current_uid());

create policy "non-Korean applications admin manage"
  on public.non_korean_applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
