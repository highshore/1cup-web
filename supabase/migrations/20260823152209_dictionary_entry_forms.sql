-- Keep inflected/derived spellings as aliases of a dictionary entry instead of
-- creating empty entries for form-of records (for example, ached -> ache).
create table if not exists public.dictionary_entry_forms (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.dictionary_entries(id) on delete cascade,
  form text not null,
  normalized_form text not null,
  language_code text not null default 'en',
  form_tags text[] not null default '{}'::text[],
  source text not null default 'wiktionary',
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dictionary_entry_forms_entry_normalized_key unique (entry_id, normalized_form)
);

create index if not exists dictionary_entry_forms_search_idx
  on public.dictionary_entry_forms(language_code, normalized_form);

alter table public.dictionary_entry_forms enable row level security;

drop policy if exists "dictionary entry forms read" on public.dictionary_entry_forms;
create policy "dictionary entry forms read" on public.dictionary_entry_forms
  for select to anon, authenticated using (true);

drop policy if exists "dictionary entry forms admin write" on public.dictionary_entry_forms;
create policy "dictionary entry forms admin write" on public.dictionary_entry_forms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The vocabulary reset intentionally removed all member vocabulary state, so
-- these rows are unreferenced and can be removed safely. The importer now
-- avoids re-creating entries unless it has a usable, non-form Wiktionary sense.
delete from public.dictionary_entries e
where e.source = 'wiktionary'
  and not exists (
    select 1
    from public.dictionary_meanings dm
    where dm.entry_id = e.id
      and dm.source = 'wiktionary'
  );
