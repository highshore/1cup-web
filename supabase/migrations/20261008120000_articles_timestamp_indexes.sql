-- Article lists are always newest-first and had no supporting index, so every list read
-- sorted the whole table. Both indexes match PostgREST's `order=timestamp.desc.nullslast`.

-- Admin article list (/admin/articles): unfiltered, paginated.
create index if not exists articles_timestamp_desc_idx
  on public.articles ("timestamp" desc nulls last);

-- Home topics carousel: published articles only.
create index if not exists articles_published_timestamp_desc_idx
  on public.articles (publication_status, "timestamp" desc nulls last);
