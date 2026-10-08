-- Read-only snapshot of pg_stat_statements, matching the dashboard's Query Performance tab
-- (all roles, ranked by total time). Run before and after a change, resetting in between:
--
--   npx supabase@2.115.0 db query --linked -f scripts/perf/query-performance-snapshot.sql
--
-- `inspect db outliers` is not a substitute: it hides Supabase-internal roles, which is
-- where realtime.list_changes runs.

with totals as (
  select sum(total_exec_time) as total_ms, sum(calls) as total_calls
  from extensions.pg_stat_statements
)
select
  (select stats_reset from extensions.pg_stat_statements_info) as stats_since,
  now() as captured_at,
  r.rolname as role,
  round((s.total_exec_time / t.total_ms * 100)::numeric, 2) as pct_time,
  round((s.total_exec_time / 1000)::numeric, 1) as total_s,
  s.calls,
  round(s.mean_exec_time::numeric, 2) as mean_ms,
  round(s.max_exec_time::numeric, 1) as max_ms,
  s.rows,
  left(regexp_replace(s.query, '\s+', ' ', 'g'), 160) as query
from extensions.pg_stat_statements s
join pg_roles r on r.oid = s.userid
cross join totals t
order by s.total_exec_time desc
limit 20;
