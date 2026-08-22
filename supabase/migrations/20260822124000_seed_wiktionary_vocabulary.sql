-- Initial Wiktionary/Wiktextract seed. These are intentionally small, verified
-- examples from current article vocabulary; the bulk importer handles scale.
-- Wiktionary text: CC BY-SA 4.0 / GFDL.

with seeded_entries(term, normalized_term, entry_type, source_url) as (
  values
    ('discreet','discreet','word','https://en.wiktionary.org/wiki/discreet'),
    ('overtly','overtly','word','https://en.wiktionary.org/wiki/overtly'),
    ('inadvertently','inadvertently','word','https://en.wiktionary.org/wiki/inadvertently')
)
insert into public.dictionary_entries (
  term, normalized_term, entry_type, language_code, source, source_url,
  source_license, source_dataset, source_metadata, updated_at
)
select term, normalized_term, entry_type, 'en', 'wiktionary', source_url,
       'CC BY-SA 4.0 / GFDL', 'wiktextract/kaikki-manual-seed',
       jsonb_build_object('checked_at','2026-08-22'), now()
from seeded_entries
on conflict (language_code, normalized_term) do update set
  source='wiktionary',
  source_url=excluded.source_url,
  source_license=excluded.source_license,
  source_dataset=excluded.source_dataset,
  source_metadata=excluded.source_metadata,
  updated_at=now();

insert into public.dictionary_meanings (
  entry_id, source_meaning_id, grammar_type, definition_en, definition_ko,
  pronunciation_ipa, meaning_order, source, source_url, source_license,
  source_dataset, source_metadata, is_verified, updated_at
)
select e.id, seed.source_meaning_id, seed.grammar_type, seed.definition_en,
       seed.definition_ko, seed.ipa, seed.meaning_order, 'wiktionary',
       'https://en.wiktionary.org/wiki/' || replace(seed.term, ' ', '_'),
       'CC BY-SA 4.0 / GFDL', 'wiktextract/kaikki-manual-seed',
       jsonb_build_object('checked_at','2026-08-22','seed_method','manual_verified_from_kaikki'),
       false, now()
from (
  values
    ('discreet','en-discreet-en-adj-r6eGeBVQ','adjective',
     'Respectful of privacy or secrecy; exercising caution in order to avoid causing embarrassment; quiet; diplomatic.',
     '사생활이나 비밀을 존중하며, 다른 사람을 당황하게 하지 않도록 신중하고 조심스러운.',
     '/dɪˈskɹiːt/',0),
    ('discreet','en-discreet-en-adj-fI207K3D','adjective',
     'Not drawing attention, anger or challenge; inconspicuous.',
     '눈에 띄거나 주의를 끌지 않는; 두드러지지 않는.',
     '/dɪˈskɹiːt/',1),
    ('overtly','manual:overtly:adv:1','adverb',
     'In an overt manner; publicly; openly.',
     '숨기거나 감추지 않고 명백하고 공개적으로.',
     null,0),
    ('inadvertently','manual:inadvertently:adv:1','adverb',
     'Unintentionally; because of an oversight.',
     '의도하지 않게; 부주의나 실수로.',
     null,0)
) as seed(term, source_meaning_id, grammar_type, definition_en, definition_ko, ipa, meaning_order)
join public.dictionary_entries e
  on e.language_code='en' and e.normalized_term=seed.term
on conflict (source, source_meaning_id) do update set
  entry_id=excluded.entry_id,
  grammar_type=excluded.grammar_type,
  definition_en=excluded.definition_en,
  definition_ko=excluded.definition_ko,
  pronunciation_ipa=excluded.pronunciation_ipa,
  meaning_order=excluded.meaning_order,
  source_url=excluded.source_url,
  source_license=excluded.source_license,
  source_dataset=excluded.source_dataset,
  source_metadata=excluded.source_metadata,
  updated_at=now();
