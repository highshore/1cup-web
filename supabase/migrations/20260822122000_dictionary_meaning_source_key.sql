-- Every imported or generated dictionary meaning needs a stable source key so
-- imports can be safely re-run without creating duplicates.

drop index if exists public.dictionary_meanings_source_id_key;

alter table public.dictionary_meanings
  alter column source_meaning_id set not null;

alter table public.dictionary_meanings
  add constraint dictionary_meanings_source_id_key
  unique (source, source_meaning_id);
