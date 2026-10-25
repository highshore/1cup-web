-- Meetup cancellation tracking for the admin dashboard.
--
-- meetup_participants keeps one row per (meetup, member), and register_for_meetup
-- reuses that row when someone books again, wiping cancelled_at. To see who grabs a
-- slot and drops it close to the start, every registered -> cancelled transition is
-- copied into an append-only log by trigger, so all write paths (member RPC, operator
-- meetup cancellation, direct admin edits) are captured without touching the RPCs.

create table if not exists public.meetup_cancellation_events (
  id uuid primary key default gen_random_uuid(),
  meetup_id text not null,
  user_id text not null,
  role text not null,
  access_type text not null,
  registered_at timestamptz,
  cancelled_at timestamptz not null default now(),
  -- Snapshot: meetups can be rescheduled after the cancellation.
  meetup_starts_at timestamptz,
  credit_refunded boolean not null default false,
  -- member: the member cancelled their own booking. operator: the whole meetup was
  -- cancelled by an administrator. admin: someone else (or a service role) changed it.
  source text not null check (source in ('member', 'operator', 'admin')),
  actor_uid text,
  -- Reconstructed from the participant row at migration time; earlier cancellations
  -- that were followed by a re-registration are not recoverable.
  backfilled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists meetup_cancellation_events_cancelled_at_idx
  on public.meetup_cancellation_events (cancelled_at desc);
create index if not exists meetup_cancellation_events_user_idx
  on public.meetup_cancellation_events (user_id, cancelled_at desc);

alter table public.meetup_cancellation_events enable row level security;
drop policy if exists "meetup_cancellation_events admin read" on public.meetup_cancellation_events;
create policy "meetup_cancellation_events admin read"
  on public.meetup_cancellation_events
  for select to authenticated
  using (public.is_admin());
revoke all on public.meetup_cancellation_events from public, anon, authenticated;
grant select on public.meetup_cancellation_events to authenticated;
grant all on public.meetup_cancellation_events to service_role;

create or replace function public.log_meetup_cancellation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_meetup public.meetups%rowtype;
  v_actor text := public.current_uid();
  v_refunded boolean := false;
begin
  select * into v_meetup from public.meetups where id = new.meetup_id;

  -- Both cancellation RPCs write the refund before flipping the participant row.
  if old.credit_transaction_id is not null then
    select exists (
      select 1 from public.participation_credit_transactions t
      where t.type = 'registration_refund'
        and t.user_id = new.user_id
        and t.metadata ->> 'registration_transaction_id' = old.credit_transaction_id::text
    ) into v_refunded;
  end if;

  insert into public.meetup_cancellation_events (
    meetup_id, user_id, role, access_type, registered_at, cancelled_at,
    meetup_starts_at, credit_refunded, source, actor_uid
  ) values (
    new.meetup_id, new.user_id, coalesce(old.role, 'participant'), old.access_type,
    old.registered_at, coalesce(new.cancelled_at, now()), v_meetup.date_time, v_refunded,
    case
      when v_meetup.cancelled_at is not null then 'operator'
      when v_actor is not distinct from new.user_id then 'member'
      else 'admin'
    end,
    v_actor
  );
  return new;
end;
$function$;

revoke all on function public.log_meetup_cancellation() from public, anon, authenticated;

drop trigger if exists meetup_participants_log_cancellation on public.meetup_participants;
create trigger meetup_participants_log_cancellation
  after update of registration_status on public.meetup_participants
  for each row
  when (old.registration_status = 'registered' and new.registration_status = 'cancelled')
  execute function public.log_meetup_cancellation();

-- Backfill the cancellations still visible on participant rows.
insert into public.meetup_cancellation_events (
  meetup_id, user_id, role, access_type, registered_at, cancelled_at,
  meetup_starts_at, credit_refunded, source, backfilled
)
select
  p.meetup_id,
  p.user_id,
  coalesce(p.role, 'participant'),
  p.access_type,
  p.registered_at,
  p.cancelled_at,
  m.date_time,
  p.credit_transaction_id is not null and exists (
    select 1 from public.participation_credit_transactions t
    where t.type = 'registration_refund'
      and t.user_id = p.user_id
      and t.metadata ->> 'registration_transaction_id' = p.credit_transaction_id::text
  ),
  case
    when m.cancelled_at is not null
     and abs(extract(epoch from (p.cancelled_at - m.cancelled_at))) < 60 then 'operator'
    else 'member'
  end,
  true
from public.meetup_participants p
left join public.meetups m on m.id = p.meetup_id
where p.registration_status = 'cancelled'
  and p.cancelled_at is not null
  and not exists (
    select 1 from public.meetup_cancellation_events e
    where e.meetup_id = p.meetup_id and e.user_id = p.user_id and e.cancelled_at = p.cancelled_at
  );

-- Admin report: one row per cancellation with what the member did that week.
-- "Joined" means a booking that was still registered when the meetup locked; the
-- product has no physical check-in, so this is not verified attendance.
create or replace function public.admin_meetup_cancellation_report(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  event_id uuid,
  cancelled_at timestamptz,
  registered_at timestamptz,
  source text,
  role text,
  access_type text,
  credit_refunded boolean,
  backfilled boolean,
  user_id text,
  display_name text,
  email text,
  phone text,
  meetup_id text,
  meetup_title text,
  meetup_location text,
  meetup_starts_at timestamptz,
  meetup_cancelled boolean,
  rejoined_same_meetup boolean,
  same_week_meetups jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.cancelled_at,
    e.registered_at,
    e.source,
    e.role,
    e.access_type,
    e.credit_refunded,
    e.backfilled,
    e.user_id,
    u.display_name,
    u.email,
    u.phone,
    e.meetup_id,
    m.title,
    m.location_name,
    coalesce(m.date_time, e.meetup_starts_at),
    m.cancelled_at is not null,
    exists (
      select 1 from public.meetup_participants p
      where p.meetup_id = e.meetup_id and p.user_id = e.user_id
        and p.registration_status = 'registered'
    ),
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', om.id, 'title', om.title, 'starts_at', om.date_time)
        order by om.date_time
      )
      from public.meetup_participants op
      join public.meetups om on om.id = op.meetup_id
      where op.user_id = e.user_id
        and op.meetup_id <> e.meetup_id
        and op.registration_status = 'registered'
        and om.cancelled_at is null
        and om.date_time is not null
        and date_trunc('week', om.date_time at time zone 'Asia/Seoul')
          = date_trunc('week', coalesce(m.date_time, e.meetup_starts_at) at time zone 'Asia/Seoul')
    ), '[]'::jsonb)
  from public.meetup_cancellation_events e
  left join public.users u on u.uid = e.user_id
  left join public.meetups m on m.id = e.meetup_id
  where e.cancelled_at >= p_from
    and e.cancelled_at < p_to
  order by e.cancelled_at desc;
end;
$function$;

revoke all on function public.admin_meetup_cancellation_report(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_meetup_cancellation_report(timestamptz, timestamptz) to authenticated;
