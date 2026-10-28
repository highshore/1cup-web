-- The first line of each lesson and review message ("#{name}님, #{hook}"), written per
-- reader by supabase/functions/daily/hooks.ts. Kept on the row so a retried send says the
-- same thing, and so we can see how often the model's line was used over the fixed pool.
alter table public.daily_deliveries
  add column hook text,
  add column hook_source text check (hook_source in ('ai', 'pool'));
