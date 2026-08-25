-- Persist finished practice tests separately from meetup speaking_reports.
-- Attempts own the report snapshot; response rows keep each transcript and timing
-- available for a future detailed-review screen without exposing either to peers.

create table public.speaking_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default public.current_uid()
    references public.users(uid) on delete cascade,
  test_version text not null,
  task_count smallint not null check (task_count between 1 and 20),
  overall_cefr text not null check (overall_cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  overall_band text not null,
  overall_score numeric(5, 2) not null check (overall_score between 0 and 100),
  report jsonb not null,
  completed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

create table public.speaking_test_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.speaking_test_attempts(id) on delete cascade,
  task_number smallint not null check (task_number between 1 and 20),
  task_kind text not null check (task_kind in ('listen_repeat', 'picture_description', 'interview')),
  transcript text not null,
  duration_seconds numeric(6, 2) not null check (duration_seconds >= 0 and duration_seconds <= 180),
  word_count integer not null check (word_count >= 0),
  created_at timestamp with time zone not null default now(),
  unique (attempt_id, task_number)
);

create index speaking_test_attempts_user_completed_idx
  on public.speaking_test_attempts (user_id, completed_at desc);
create index speaking_test_responses_attempt_idx
  on public.speaking_test_responses (attempt_id, task_number);

alter table public.speaking_test_attempts enable row level security;
alter table public.speaking_test_responses enable row level security;

revoke all on table public.speaking_test_attempts from anon, authenticated;
revoke all on table public.speaking_test_responses from anon, authenticated;
grant select on table public.speaking_test_attempts to authenticated;
grant select on table public.speaking_test_responses to authenticated;

create policy "members read their speaking test attempts"
  on public.speaking_test_attempts
  for select to authenticated
  using (user_id = public.current_uid());

create policy "members read their speaking test responses"
  on public.speaking_test_responses
  for select to authenticated
  using (
    exists (
      select 1
      from public.speaking_test_attempts attempts
      where attempts.id = speaking_test_responses.attempt_id
        and attempts.user_id = public.current_uid()
    )
  );
