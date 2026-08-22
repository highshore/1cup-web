-- Rich vocabulary media fields used by the vocabulary deck experience.
-- This migration is additive only. Legacy dictionary rows are intentionally not
-- deleted here; cleanup happens only after Wiktionary coverage is verified.

alter table public.vocabulary_decks
  add column if not exists cover_image_url text,
  add column if not exists cover_image_attribution text;

alter table public.dictionary_meanings
  add column if not exists example_en text,
  add column if not exists example_ko text,
  add column if not exists audio_url text,
  add column if not exists image_url text,
  add column if not exists media_attribution jsonb not null default '{}'::jsonb;

create index if not exists dictionary_meanings_source_entry_idx
  on public.dictionary_meanings(source, entry_id, meaning_order);

comment on column public.dictionary_meanings.example_en is
  'Short usage example. Wiktionary imports only keep editor-style examples without external quotation metadata.';
comment on column public.dictionary_meanings.audio_url is
  'Pronunciation audio URL when supplied by the source dataset.';
comment on column public.dictionary_meanings.image_url is
  'Optional illustrative media URL. Individual media attribution is stored separately.';
comment on column public.dictionary_meanings.media_attribution is
  'Per-media provenance/license metadata. Do not assume the dictionary text license covers media files.';
