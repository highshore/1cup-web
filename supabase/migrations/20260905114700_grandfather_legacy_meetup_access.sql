-- Existing active subscribers are grandfathered not only on price but also on the
-- pre-regional entitlement behavior. New regional_v2 subscriptions are restricted to
-- their purchased region; legacy subscriptions remain valid for either community.
do $migration$
declare
  v_definition text;
  v_old text := 'elsif v_user.has_active_subscription is true and v_user.location = v_meetup.region then';
  v_new text := 'elsif v_user.has_active_subscription is true and (v_user.pricing_version = ''legacy'' or v_user.location = v_meetup.region) then';
begin
  select pg_get_functiondef('public.register_for_meetup(text,text)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'Expected regional subscription predicate not found in register_for_meetup';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$migration$;
