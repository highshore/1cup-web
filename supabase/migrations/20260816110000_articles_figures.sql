-- articles.figures was dropped by the Firestore import.
--
-- The article page renders inline figures (photos recreated by AI, charts kept as the
-- original crop) from `article.figures` — see ArticleClient.tsx — but the imported
-- schema has no such column, so `select *` returned undefined and the figures silently
-- disappeared. 5 of the 486 Firestore articles carried figures (3 pipeline samples plus
-- 2 real articles); this restores the column so they can be backfilled and so
-- scripts/upload-sample-articles.mjs can keep writing them.
alter table public.articles add column if not exists figures jsonb;

comment on column public.articles.figures is
  'Inline figures from the 1cup_article OCR pipeline: [{kind, caption{english,korean}, '
  'image_prompt, bbox, block_type, source_block_index, original_url, generated_url, '
  'display_url, is_hero}]';
