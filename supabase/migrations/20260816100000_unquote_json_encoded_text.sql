-- Data repair: text columns that were loaded JSON-encoded during the Firestore →
-- Postgres import (2026-08-16).
--
-- The loader wrote some Firestore string fields through JSON.stringify(), so the
-- stored value keeps its surrounding double quotes and escape sequences:
--   meetups.title        -> "영어 한잔 | 여의도"      (renders WITH the quotes)
--   blog_posts.content   -> "안녕하세요…\n\n매주…"    (renders a literal \n, not a line break)
-- Affected at the time of writing: meetups.title 75/75, blog_posts.title 8/8,
-- blog_posts.content 8/8, community_comments.content 2/2, community_topics.title 1/1,
-- community_topics.content 1/1. Every affected value parsed as a valid JSON string.
--
-- `value::jsonb #>> '{}'` decodes a JSON scalar string back to plain text. The guards
-- make this idempotent and skip anything that is not a JSON-encoded string, so
-- re-running it (or running it on already-clean data) is a no-op.

do $$
declare
  t record;
  n integer;
begin
  for t in
    select * from (values
      ('meetups',            'title'),
      ('blog_posts',         'title'),
      ('blog_posts',         'content'),
      ('community_comments', 'content'),
      ('community_topics',   'title'),
      ('community_topics',   'content')
    ) as v(tbl, col)
  loop
    execute format(
      'update public.%I set %I = (%I::jsonb #>> ''{}'')
        where %I like ''"%%"''
          and pg_input_is_valid(%I, ''jsonb'')
          and jsonb_typeof(%I::jsonb) = ''string''',
      t.tbl, t.col, t.col, t.col, t.col, t.col);
    get diagnostics n = row_count;
    raise notice 'unquoted %.%: % row(s)', t.tbl, t.col, n;
  end loop;
end $$;
