-- Participation credits are a separate entitlement from recurring membership.
-- The ledger below is deliberately append-only: it is the audit trail and source of
-- truth, while the balance view is only a convenience projection.

alter table public.payment_orders
  add column if not exists product_id text,
  add column if not exists credit_quantity integer,
  add column if not exists credit_valid_until timestamptz,
  add column if not exists fulfillment_order_number text;

create unique index if not exists payment_orders_fulfillment_order_number_key
  on public.payment_orders (fulfillment_order_number)
  where fulfillment_order_number is not null;

create table if not exists public.participation_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid),
  amount integer not null,
  type text not null,
  payment_order_id text references public.payment_orders(order_number) on delete restrict,
  meetup_id text references public.meetups(id) on delete restrict,
  related_transaction_id uuid references public.participation_credit_transactions(id) on delete restrict,
  -- A purchase and every transaction allocated to that purchase share the same
  -- expiry. That makes expired packs disappear as a complete accounting bucket
  -- instead of leaving their historical -1 registrations in the live balance.
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint participation_credit_transactions_type_check check (
    type in (
      'purchase',
      'registration',
      'registration_refund',
      'payment_refund',
      'admin_grant',
      'admin_adjustment'
    )
  ),
  constraint participation_credit_transactions_amount_check check (
    (type = 'purchase' and amount > 0 and payment_order_id is not null)
    or (type = 'registration' and amount = -1 and meetup_id is not null)
    or (type = 'registration_refund' and amount = 1 and meetup_id is not null)
    or (type = 'payment_refund' and amount < 0 and payment_order_id is not null)
    or (type = 'admin_grant' and amount > 0)
    or (type = 'admin_adjustment' and amount <> 0)
  )
);

create unique index if not exists participation_credit_purchase_once_per_order_idx
  on public.participation_credit_transactions (payment_order_id)
  where type = 'purchase' and payment_order_id is not null;

create unique index if not exists participation_credit_payment_refund_once_per_order_idx
  on public.participation_credit_transactions (payment_order_id)
  where type = 'payment_refund' and payment_order_id is not null;

create index if not exists participation_credit_transactions_user_created_idx
  on public.participation_credit_transactions (user_id, created_at desc);
create index if not exists participation_credit_transactions_source_idx
  on public.participation_credit_transactions (related_transaction_id)
  where related_transaction_id is not null;
create index if not exists participation_credit_transactions_meetup_idx
  on public.participation_credit_transactions (meetup_id, user_id)
  where meetup_id is not null;

alter table public.participation_credit_transactions enable row level security;

drop policy if exists "participation credits own history" on public.participation_credit_transactions;
create policy "participation credits own history"
on public.participation_credit_transactions
for select to authenticated
using (user_id = public.current_uid() or public.is_admin());

-- No browser role receives a write policy. Every mutation runs through a locked
-- database function or the service-role payment fulfilment path.
revoke all on public.participation_credit_transactions from anon, authenticated;
grant select on public.participation_credit_transactions to authenticated;
grant all on public.participation_credit_transactions to service_role;

alter table public.meetup_participants
  add column if not exists access_type text,
  add column if not exists registration_status text,
  add column if not exists registered_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists credit_transaction_id uuid references public.participation_credit_transactions(id) on delete restrict;

-- Existing rows predate participation credits. Preserve them without inventing a
-- source or timestamp that cannot be reconstructed reliably.
update public.meetup_participants
set access_type = coalesce(access_type, 'legacy'),
    registration_status = coalesce(registration_status, 'registered');

alter table public.meetup_participants
  alter column access_type set default 'legacy',
  alter column access_type set not null,
  alter column registration_status set default 'registered',
  alter column registration_status set not null;

do $$ begin
  alter table public.meetup_participants
    add constraint meetup_participants_access_type_check
    check (access_type in ('subscription', 'credit', 'complimentary', 'legacy'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.meetup_participants
    add constraint meetup_participants_registration_status_check
    check (registration_status in ('registered', 'cancelled'));
exception when duplicate_object then null; end $$;

alter table public.meetups
  add column if not exists cancelled_at timestamptz;

-- Direct join/delete policies made capacity and credit accounting inherently racy.
-- Existing public reads remain for avatar stacks and public meetup pages; writes go
-- through the RPCs below (including administrators and leaders).
drop policy if exists "join self" on public.meetup_participants;
drop policy if exists "leave self" on public.meetup_participants;
drop policy if exists "meetup_participants admin write" on public.meetup_participants;
create policy "meetup_participants admin write"
on public.meetup_participants
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
revoke insert, update, delete on public.meetup_participants from anon, authenticated;
grant select, insert, update, delete on public.meetup_participants to authenticated;
grant select on public.meetup_participants to anon;

create or replace function public.participation_credit_balance_for(
  p_user_id text,
  p_as_of timestamptz default now()
)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(sum(t.amount) filter (
    where t.expires_at is null or t.expires_at > p_as_of
  ), 0)::integer
  from public.participation_credit_transactions t
  where t.user_id = p_user_id;
$function$;

create or replace view public.participation_credit_balances
with (security_invoker = true)
as
  select
    t.user_id,
    coalesce(sum(t.amount) filter (where t.expires_at is null or t.expires_at > now()), 0)::integer as balance,
    min(t.expires_at) filter (where t.amount > 0 and t.expires_at > now()) as next_expiry_at
  from public.participation_credit_transactions t
  group by t.user_id;

revoke all on public.participation_credit_balances from public, anon;
grant select on public.participation_credit_balances to authenticated, service_role;

-- Locks a user row before credit allocation. All callers that can spend, refund,
-- fulfil, or manually adjust a balance take this same lock, preventing negative
-- balances under concurrent tabs and payment retries.
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

  select * into v_user from public.users where uid = v_uid for update;
  if not found then
    raise exception 'Member record not found' using errcode = 'P0001';
  end if;
  select * into v_meetup from public.meetups where id = p_meetup_id for update;
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
  from public.meetup_participants
  where meetup_id = p_meetup_id and user_id = v_uid
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
    -- Keep this criterion intentionally narrow. Credits never change the
    -- subscription flag or any other subscription-only authorization.
    v_access := 'subscription';
  else
    v_access := 'credit';
  end if;

  if p_role = 'participant' then
    select count(*) into v_count
    from public.meetup_participants
    where meetup_id = p_meetup_id
      and role = 'participant'
      and registration_status = 'registered';
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
    update public.meetup_participants
      set role = p_role,
          access_type = v_access,
          registration_status = 'registered',
          registered_at = now(),
          cancelled_at = null,
          credit_transaction_id = v_credit_transaction_id
      where meetup_id = p_meetup_id and user_id = v_uid;
  else
    insert into public.meetup_participants (
      meetup_id, user_id, role, access_type, registration_status, registered_at, credit_transaction_id
    ) values (
      p_meetup_id, v_uid, p_role, v_access, 'registered', now(), v_credit_transaction_id
    );
  end if;

  if p_role = 'participant' then
    update public.meetups
      set current_participants = v_count + 1
      where id = p_meetup_id;
  end if;

  return query select
    v_access,
    'registered'::text,
    public.participation_credit_balance_for(v_uid),
    v_credit_transaction_id;
end;
$function$;

create or replace function public.meetup_cancellation_quote(p_meetup_id text)
returns table (
  cancellation_allowed boolean,
  credit_will_be_refunded boolean,
  access_type text,
  message text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid text := public.current_uid();
  v_meetup public.meetups%rowtype;
  v_participant public.meetup_participants%rowtype;
  v_allowed boolean := true;
  v_refund boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_meetup from public.meetups where id = p_meetup_id;
  select * into v_participant from public.meetup_participants
   where meetup_id = p_meetup_id and user_id = v_uid;
  if not found or v_participant.registration_status <> 'registered' then
    return query select false, false, coalesce(v_participant.access_type, 'legacy'), 'No active meetup registration';
    return;
  end if;
  if v_meetup.date_time is not null and (
    v_meetup.date_time <= now()
    or (coalesce(v_meetup.lockdown_minutes, 0) > 0
      and v_meetup.date_time - make_interval(mins => v_meetup.lockdown_minutes) <= now())
  ) then
    v_allowed := false;
  end if;
  v_refund := v_allowed
    and v_participant.access_type = 'credit'
    and v_meetup.date_time is not null
    and now() < v_meetup.date_time - interval '24 hours';
  return query select
    v_allowed,
    v_refund,
    v_participant.access_type,
    case
      when not v_allowed then 'Meetup cancellation is closed'
      when v_refund then 'One participation credit will be restored'
      when v_participant.access_type = 'credit' then 'This cancellation is within 24 hours, so no credit will be restored'
      else 'Your registration will be cancelled'
    end;
end;
$function$;

create or replace function public.cancel_meetup_registration(p_meetup_id text)
returns table (
  access_type text,
  credit_refunded boolean,
  credit_balance integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid text := public.current_uid();
  v_user public.users%rowtype;
  v_meetup public.meetups%rowtype;
  v_participant public.meetup_participants%rowtype;
  v_registration public.participation_credit_transactions%rowtype;
  v_refund boolean := false;
  v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_user from public.users where uid = v_uid for update;
  select * into v_meetup from public.meetups where id = p_meetup_id for update;
  if not found then raise exception 'Meetup not found' using errcode = 'P0001'; end if;
  select * into v_participant from public.meetup_participants
    where meetup_id = p_meetup_id and user_id = v_uid for update;
  if not found or v_participant.registration_status <> 'registered' then
    raise exception 'No active meetup registration found' using errcode = 'P0001';
  end if;
  if v_meetup.date_time is not null and v_meetup.date_time <= now() then
    raise exception 'This meetup has already started' using errcode = 'P0001';
  end if;
  if v_meetup.date_time is not null
     and coalesce(v_meetup.lockdown_minutes, 0) > 0
     and v_meetup.date_time - make_interval(mins => v_meetup.lockdown_minutes) <= now() then
    raise exception 'Meetup cancellation is closed' using errcode = 'P0001';
  end if;

  if v_participant.access_type = 'credit'
     and v_participant.credit_transaction_id is not null
     and v_meetup.date_time is not null
     and now() < v_meetup.date_time - interval '24 hours' then
    select * into v_registration
      from public.participation_credit_transactions
      where id = v_participant.credit_transaction_id
      for update;
    if found then
      insert into public.participation_credit_transactions (
        user_id, amount, type, meetup_id, related_transaction_id, expires_at, metadata
      ) values (
        v_uid, 1, 'registration_refund', p_meetup_id,
        v_registration.related_transaction_id, v_registration.expires_at,
        jsonb_build_object('registration_transaction_id', v_registration.id, 'source', 'meetup_cancellation')
      );
      v_refund := true;
    end if;
  end if;

  update public.meetup_participants
    set registration_status = 'cancelled', cancelled_at = now()
    where meetup_id = p_meetup_id and user_id = v_uid;
  if v_participant.role = 'participant' then
    select count(*) into v_count from public.meetup_participants
      where meetup_id = p_meetup_id and role = 'participant' and registration_status = 'registered';
    update public.meetups set current_participants = v_count where id = p_meetup_id;
  end if;

  return query select v_participant.access_type, v_refund, public.participation_credit_balance_for(v_uid);
end;
$function$;

-- Service cancellation is an audited state transition rather than a deletion. It is
-- intentionally admin-only and returns every active credit registration exactly once.
create or replace function public.cancel_meetup_by_operator(p_meetup_id text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_meetup public.meetups%rowtype;
  v_participant public.meetup_participants%rowtype;
  v_registration public.participation_credit_transactions%rowtype;
  v_refunds integer := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_meetup from public.meetups where id = p_meetup_id for update;
  if not found then raise exception 'Meetup not found' using errcode = 'P0001'; end if;
  if v_meetup.cancelled_at is not null then return 0; end if;
  update public.meetups set cancelled_at = now(), current_participants = 0 where id = p_meetup_id;

  for v_participant in
    select * from public.meetup_participants
    where meetup_id = p_meetup_id and registration_status = 'registered'
    for update
  loop
    if v_participant.access_type = 'credit' and v_participant.credit_transaction_id is not null then
      select * into v_registration from public.participation_credit_transactions
        where id = v_participant.credit_transaction_id;
      if found then
        insert into public.participation_credit_transactions (
          user_id, amount, type, meetup_id, related_transaction_id, expires_at, metadata
        ) values (
          v_participant.user_id, 1, 'registration_refund', p_meetup_id,
          v_registration.related_transaction_id, v_registration.expires_at,
          jsonb_build_object('registration_transaction_id', v_registration.id, 'source', 'operator_meetup_cancellation')
        );
        v_refunds := v_refunds + 1;
      end if;
    end if;
    update public.meetup_participants
      set registration_status = 'cancelled', cancelled_at = now()
      where meetup_id = p_meetup_id and user_id = v_participant.user_id;
  end loop;
  return v_refunds;
end;
$function$;

create or replace function public.adjust_participation_credits(
  p_user_id text,
  p_amount integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user public.users%rowtype;
  v_source record;
  v_remaining integer := abs(p_amount);
  v_take integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_amount = 0 then raise exception 'Adjustment amount cannot be zero' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required for credit adjustments' using errcode = '22023'; end if;
  select * into v_user from public.users where uid = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = 'P0001'; end if;

  if p_amount > 0 then
    insert into public.participation_credit_transactions (user_id, amount, type, metadata)
    values (p_user_id, p_amount, 'admin_grant', jsonb_build_object('reason', p_reason, 'admin_uid', public.current_uid()));
  else
    if public.participation_credit_balance_for(p_user_id) < v_remaining then
      raise exception 'Adjustment would make the credit balance negative' using errcode = '22023';
    end if;
    for v_source in
      select source.id, source.expires_at,
             source.amount + coalesce(sum(child.amount), 0) as remaining
      from public.participation_credit_transactions source
      left join public.participation_credit_transactions child on child.related_transaction_id = source.id
      where source.user_id = p_user_id
        and source.type in ('purchase', 'admin_grant', 'admin_adjustment')
        and source.amount > 0
        and (source.expires_at is null or source.expires_at > now())
      group by source.id, source.expires_at, source.amount, source.created_at
      having source.amount + coalesce(sum(child.amount), 0) > 0
      order by source.expires_at nulls last, source.created_at, source.id
    loop
      v_take := least(v_remaining, v_source.remaining);
      insert into public.participation_credit_transactions (
        user_id, amount, type, related_transaction_id, expires_at, metadata
      ) values (
        p_user_id, -v_take, 'admin_adjustment', v_source.id, v_source.expires_at,
        jsonb_build_object('reason', p_reason, 'admin_uid', public.current_uid())
      );
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
  end if;
  return public.participation_credit_balance_for(p_user_id);
end;
$function$;

-- Payment Edge Function only. It claims a one-time charge before contacting Payple;
-- a duplicate browser callback therefore cannot create a second charge order.
create or replace function public.claim_participation_pack_payment(
  p_authorization_order_id text,
  p_user_id text
)
returns table (
  state text,
  charge_order_number text,
  amount numeric,
  product_id text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.payment_orders%rowtype;
  v_charge text;
begin
  select * into v_order from public.payment_orders
    where order_number = p_authorization_order_id and user_id = p_user_id
    for update;
  if not found or v_order.product_id <> 'participation_pack_5' then
    raise exception 'Participation-pack payment order not found' using errcode = 'P0001';
  end if;
  if v_order.status = 'completed' then
    return query select 'completed'::text, v_order.fulfillment_order_number, v_order.amount, v_order.product_id;
    return;
  end if;
  if v_order.status = 'charging' then
    return query select 'processing'::text, v_order.fulfillment_order_number, v_order.amount, v_order.product_id;
    return;
  end if;
  if v_order.status <> 'pending_auth' then
    raise exception 'This participation-pack payment cannot be completed' using errcode = 'P0001';
  end if;
  v_charge := 'OCEPACK' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || lpad((floor(random() * 1000))::text, 3, '0');
  update public.payment_orders
    set status = 'charging', fulfillment_order_number = v_charge, updated_at = now()
    where order_number = p_authorization_order_id;
  return query select 'claimed'::text, v_charge, v_order.amount, v_order.product_id;
end;
$function$;

create or replace function public.complete_participation_pack_payment(
  p_authorization_order_id text,
  p_user_id text,
  p_payment_result jsonb,
  p_payment_method text default 'card'
)
returns table (
  credit_balance integer,
  credit_quantity integer,
  expires_at timestamptz,
  already_completed boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.payment_orders%rowtype;
  v_purchase_id uuid;
  v_already boolean := false;
begin
  select * into v_order from public.payment_orders
    where order_number = p_authorization_order_id and user_id = p_user_id
    for update;
  if not found or v_order.product_id <> 'participation_pack_5' then
    raise exception 'Participation-pack payment order not found' using errcode = 'P0001';
  end if;
  if v_order.fulfillment_order_number is null then
    raise exception 'Payment has not been claimed' using errcode = 'P0001';
  end if;

  perform 1 from public.users where uid = p_user_id for update;
  insert into public.payment_orders (
    order_number, user_id, amount, status, type, product_id, payment_method,
    payment_result, payple_response, completed_at, related_auth_order
  ) values (
    v_order.fulfillment_order_number, p_user_id, v_order.amount, 'completed',
    'participation_pack_purchase', v_order.product_id, p_payment_method,
    p_payment_result, p_payment_result, now(), p_authorization_order_id
  ) on conflict (order_number) do nothing;

  insert into public.participation_credit_transactions (
    user_id, amount, type, payment_order_id, expires_at, metadata
  ) values (
    p_user_id, v_order.credit_quantity, 'purchase', v_order.fulfillment_order_number,
    v_order.credit_valid_until,
    jsonb_build_object('product_id', v_order.product_id, 'authorization_order_id', p_authorization_order_id)
  ) on conflict (payment_order_id) where type = 'purchase' do nothing
  returning id into v_purchase_id;
  v_already := v_purchase_id is null;
  update public.payment_orders
    set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    where order_number = p_authorization_order_id;
  return query select
    public.participation_credit_balance_for(p_user_id),
    v_order.credit_quantity,
    v_order.credit_valid_until,
    v_already;
end;
$function$;

-- Only a fully unused pack is eligible for the automated full-refund path. The
-- payment Edge Function calls this after Payple confirms the reversal; the unique
-- ledger index makes repeat callbacks safe.
create or replace function public.reverse_unused_participation_pack(
  p_payment_order_id text,
  p_user_id text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_purchase public.participation_credit_transactions%rowtype;
  v_remaining integer;
begin
  perform 1 from public.users where uid = p_user_id for update;
  select * into v_purchase from public.participation_credit_transactions
    where payment_order_id = p_payment_order_id and user_id = p_user_id and type = 'purchase'
    for update;
  if not found then raise exception 'Participation-pack purchase not found' using errcode = 'P0001'; end if;
  if v_purchase.expires_at is not null and v_purchase.expires_at <= now() then
    raise exception 'Expired participation packs cannot be refunded automatically' using errcode = 'P0001'; end if;
  select v_purchase.amount + coalesce(sum(child.amount), 0) into v_remaining
    from public.participation_credit_transactions child
    where child.related_transaction_id = v_purchase.id;
  if v_remaining <> v_purchase.amount then
    raise exception 'Only completely unused participation packs can be refunded automatically' using errcode = 'P0001'; end if;
  insert into public.participation_credit_transactions (
    user_id, amount, type, payment_order_id, related_transaction_id, expires_at, metadata
  ) values (
    p_user_id, -v_purchase.amount, 'payment_refund', p_payment_order_id,
    v_purchase.id, v_purchase.expires_at, jsonb_build_object('reason', p_reason)
  ) on conflict (payment_order_id) where type = 'payment_refund' do nothing;
  return public.participation_credit_balance_for(p_user_id);
end;
$function$;

revoke all on function public.participation_credit_balance_for(text, timestamptz) from public, anon, authenticated;
grant execute on function public.participation_credit_balance_for(text, timestamptz) to service_role;
revoke all on function public.register_for_meetup(text, text) from public, anon;
revoke all on function public.meetup_cancellation_quote(text) from public, anon;
revoke all on function public.cancel_meetup_registration(text) from public, anon;
revoke all on function public.cancel_meetup_by_operator(text) from public, anon;
revoke all on function public.adjust_participation_credits(text, integer, text) from public, anon;
revoke all on function public.claim_participation_pack_payment(text, text) from public, anon, authenticated;
revoke all on function public.complete_participation_pack_payment(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.reverse_unused_participation_pack(text, text, text) from public, anon, authenticated;

grant execute on function public.register_for_meetup(text, text) to authenticated;
grant execute on function public.meetup_cancellation_quote(text) to authenticated;
grant execute on function public.cancel_meetup_registration(text) to authenticated;
grant execute on function public.cancel_meetup_by_operator(text) to authenticated;
grant execute on function public.adjust_participation_credits(text, integer, text) to authenticated;
grant execute on function public.claim_participation_pack_payment(text, text) to service_role;
grant execute on function public.complete_participation_pack_payment(text, text, jsonb, text) to service_role;
grant execute on function public.reverse_unused_participation_pack(text, text, text) to service_role;
