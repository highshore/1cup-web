# Query Performance baseline: 2026-10-08

Captured before applying the realtime / admin-articles fixes from PR #119
(`20261008120000_articles_timestamp_indexes.sql`), immediately before resetting the
Query Performance report.

- Source: `pg_stat_statements`, all roles. Same data as the dashboard's Query Performance tab.
- Query: [`scripts/perf/query-performance-snapshot.sql`](../../scripts/perf/query-performance-snapshot.sql)
- Stats window: 2026-08-23 21:00 → 2026-10-08 00:09 UTC (**45.1 days**)
- Total recorded execution time: **4.60 h** (≈ **367 s/day**)
- Dashboard header at capture: 104 slow queries, 100.00% cache hit rate, 9.0 avg rows/call

Timeline (UTC, 2026-10-08):

| Time | Event |
|---|---|
| 00:07:41 | Vercel production deploy of PR #119 (home realtime removal, admin article fetch) completed |
| 00:09:52 | This baseline captured |
| ~00:12 | Index migration `20261008120000_articles_timestamp_indexes.sql` applied with `db push` |
| 00:13:56 | `pg_stat_statements` reset from the dashboard; after-window starts here |

The after-window will be much shorter than 45 days, so compare the **per-day** columns,
not totals. Percentages are each query's share of total recorded time.

## Top 20 by total execution time

| # | Query | Role | % time | Total s | s/day | Calls | Calls/day | Mean ms | Max ms |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Realtime change polling (`realtime.list_changes`) | supabase_admin | 71.43 | 11,825 | 262.0 | 1,998,615 | 44,284 | 5.92 | 7987.4 |
| 2 | Cron → article processing `net.http_post` | postgres | 4.90 | 811 | 18.0 | 64,942 | 1,439 | 12.49 | 237.7 |
| 3 | Cron → shadow processing `net.http_post` | postgres | 4.27 | 707 | 15.7 | 59,490 | 1,318 | 11.89 | 307.4 |
| 4 | Realtime broadcast `realtime.messages` lookup | authenticated | 3.17 | 525 | 11.6 | 83,836 | 1,858 | 6.26 | 127.8 |
| 5 | PostgREST schema reload: `pg_timezone_names` | authenticator | 2.90 | 480 | 10.6 | 2,833 | 63 | 169.48 | 1200.0 |
| 6 | Cron → marketing `net.http_post` | postgres | 2.24 | 371 | 8.2 | 19,482 | 432 | 19.04 | 295.8 |
| 7 | Cron → other `net.http_post` | postgres | 1.89 | 313 | 6.9 | 32,606 | 722 | 9.61 | 206.8 |
| 8 | `process_due_notification_templates()` | postgres | 0.99 | 164 | 3.6 | 12,988 | 288 | 12.61 | 233.3 |
| 9 | PostgREST schema reload: types/columns | authenticator | 0.72 | 120 | 2.7 | 2,833 | 63 | 42.24 | 447.3 |
| 10 | `check_scheduler_health()` | postgres | 0.60 | 100 | 2.2 | 4,175 | 93 | 23.83 | 193.1 |
| 11 | `select * from articles order by timestamp` (admin) | authenticated | 0.38 | 62 | 1.4 | 96 | 2 | 648.67 | 1322.5 |
| 12 | PostgREST RPC `article_processing_scheduler_secret` | service_role | 0.37 | 61 | 1.3 | 64,944 | 1,439 | 0.94 | 55.2 |
| 13 | PostgREST schema reload: types/columns | authenticator | 0.34 | 57 | 1.3 | 2,554 | 57 | 22.26 | 145.1 |
| 14 | `select * from meetups` (service role) | service_role | 0.32 | 53 | 1.2 | 13,567 | 301 | 3.91 | 91.5 |
| 15 | pg_cron bookkeeping (insert) | supabase_admin | 0.28 | 46 | 1.0 | 193,722 | 4,292 | 0.24 | 77.3 |
| 16 | pg_cron bookkeeping (update) | supabase_admin | 0.28 | 46 | 1.0 | 193,722 | 4,292 | 0.24 | 305.3 |
| 17 | pg_cron bookkeeping (update) | supabase_admin | 0.25 | 41 | 0.9 | 193,722 | 4,292 | 0.21 | 109.0 |
| 18 | pg_cron bookkeeping (update) | supabase_admin | 0.22 | 37 | 0.8 | 193,722 | 4,292 | 0.19 | 159.9 |
| 19 | PostgREST schema reload: pk/fk | authenticator | 0.19 | 32 | 0.7 | 2,833 | 63 | 11.31 | 83.8 |
| 20 | Realtime publication table lookup | supabase_admin | 0.17 | 28 | 0.6 | 34,474 | 764 | 0.81 | 32.8 |

## What to compare after the change

| Metric | Baseline | Expected after |
|---|---|---|
| `realtime.list_changes` calls/day | 44,284 | Lower: home page no longer opens a channel per visitor |
| `realtime.list_changes` s/day | 262 | Lower |
| Total DB time s/day | 367 | Lower |
| Admin `select * from articles` mean | 648.67 ms (96 calls) | Gone from the top list; admin article list uses 6 columns + index |

Raw rows: [`2026-10-08-query-performance-baseline.json`](./2026-10-08-query-performance-baseline.json)

## How to take the after snapshot

```bash
npx supabase@2.115.0 db query --linked -f scripts/perf/query-performance-snapshot.sql --output-format json
```

Wait at least a few days of normal traffic so the per-day rates are meaningful.
