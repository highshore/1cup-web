-- article_meanings: remove the unconditional member write policies.
--
-- 20260816090000 left "meanings insert"/"meanings update" as `with check (true)` for
-- authenticated, noting that the proper hardening was to move the write behind a
-- server route. Until then any signed-in member could insert or overwrite any row in
-- a cache that every reader of an article sees, so one account could replace the
-- definitions shown to everyone else.
--
-- The article reader no longer writes this table from the browser: definitions are
-- fetched through /api/shadow/openai, which caches the provider's response with the
-- service-role client. Member roles keep select (the cache is public to read) and
-- lose insert/update; admins keep delete for moderation. service_role bypasses RLS,
-- so no replacement write policy is needed.

drop policy if exists "meanings insert" on public.article_meanings;
drop policy if exists "meanings update" on public.article_meanings;

revoke insert, update on public.article_meanings from anon, authenticated;

-- Reads stay public: the "meanings read" policy from the baseline is unchanged, and
-- the delete-for-admins policy from 20260816090000 still applies.
