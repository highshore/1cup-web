-- Harden internal health/diagnostic views.
-- These views are backend-only and must not bypass RLS or be exposed to browser roles.

alter view public.auth_session_health
  set (security_invoker = true);

alter view public.scheduler_health
  set (security_invoker = true);

revoke all on table public.auth_session_health
  from public, anon, authenticated;

revoke all on table public.scheduler_health
  from public, anon, authenticated;

grant select on table public.auth_session_health
  to service_role;

grant select on table public.scheduler_health
  to service_role;

-- Defense in depth for the underlying operational tables.
revoke all on table public.auth_session_events
  from public, anon, authenticated;

revoke all on table public.scheduler_heartbeats
  from public, anon, authenticated;

revoke all on table public.scheduler_alerts
  from public, anon, authenticated;
