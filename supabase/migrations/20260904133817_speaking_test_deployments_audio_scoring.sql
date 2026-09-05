-- Published Test Center sets are not automatically visible to learners. An
-- administrator explicitly deploys a set into one or more of the three public
-- choices shown on /speaking-test.
alter table public.exam_sets
  add column if not exists deployment_categories text[] not null default '{}'::text[],
  add column if not exists is_deployed boolean not null default false,
  add column if not exists deployed_at timestamp with time zone;

alter table public.exam_sets
  drop constraint if exists exam_sets_deployment_categories_check;
alter table public.exam_sets
  add constraint exam_sets_deployment_categories_check
  check (deployment_categories <@ array['topic', 'toefl', 'free']::text[]);

alter table public.exam_sets
  drop constraint if exists exam_sets_deployed_requires_published_check;
alter table public.exam_sets
  add constraint exam_sets_deployed_requires_published_check
  check (
    not is_deployed
    or (status = 'published' and cardinality(deployment_categories) > 0)
  );

create index if not exists exam_sets_deployed_categories_idx
  on public.exam_sets using gin (deployment_categories)
  where is_deployed = true;

-- An attempt is created before recording so uploads can use a narrow,
-- user-owned Storage prefix. Responses keep the original private audio,
-- Gemini 3.5 transcript, per-task scores, and the short evidence-based scoring
-- rationale that explains each score. We deliberately store auditable rubric
-- evidence rather than model chain-of-thought.
alter table public.exam_attempts
  add column if not exists report jsonb,
  add column if not exists scoring_metadata jsonb not null default '{}'::jsonb,
  add column if not exists transcription_model text,
  add column if not exists scoring_model text,
  add column if not exists overall_score numeric(5, 2),
  add column if not exists overall_band text,
  add column if not exists overall_cefr text,
  add column if not exists score_reasoning text,
  add column if not exists failed_at timestamp with time zone,
  add column if not exists failure_reason text;

alter table public.exam_attempts
  drop constraint if exists exam_attempts_status_check;
alter table public.exam_attempts
  add constraint exam_attempts_status_check
  check (status in ('in_progress', 'scoring', 'completed', 'abandoned', 'failed'));

create table public.exam_attempt_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  exam_set_item_id uuid not null references public.exam_set_items(id) on delete restrict,
  task_number smallint not null check (task_number between 1 and 20),
  module text not null check (module in ('listen_repeat', 'interview')),
  audio_path text not null check (char_length(audio_path) between 1 and 600),
  audio_mime_type text not null check (char_length(audio_mime_type) between 1 and 120),
  duration_seconds numeric(6, 2) not null check (duration_seconds between 0 and 180),
  transcript text not null default '',
  transcription jsonb not null default '{}'::jsonb,
  task_score numeric(4, 2) check (task_score between 0 and 5),
  rubric_scores jsonb not null default '{}'::jsonb,
  score_rationale text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (attempt_id, exam_set_item_id),
  unique (attempt_id, task_number)
);

create index exam_attempts_set_completed_idx
  on public.exam_attempts (exam_set_id, completed_at desc);
create index exam_attempts_user_completed_v2_idx
  on public.exam_attempts (user_id, completed_at desc);
create index exam_attempt_responses_attempt_task_idx
  on public.exam_attempt_responses (attempt_id, task_number);

alter table public.exam_attempt_responses enable row level security;

-- These rows are returned through purpose-built Next.js routes that verify the
-- caller. Keeping the raw rows off the Data API prevents a student from ever
-- enumerating another student's recordings or evaluation evidence.
revoke all on table public.exam_attempts from anon, authenticated;
revoke all on table public.exam_attempt_responses from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'speaking-test-audio',
  'speaking-test-audio',
  false,
  26214400,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "speaking test audio upload own prefix" on storage.objects;
create policy "speaking test audio upload own prefix"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'speaking-test-audio'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "speaking test audio read own prefix" on storage.objects;
create policy "speaking test audio read own prefix"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'speaking-test-audio'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "speaking test audio update own prefix" on storage.objects;
create policy "speaking test audio update own prefix"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'speaking-test-audio'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'speaking-test-audio'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "speaking test audio delete own prefix" on storage.objects;
create policy "speaking test audio delete own prefix"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'speaking-test-audio'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Preserve the existing published mock set as a ready-to-deploy TOEFL/free
-- test. It remains hidden until an admin explicitly deploys it from Test
-- Center; this migration never makes a user-facing test live by itself.
update public.exam_sets
set deployment_categories = array['toefl', 'free']::text[]
where id = 'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid
  and deployment_categories = '{}'::text[];
