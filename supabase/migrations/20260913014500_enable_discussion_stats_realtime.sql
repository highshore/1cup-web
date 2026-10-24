-- Discussion-topic scores are consumed through Supabase Realtime in ArticleClient.
-- The table existed with public SELECT RLS, but was never added to the
-- supabase_realtime publication, so postgres_changes subscriptions connected
-- successfully without receiving score updates.

do $$ begin
  alter publication supabase_realtime add table public.article_discussion_stats;
exception when duplicate_object then null;
end $$;
