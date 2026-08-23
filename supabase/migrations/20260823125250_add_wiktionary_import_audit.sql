-- Service-role-only audit for the full Wiktextract import. The importer is
-- intentionally streaming/idempotent, so this reports the committed database
-- state rather than client-side attempt counters.
create or replace function public.get_wiktionary_import_audit()
returns table (metric text, value bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select 'wiktionary_entries', count(*)
  from public.dictionary_entries
  where source = 'wiktionary'

  union all

  select 'wiktionary_meanings', count(*)
  from public.dictionary_meanings
  where source = 'wiktionary'

  union all

  select 'wiktionary_entries_without_meanings', count(*)
  from public.dictionary_entries e
  where e.source = 'wiktionary'
    and not exists (
      select 1
      from public.dictionary_meanings dm
      where dm.entry_id = e.id
        and dm.source = 'wiktionary'
    )

  union all

  select 'duplicate_wiktionary_source_keys', count(*)
  from (
    select source_meaning_id
    from public.dictionary_meanings
    where source = 'wiktionary'
    group by source_meaning_id
    having count(*) > 1
  ) duplicates

  union all

  select 'legacy_entries_remaining', count(*)
  from public.dictionary_entries
  where source like 'one_cup_%'

  union all

  select 'legacy_meanings_remaining', count(*)
  from public.dictionary_meanings
  where source like 'one_cup_%'

  union all

  select 'saved_vocabulary_records', count(*)
  from public.user_vocabulary

  union all

  select 'deck_records', count(*)
  from public.vocabulary_decks

  union all

  select 'study_card_records', count(*)
  from public.vocabulary_study_cards;
$$;

revoke all on function public.get_wiktionary_import_audit() from public;
grant execute on function public.get_wiktionary_import_audit() to service_role;
