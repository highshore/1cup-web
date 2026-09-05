-- Regional v2 pricing, first-purchase referral discounts, grandfathered recurring prices,
-- and proportional refunds for 5-use participation packs.

alter table public.users
  add column if not exists pricing_version text;

-- Existing continuously-active subscribers keep exactly the recurring amount the old
-- renewal job would charge today. The old job falls back to 4,700 when plan_price is
-- null, so materialize that fallback now instead of letting future catalog changes alter it.
update public.users
set plan_price = coalesce(plan_price, 4700),
    pricing_version = coalesce(pricing_version, 'legacy')
where has_active_subscription is true;

alter table public.payment_orders
  add column if not exists region text,
  add column if not exists list_amount numeric,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists pricing_version text;

do $$ begin
  alter table public.payment_orders
    add constraint payment_orders_region_check
    check (region is null or region in ('anam', 'yeouido'));
exception when duplicate_object then null; end $$;

alter table public.payment_cancellations
  add column if not exists credits_reversed integer,
  add column if not exists refund_policy text;

create table if not exists public.payment_products (
  product_id text not null,
  region text not null,
  display_name text not null,
  list_amount numeric not null check (list_amount > 0),
  referral_discount_amount numeric not null default 0 check (referral_discount_amount >= 0),
  recurring boolean not null,
  credit_quantity integer,
  validity_days integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, region),
  constraint payment_products_region_check check (region in ('anam', 'yeouido')),
  constraint payment_products_product_check check (product_id in ('membership_30d', 'participation_pack_5')),
  constraint payment_products_credit_shape_check check (
    (product_id = 'membership_30d' and recurring is true and credit_quantity is null and validity_days is null)
    or
    (product_id = 'participation_pack_5' and recurring is false and credit_quantity > 0 and validity_days > 0)
  )
);

insert into public.payment_products (
  product_id, region, display_name, list_amount, referral_discount_amount,
  recurring, credit_quantity, validity_days, active
) values
  ('membership_30d', 'anam', '영어 한잔 안암 30일 이용권', 9700, 3200, true, null, null, true),
  ('membership_30d', 'yeouido', '영어 한잔 여의도 30일 이용권', 19700, 3200, true, null, null, true),
  ('participation_pack_5', 'anam', '영어 한잔 안암 5회 이용권', 14700, 3000, false, 5, 180, true),
  ('participation_pack_5', 'yeouido', '영어 한잔 여의도 5회 이용권', 29700, 3000, false, 5, 180, true)
on conflict (product_id, region) do update
set display_name = excluded.display_name,
    list_amount = excluded.list_amount,
    referral_discount_amount = excluded.referral_discount_amount,
    recurring = excluded.recurring,
    credit_quantity = excluded.credit_quantity,
    validity_days = excluded.validity_days,
    active = excluded.active,
    updated_at = now();

alter table public.payment_products enable row level security;
revoke all on public.payment_products from public, anon, authenticated;
grant all on public.payment_products to service_role;

create table if not exists public.referral_redemptions (
  user_id text primary key references public.users(uid) on delete restrict,
  referral_code text not null references public.referral_codes(code) on delete restrict,
  referrer_uid text references public.users(uid) on delete restrict,
  authorization_order_number text not null references public.payment_orders(order_number) on delete restrict,
  product_id text not null,
  region text not null,
  discount_amount numeric not null check (discount_amount >= 0),
  status text not null default 'claimed',
  claimed_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  constraint referral_redemptions_status_check check (status in ('claimed', 'consumed', 'released')),
  constraint referral_redemptions_region_check check (region in ('anam', 'yeouido'))
);

create index if not exists referral_redemptions_code_idx
  on public.referral_redemptions (referral_code, status);

alter table public.referral_redemptions enable row level security;
revoke all on public.referral_redemptions from public, anon, authenticated;
grant all on public.referral_redemptions to service_role;

-- Every meetup now has a region so regional memberships/credits cannot leak across
-- communities. Existing rows are backfilled from the current two-location convention.
alter table public.meetups
  add column if not exists region text;

update public.meetups
set region = case
  when concat_ws(' ', location_name, location_address, location_extra_info) ~* '(여의도|영등포)' then 'yeouido'
  else 'anam'
end
where region is null;

alter table public.meetups
  alter column region set default 'anam',
  alter column region set not null;

do $$ begin
  alter table public.meetups
    add constraint meetups_region_check check (region in ('anam', 'yeouido'));
exception when duplicate_object then null; end $$;

-- Claim a referral immediately before the real charge. A referral is available only on
-- the member's first paid purchase. Released claims may be reused after a failed charge.
create or replace function public.claim_checkout_referral(
  p_user_id text,
  p_referral_code text,
  p_authorization_order_number text,
  p_product_id text,
  p_region text,
  p_discount_amount numeric
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ref public.referral_codes%rowtype;
  v_existing public.referral_redemptions%rowtype;
begin
  perform 1 from public.users u where u.uid = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = 'P0001'; end if;

  select * into v_ref from public.referral_codes rc
  where rc.code = btrim(p_referral_code)
  for share;
  if not found or not v_ref.active then
    raise exception '유효하지 않은 추천 코드입니다.' using errcode = 'P0001';
  end if;
  if v_ref.referrer is not null and v_ref.referrer = p_user_id then
    raise exception '본인의 추천 코드는 사용할 수 없습니다.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.payment_orders po
    where po.user_id = p_user_id
      and po.status = 'completed'
      and po.type in ('subscription_initial_payment', 'subscription_recurring', 'participation_pack_purchase')
  ) then
    raise exception '추천 코드는 첫 유료 구매에만 사용할 수 있습니다.' using errcode = 'P0001';
  end if;

  select * into v_existing from public.referral_redemptions rr
  where rr.user_id = p_user_id
  for update;

  if found then
    if v_existing.status = 'consumed' then
      raise exception '추천 코드는 이미 사용되었습니다.' using errcode = 'P0001';
    end if;
    if v_existing.status = 'claimed'
       and v_existing.authorization_order_number <> p_authorization_order_number then
      raise exception '다른 결제에서 추천 코드 사용이 진행 중입니다.' using errcode = 'P0001';
    end if;
    update public.referral_redemptions
      set referral_code = btrim(p_referral_code),
          referrer_uid = v_ref.referrer,
          authorization_order_number = p_authorization_order_number,
          product_id = p_product_id,
          region = p_region,
          discount_amount = p_discount_amount,
          status = 'claimed',
          claimed_at = now(),
          consumed_at = null,
          released_at = null
      where user_id = p_user_id;
  else
    insert into public.referral_redemptions (
      user_id, referral_code, referrer_uid, authorization_order_number,
      product_id, region, discount_amount, status
    ) values (
      p_user_id, btrim(p_referral_code), v_ref.referrer, p_authorization_order_number,
      p_product_id, p_region, p_discount_amount, 'claimed'
    );
  end if;
  return 'claimed';
end;
$function$;

create or replace function public.consume_checkout_referral(
  p_user_id text,
  p_authorization_order_number text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.referral_redemptions
    set status = 'consumed', consumed_at = now(), released_at = null
    where user_id = p_user_id
      and authorization_order_number = p_authorization_order_number
      and status = 'claimed';
end;
$function$;

create or replace function public.release_checkout_referral(
  p_user_id text,
  p_authorization_order_number text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.referral_redemptions
    set status = 'released', released_at = now()
    where user_id = p_user_id
      and authorization_order_number = p_authorization_order_number
      and status = 'claimed';
end;
$function$;

-- Idempotent claim for a new regional membership charge.
create or replace function public.claim_membership_checkout_payment(
  p_authorization_order_id text,
  p_user_id text
)
returns table (
  state text,
  charge_order_number text,
  amount numeric,
  product_id text,
  region text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.payment_orders%rowtype;
  v_charge text;
begin
  select * into v_order from public.payment_orders po
    where po.order_number = p_authorization_order_id and po.user_id = p_user_id
    for update;
  if not found or v_order.product_id <> 'membership_30d' then
    raise exception 'Membership checkout order not found' using errcode = 'P0001';
  end if;
  if v_order.status = 'completed' then
    return query select 'completed'::text, v_order.fulfillment_order_number, v_order.amount, v_order.product_id, v_order.region;
    return;
  end if;
  if v_order.status = 'charging' then
    return query select 'processing'::text, v_order.fulfillment_order_number, v_order.amount, v_order.product_id, v_order.region;
    return;
  end if;
  if v_order.status <> 'pending_auth' then
    raise exception 'This membership checkout cannot be completed' using errcode = 'P0001';
  end if;
  v_charge := 'OCEMEM' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || lpad((floor(random() * 1000))::text, 3, '0');
  update public.payment_orders po
    set status = 'charging', fulfillment_order_number = v_charge, updated_at = now()
    where po.order_number = p_authorization_order_id;
  return query select 'claimed'::text, v_charge, v_order.amount, v_order.product_id, v_order.region;
end;
$function$;

create or replace function public.complete_membership_checkout_payment(
  p_authorization_order_id text,
  p_user_id text,
  p_payment_result jsonb,
  p_billing_key text,
  p_payment_method text default 'card'
)
returns table (
  subscription_end_date timestamptz,
  charged_amount numeric,
  region text,
  already_completed boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.payment_orders%rowtype;
  v_start timestamptz := now();
  v_end timestamptz := now() + interval '30 days';
  v_inserted boolean := false;
begin
  select * into v_order from public.payment_orders po
    where po.order_number = p_authorization_order_id and po.user_id = p_user_id
    for update;
  if not found or v_order.product_id <> 'membership_30d' then
    raise exception 'Membership checkout order not found' using errcode = 'P0001';
  end if;
  if v_order.fulfillment_order_number is null then
    raise exception 'Payment has not been claimed' using errcode = 'P0001';
  end if;

  perform 1 from public.users u where u.uid = p_user_id for update;

  insert into public.payment_orders (
    order_number, user_id, amount, status, type, product_id, region,
    list_amount, discount_amount, pricing_version, referral_code,
    payment_method, billing_key_used, payment_result, payple_response,
    completed_at, order_date, related_auth_order, selected_categories
  ) values (
    v_order.fulfillment_order_number, p_user_id, v_order.amount, 'completed',
    'subscription_initial_payment', v_order.product_id, v_order.region,
    v_order.list_amount, v_order.discount_amount, v_order.pricing_version, v_order.referral_code,
    p_payment_method, p_billing_key, p_payment_result, p_payment_result,
    now(), now(), p_authorization_order_id, v_order.selected_categories
  ) on conflict (order_number) do nothing;
  get diagnostics v_inserted = row_count;

  update public.users u
    set has_active_subscription = true,
        subscription_start_date = v_start,
        subscription_end_date = v_end,
        billing_key = p_billing_key,
        payment_method = p_payment_method,
        billing_cancelled = false,
        plan_price = v_order.amount,
        pricing_version = 'regional_v2',
        location = v_order.region,
        cat_tech = false,
        cat_business = false,
        cancellation_timestamp = null,
        cancellation_type = null,
        cancellation_reason = null
    where u.uid = p_user_id;

  update public.payment_orders po
    set status = 'completed', completed_at = coalesce(po.completed_at, now()), updated_at = now()
    where po.order_number = p_authorization_order_id;

  if v_order.referral_code is not null then
    perform public.consume_checkout_referral(p_user_id, p_authorization_order_id);
  end if;

  return query select v_end, v_order.amount, v_order.region, not v_inserted;
end;
$function$;

-- Preserve the existing idempotent participation-pack settlement while copying the
-- regional price/referral snapshot onto the actual charged order and regional credit lot.
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
  select * into v_order from public.payment_orders po
    where po.order_number = p_authorization_order_id and po.user_id = p_user_id
    for update;
  if not found or v_order.product_id <> 'participation_pack_5' then
    raise exception 'Participation-pack payment order not found' using errcode = 'P0001';
  end if;
  if v_order.fulfillment_order_number is null then
    raise exception 'Payment has not been claimed' using errcode = 'P0001';
  end if;

  perform 1 from public.users u where u.uid = p_user_id for update;

  insert into public.payment_orders (
    order_number, user_id, amount, status, type, product_id, region,
    list_amount, discount_amount, pricing_version, referral_code,
    payment_method, payment_result, payple_response, completed_at, order_date,
    related_auth_order, selected_categories, credit_quantity, credit_valid_until
  ) values (
    v_order.fulfillment_order_number, p_user_id, v_order.amount, 'completed',
    'participation_pack_purchase', v_order.product_id, v_order.region,
    v_order.list_amount, v_order.discount_amount, v_order.pricing_version, v_order.referral_code,
    p_payment_method, p_payment_result, p_payment_result, now(), now(),
    p_authorization_order_id, v_order.selected_categories,
    v_order.credit_quantity, v_order.credit_valid_until
  ) on conflict (order_number) do nothing;

  insert into public.participation_credit_transactions (
    user_id, amount, type, payment_order_id, expires_at, metadata
  ) values (
    p_user_id, v_order.credit_quantity, 'purchase', v_order.fulfillment_order_number,
    v_order.credit_valid_until,
    jsonb_build_object(
      'product_id', v_order.product_id,
      'authorization_order_id', p_authorization_order_id,
      'region', v_order.region,
      'list_amount', v_order.list_amount,
      'discount_amount', v_order.discount_amount
    )
  ) on conflict (payment_order_id) where type = 'purchase' do nothing
  returning id into v_purchase_id;

  v_already := v_purchase_id is null;

  update public.payment_orders po
    set status = 'completed', completed_at = coalesce(po.completed_at, now()), updated_at = now()
    where po.order_number = p_authorization_order_id;

  if v_order.referral_code is not null then
    perform public.consume_checkout_referral(p_user_id, p_authorization_order_id);
  end if;

  return query select
    public.participation_credit_balance_for(p_user_id),
    v_order.credit_quantity,
    v_order.credit_valid_until,
    v_already;
end;
$function$;

-- Quote the actual remaining value in one purchased pack. Because registrations are
-- allocated to a specific purchase via related_transaction_id, we can refund exactly
-- the remaining uses without touching credits from another pack.
create or replace function public.participation_pack_refund_quote(
  p_payment_order_id text,
  p_user_id text
)
returns table (
  refundable boolean,
  credits_purchased integer,
  credits_remaining integer,
  refund_amount numeric,
  expires_at timestamptz,
  message text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.payment_orders%rowtype;
  v_purchase public.participation_credit_transactions%rowtype;
  v_remaining integer;
  v_refund numeric;
begin
  select * into v_order from public.payment_orders po
    where po.order_number = p_payment_order_id
      and po.user_id = p_user_id
      and po.type = 'participation_pack_purchase'
    for share;
  if not found then
    return query select false, 0, 0, 0::numeric, null::timestamptz, '참여권 구매 내역을 찾을 수 없습니다.'::text;
    return;
  end if;

  select * into v_purchase from public.participation_credit_transactions pct
    where pct.payment_order_id = p_payment_order_id
      and pct.user_id = p_user_id
      and pct.type = 'purchase'
    for share;
  if not found then
    return query select false, 0, 0, 0::numeric, null::timestamptz, '참여권 원장을 확인할 수 없습니다.'::text;
    return;
  end if;

  select v_purchase.amount + coalesce(sum(child.amount), 0)::integer
    into v_remaining
  from public.participation_credit_transactions child
  where child.related_transaction_id = v_purchase.id;

  v_remaining := greatest(0, coalesce(v_remaining, v_purchase.amount));
  if v_purchase.expires_at is not null and v_purchase.expires_at <= now() then
    return query select false, v_purchase.amount, v_remaining, 0::numeric, v_purchase.expires_at, '유효기간이 만료된 참여권은 환불할 수 없습니다.'::text;
    return;
  end if;
  if v_remaining <= 0 then
    return query select false, v_purchase.amount, 0, 0::numeric, v_purchase.expires_at, '남은 참여권이 없어 환불할 금액이 없습니다.'::text;
    return;
  end if;

  v_refund := round(v_order.amount * v_remaining::numeric / v_purchase.amount::numeric);
  return query select true, v_purchase.amount, v_remaining, v_refund, v_purchase.expires_at,
    format('남은 %s회에 대해 %s원을 환불합니다.', v_remaining, v_refund)::text;
end;
$function$;

create or replace function public.reverse_participation_pack_remaining(
  p_payment_order_id text,
  p_user_id text,
  p_reason text
)
returns table (
  credit_balance integer,
  credits_reversed integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_purchase public.participation_credit_transactions%rowtype;
  v_remaining integer;
  v_existing integer;
begin
  perform 1 from public.users u where u.uid = p_user_id for update;

  select * into v_purchase from public.participation_credit_transactions pct
    where pct.payment_order_id = p_payment_order_id
      and pct.user_id = p_user_id
      and pct.type = 'purchase'
    for update;
  if not found then raise exception 'Participation-pack purchase not found' using errcode = 'P0001'; end if;
  if v_purchase.expires_at is not null and v_purchase.expires_at <= now() then
    raise exception 'Expired participation packs cannot be refunded' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.participation_credit_transactions pct
    where pct.payment_order_id = p_payment_order_id and pct.type = 'payment_refund'
  ) then
    return query select public.participation_credit_balance_for(p_user_id), 0;
    return;
  end if;

  select v_purchase.amount + coalesce(sum(child.amount), 0)::integer
    into v_remaining
  from public.participation_credit_transactions child
  where child.related_transaction_id = v_purchase.id;
  v_remaining := greatest(0, coalesce(v_remaining, v_purchase.amount));
  if v_remaining <= 0 then
    raise exception 'No remaining participation credits to refund' using errcode = 'P0001';
  end if;

  insert into public.participation_credit_transactions (
    user_id, amount, type, payment_order_id, related_transaction_id, expires_at, metadata
  ) values (
    p_user_id, -v_remaining, 'payment_refund', p_payment_order_id,
    v_purchase.id, v_purchase.expires_at,
    jsonb_build_object('reason', p_reason, 'policy', 'remaining_uses_proportional')
  );

  update public.payment_orders po
    set status = case when v_remaining = v_purchase.amount then 'refunded' else 'partially_refunded' end,
        updated_at = now()
    where po.order_number = p_payment_order_id;

  return query select public.participation_credit_balance_for(p_user_id), v_remaining;
end;
$function$;

-- Region-aware registration: membership access is limited to the subscriber's chosen
-- region; regional purchased credits are limited to their purchase region. Legacy credit
-- lots without region metadata remain usable everywhere so existing balances are honored.
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
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_role not in ('participant', 'leader') then raise exception 'Invalid meetup role' using errcode = '22023'; end if;

  select * into v_user from public.users u where u.uid = v_uid for update;
  if not found then raise exception 'Member record not found' using errcode = 'P0001'; end if;
  select * into v_meetup from public.meetups m where m.id = p_meetup_id for update;
  if not found then raise exception 'Meetup not found' using errcode = 'P0001'; end if;
  if v_meetup.cancelled_at is not null then raise exception 'This meetup has been cancelled' using errcode = 'P0001'; end if;
  if v_meetup.date_time is not null and v_meetup.date_time <= now() then raise exception 'This meetup has already started' using errcode = 'P0001'; end if;
  if v_meetup.date_time is not null
     and coalesce(v_meetup.lockdown_minutes, 0) > 0
     and v_meetup.date_time - make_interval(mins => v_meetup.lockdown_minutes) <= now() then
    raise exception 'Meetup registration is closed' using errcode = 'P0001';
  end if;

  select * into v_existing from public.meetup_participants mp
  where mp.meetup_id = p_meetup_id and mp.user_id = v_uid for update;
  v_has_existing := found;
  if found and v_existing.registration_status = 'registered' then
    raise exception 'You are already registered for this meetup' using errcode = '23505';
  end if;

  if p_role = 'leader' and not (public.is_admin() or v_user.account_status = 'leader') then
    raise exception 'Only a meetup leader or administrator can register as a leader' using errcode = '42501';
  end if;

  if p_role = 'leader' or public.is_admin() or v_user.account_status = 'leader' or v_user.gdg_member is true then
    v_access := 'complimentary';
  elsif v_user.has_active_subscription is true and v_user.location = v_meetup.region then
    v_access := 'subscription';
  else
    v_access := 'credit';
  end if;

  if p_role = 'participant' then
    select count(*) into v_count from public.meetup_participants mp
    where mp.meetup_id = p_meetup_id and mp.role = 'participant' and mp.registration_status = 'registered';
    if v_meetup.max_participants is not null and v_count >= v_meetup.max_participants then
      raise exception 'This meetup is full' using errcode = 'P0001';
    end if;
  end if;

  if v_access = 'credit' then
    for v_source in
      select source.id, source.expires_at,
             source.amount + coalesce(sum(child.amount), 0) as remaining
      from public.participation_credit_transactions source
      left join public.participation_credit_transactions child on child.related_transaction_id = source.id
      where source.user_id = v_uid
        and source.type in ('purchase', 'admin_grant', 'admin_adjustment')
        and source.amount > 0
        and (source.expires_at is null or source.expires_at > now())
        and (
          source.type <> 'purchase'
          or nullif(source.metadata->>'region', '') is null
          or source.metadata->>'region' = v_meetup.region
        )
      group by source.id, source.expires_at, source.amount, source.created_at
      having source.amount + coalesce(sum(child.amount), 0) >= 1
      order by source.expires_at nulls last, source.created_at, source.id
    loop
      insert into public.participation_credit_transactions (
        user_id, amount, type, meetup_id, related_transaction_id, expires_at, metadata
      ) values (
        v_uid, -1, 'registration', p_meetup_id, v_source.id, v_source.expires_at,
        jsonb_build_object('source', 'meetup_registration', 'region', v_meetup.region)
      ) returning id into v_credit_transaction_id;
      exit;
    end loop;
    if v_credit_transaction_id is null then
      raise exception '이 지역의 30일 이용권 또는 유효한 참여권이 필요합니다.' using errcode = 'P0001';
    end if;
  end if;

  if v_has_existing then
    update public.meetup_participants mp
      set role = p_role, access_type = v_access, registration_status = 'registered',
          registered_at = now(), cancelled_at = null, credit_transaction_id = v_credit_transaction_id
      where mp.meetup_id = p_meetup_id and mp.user_id = v_uid;
  else
    insert into public.meetup_participants (
      meetup_id, user_id, role, access_type, registration_status, registered_at, credit_transaction_id
    ) values (
      p_meetup_id, v_uid, p_role, v_access, 'registered', now(), v_credit_transaction_id
    );
  end if;

  if p_role = 'participant' then
    update public.meetups m set current_participants = v_count + 1 where m.id = p_meetup_id;
  end if;

  return query select v_access, 'registered'::text,
    public.participation_credit_balance_for(v_uid), v_credit_transaction_id;
end;
$function$;

revoke all on function public.claim_checkout_referral(text, text, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.consume_checkout_referral(text, text) from public, anon, authenticated;
revoke all on function public.release_checkout_referral(text, text) from public, anon, authenticated;
revoke all on function public.claim_membership_checkout_payment(text, text) from public, anon, authenticated;
revoke all on function public.complete_membership_checkout_payment(text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.participation_pack_refund_quote(text, text) from public, anon, authenticated;
revoke all on function public.reverse_participation_pack_remaining(text, text, text) from public, anon, authenticated;

grant execute on function public.claim_checkout_referral(text, text, text, text, text, numeric) to service_role;
grant execute on function public.consume_checkout_referral(text, text) to service_role;
grant execute on function public.release_checkout_referral(text, text) to service_role;
grant execute on function public.claim_membership_checkout_payment(text, text) to service_role;
grant execute on function public.complete_membership_checkout_payment(text, text, jsonb, text, text) to service_role;
grant execute on function public.participation_pack_refund_quote(text, text) to service_role;
grant execute on function public.reverse_participation_pack_remaining(text, text, text) to service_role;
