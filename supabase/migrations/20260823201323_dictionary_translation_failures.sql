-- Keeps permanently bad local-model outputs out of the hot translation queue.
-- This table is intentionally service-role only: translation jobs run server-side.
create table if not exists public.dictionary_translation_failures (
  meaning_id uuid primary key references public.dictionary_meanings(id) on delete cascade,
  failure_count integer not null default 1 check (failure_count > 0),
  last_error text not null,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists dictionary_translation_failures_last_attempt_idx
  on public.dictionary_translation_failures (last_attempt_at desc);

alter table public.dictionary_translation_failures enable row level security;

grant select, insert, update, delete on table public.dictionary_translation_failures to service_role;

create or replace function public.record_dictionary_translation_failure(
  p_meaning_id uuid,
  p_error text
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.dictionary_translation_failures (
    meaning_id,
    failure_count,
    last_error,
    last_attempt_at
  )
  values (p_meaning_id, 1, p_error, now())
  on conflict (meaning_id) do update
  set
    failure_count = public.dictionary_translation_failures.failure_count + 1,
    last_error = excluded.last_error,
    last_attempt_at = excluded.last_attempt_at;
$$;

revoke all on function public.record_dictionary_translation_failure(uuid, text) from public, anon, authenticated;
grant execute on function public.record_dictionary_translation_failure(uuid, text) to service_role;
