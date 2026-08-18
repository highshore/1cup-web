-- Supabase's project defaults grant new public-schema functions to API roles.
-- These relationship RPCs are deliberately member-only, so make the intended
-- grants explicit after the functions have been created.

revoke all on function public.profile_like_state(text) from public, anon;
revoke all on function public.toggle_profile_like(text) from public, anon;
revoke all on function public.mutual_profile_friends() from public, anon;

grant execute on function public.profile_like_state(text) to authenticated, service_role;
grant execute on function public.toggle_profile_like(text) to authenticated, service_role;
grant execute on function public.mutual_profile_friends() to authenticated, service_role;
