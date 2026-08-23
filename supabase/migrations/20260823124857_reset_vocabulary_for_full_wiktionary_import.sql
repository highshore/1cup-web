-- Deliberate clean start for the Wiktextract-backed dictionary.
--
-- This removes the legacy global dictionary, every personal/deck/study record,
-- and the old users.saved_words collection. Article records and their keyword
-- strings are retained; they are source material for the later automatic
-- article_vocabulary mapping pass.

-- The legacy client bridge merges rather than clears saved_words, so it must be
-- removed before resetting the column.
drop trigger if exists preserve_legacy_saved_words_before_update on public.users;
drop trigger if exists sync_legacy_saved_words_after_write on public.users;
drop function if exists public.preserve_legacy_saved_words();
drop function if exists public.sync_legacy_saved_words_to_collection();

update public.users
set saved_words = '{}'::text[]
where coalesce(cardinality(saved_words), 0) > 0;

-- Delete every mutable vocabulary record. Keep the table structure, RLS, and
-- RPCs in place so the application can start using the fresh dictionary as soon
-- as its rows arrive.
truncate table
  public.vocabulary_review_events,
  public.vocabulary_study_cards,
  public.vocabulary_deck_study_preferences,
  public.vocabulary_deck_follows,
  public.vocabulary_deck_items,
  public.vocabulary_decks,
  public.article_vocabulary,
  public.user_vocabulary,
  public.dictionary_meanings,
  public.dictionary_entries,
  public.words
restart identity;
