-- Fix PL/pgSQL output-column ambiguity in register_for_meetup.
-- `registration_status` is also a RETURNS TABLE column, so the unqualified
-- meetup_participants predicate raised 42702 for normal member registrations.
create or replace function public.register_for_meetup(
  p_meetup_id text,
  p_role text default 'participant'
)
returns table (
  access_type text,
  registration_status text,
  credit_balance integer,
  credit_transaction_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid text := public.current_uid();
  v_user public.users%rowtype;
  v_meetup public.meetups%rowtype;
  v_existing public.meetup_participants%rowtype;
  v_source record;
  v_access text;
  v_credit_transaction_id uuid;
  v_count integer;
  v_has_existing boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_role not in ('participant', 'leader') then
    raise exception 'Invalid meetup role' using errcode = '22023';
  end if;

  select * into v_user
  from public.users u
  where u.uid = v_uid
  for update;
  if not found then
    raise exception 'Member record not found' using errcode = 'P0001';
  end if;

  select * into v_meetup
  from public.meetups m
  where m.id = p_meetup_id
  for update;
  if not found then
    raise exception 'Meetup not found' using errcode = 'P0001';
  end if;
  if v_meetup.cancelled_at is not null then
    raise exception 'This meetup has been cancelled' using errcode = 'P0001';
  end if;
  if v_meetup.date_time is not null and v_meetup.date_time <= now() then
    raise exception 'This meetup has already started' using errcode = 'P0001';
  end if;
  if v_meetup.date_time is not null
     and coalesce(v_meetup.lockdown_minutes, 0) > 0
     and v_meetup.date_time - make_interval(mins => v_meetup.lockdown_minutes) <= now() then
    raise exception 'Meetup registration is closed' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.meetup_participants mp
  where mp.meetup_id = p_meetup_id and mp.user_id = v_uid
  for update;
  v_has_existing := found;
  if found and v_existing.registration_status = 'registered' then
    raise exception 'You are already registered for this meetup' using errcode = '23505';
  end if;

  if p_role = 'leader' and not (public.is_admin() or v_user.account_status = 'leader') then
    raise exception 'Only a meetup leader or administrator can register as a leader' using errcode = '42501';
  end if;

  if p_role = 'leader'
     or public.is_admin()
     or v_user.account_status = 'leader'
     or v_user.gdg_member is true then
    v_access := 'complimentary';
  elsif v_user.has_active_subscription is true then
    v_access := 'subscription';
  else
    v_access := 'credit';
  end if;

  if p_role = 'participant' then
    select count(*) into v_count
    from public.meetup_participants mp
    where mp.meetup_id = p_meetup_id
      and mp.role = 'participant'
      and mp.registration_status = 'registered';
    if v_meetup.max_participants is not null and v_count >= v_meetup.max_participants then
      raise exception 'This meetup is full' using errcode = 'P0001';
    end if;
  end if;

  if v_access = 'credit' then
    for v_source in
      select
        source.id,
        source.expires_at,
        source.amount + coalesce(sum(child.amount), 0) as remaining
      from public.participation_credit_transactions source
      left join public.participation_credit_transactions child
        on child.related_transaction_id = source.id
      where source.user_id = v_uid
        and source.type in ('purchase', 'admin_grant', 'admin_adjustment')
        and source.amount > 0
        and (source.expires_at is null or source.expires_at > now())
      group by source.id, source.expires_at, source.amount, source.created_at
      having source.amount + coalesce(sum(child.amount), 0) >= 1
      order by source.expires_at nulls last, source.created_at, source.id
    loop
      insert into public.participation_credit_transactions (
        user_id, amount, type, meetup_id, related_transaction_id, expires_at, metadata
      ) values (
        v_uid, -1, 'registration', p_meetup_id, v_source.id, v_source.expires_at,
        jsonb_build_object('source', 'meetup_registration')
      ) returning id into v_credit_transaction_id;
      exit;
    end loop;

    if v_credit_transaction_id is null then
      raise exception 'A membership or at least one valid participation credit is required' using errcode = 'P0001';
    end if;
  end if;

  if v_has_existing then
    update public.meetup_participants mp
      set role = p_role,
          access_type = v_access,
          registration_status = 'registered',
          registered_at = now(),
          cancelled_at = null,
          credit_transaction_id = v_credit_transaction_id
      where mp.meetup_id = p_meetup_id and mp.user_id = v_uid;
  else
    insert into public.meetup_participants (
      meetup_id, user_id, role, access_type, registration_status, registered_at, credit_transaction_id
    ) values (
      p_meetup_id, v_uid, p_role, v_access, 'registered', now(), v_credit_transaction_id
    );
  end if;

  if p_role = 'participant' then
    update public.meetups m
      set current_participants = v_count + 1
      where m.id = p_meetup_id;
  end if;

  return query select
    v_access,
    'registered'::text,
    public.participation_credit_balance_for(v_uid),
    v_credit_transaction_id;
end;
$function$;
