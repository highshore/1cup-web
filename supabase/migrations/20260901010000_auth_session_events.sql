-- Record why a sign-in ended.
--
-- Members report being signed out more often than they used to, and there is no way to
-- check. auth.sessions says a session stopped being refreshed but not whether the person
-- was logged out or simply did not come back, and it only goes back to the 17 August
-- cutover so there is no "before" to compare against. Every diagnosis so far has been a
-- reading of the code.
--
-- The browser is the only place that knows the difference between "I pressed sign out"
-- and "my session vanished underneath me", so that is what gets recorded.

create table if not exists public.auth_session_events (
  id          bigserial   primary key,
  uid         text,
  auth_id     uuid,
  event       text        not null,
  reason      text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

comment on table public.auth_session_events is
  'One row per session ending the client did not initiate. Written by '
  '/api/auth/session-event; never contains a token.';

create index if not exists auth_session_events_created_idx
  on public.auth_session_events (created_at desc);

-- Diagnostic data about members: service role only, same as the other ops tables.
alter table public.auth_session_events enable row level security;

-- Answers "is this getting worse", which is the question that could not be answered.
create or replace view public.auth_session_health as
  select date_trunc('day', created_at at time zone 'Asia/Seoul')::date as day,
         event,
         reason,
         count(*)                     as events,
         count(distinct uid)          as people
    from public.auth_session_events
   group by 1, 2, 3
   order by 1 desc, 4 desc;
