-- Unified administrator-managed discount codes and checkout redemption tracking.
-- Existing member referral codes remain in public.referral_codes and continue to use
-- the first-purchase referral rules. Administrator promo/return codes live here.

create table if not exists public.discount_codes (
  code text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  discount_type text not null,
  discount_value numeric not null,
  applies_to_products text[] not null default array['membership_30d']::text[],
  applies_to_regions text[] not null default array['anam', 'yeouido']::text[],
  eligibility_type text not null default 'all',
  min_inactive_days integer,
  starts_at timestamptz,
  ends_at timestamptz,
  max_total_redemptions integer,
  max_redemptions_per_user integer not null default 1,
  created_by text references public.users(uid) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_codes_code_check check (code ~ '^[A-Za-z0-9_-]{3,32}$'),
  constraint discount_codes_discount_type_check check (discount_type in ('fixed_amount', 'percent')),
  constraint discount_codes_discount_value_check check (
    discount_value > 0
    and (discount_type <> 'percent' or discount_value <= 100)
  ),
  constraint discount_codes_products_check check (
    cardinality(applies_to_products) > 0
    and applies_to_products <@ array['membership_30d', 'participation_pack_5']::text[]
  ),
  constraint discount_codes_regions_check check (
    cardinality(applies_to_regions) > 0
    and applies_to_regions <@ array['anam', 'yeouido']::text[]
  ),
  constraint discount_codes_eligibility_check check (
    eligibility_type in ('all', 'first_purchase', 'returning')
  ),
  constraint discount_codes_inactive_days_check check (
    (eligibility_type = 'returning' and min_inactive_days is not null and min_inactive_days >= 1)
    or (eligibility_type <> 'returning' and min_inactive_days is null)
  ),
  constraint discount_codes_date_window_check check (
    starts_at is null or ends_at is null or starts_at < ends_at
  ),
  constraint discount_codes_total_limit_check check (
    max_total_redemptions is null or max_total_redemptions >= 1
  ),
  constraint discount_codes_user_limit_check check (max_redemptions_per_user >= 1)
);

create unique index if not exists discount_codes_upper_code_uidx
  on public.discount_codes (upper(code));

create table if not exists public.discount_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code text not null references public.discount_codes(code) on update cascade on delete restrict,
  user_id text not null references public.users(uid) on delete restrict,
  authorization_order_number text not null references public.payment_orders(order_number) on delete restrict,
  product_id text not null,
  region text not null,
  discount_amount numeric not null check (discount_amount >= 0),
  status text not null default 'claimed',
  claimed_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  constraint discount_code_redemptions_status_check check (status in ('claimed', 'consumed', 'released')),
  constraint discount_code_redemptions_product_check check (product_id in ('membership_30d', 'participation_pack_5')),
  constraint discount_code_redemptions_region_check check (region in ('anam', 'yeouido'))
);

create unique index if not exists discount_code_redemptions_auth_uidx
  on public.discount_code_redemptions (authorization_order_number);

create index if not exists discount_code_redemptions_usage_idx
  on public.discount_code_redemptions (discount_code, status, user_id);

alter table public.payment_orders
  add column if not exists discount_code text;

do $$ begin
  alter table public.payment_orders
    add constraint payment_orders_discount_code_fkey
    foreign key (discount_code) references public.discount_codes(code)
    on update cascade on delete set null;
exception when duplicate_object then null; end $$;

create or replace function public.touch_discount_code_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists discount_codes_touch_updated_at on public.discount_codes;
create trigger discount_codes_touch_updated_at
before update on public.discount_codes
for each row execute function public.touch_discount_code_updated_at();

create or replace function public.quote_checkout_discount_code(
  p_user_id text,
  p_code text,
  p_product_id text,
  p_region text,
  p_list_amount numeric
)
returns table (
  code_found boolean,
  valid boolean,
  code text,
  discount_amount numeric,
  final_amount numeric,
  message text,
  eligibility_type text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_code public.discount_codes%rowtype;
  v_user public.users%rowtype;
  v_total_used integer := 0;
  v_user_used integer := 0;
  v_raw_discount numeric := 0;
  v_has_membership_history boolean := false;
  v_inactive_cutoff timestamptz;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select false, false, null::text, 0::numeric, p_list_amount,
      '할인 코드를 입력해주세요.'::text, null::text;
    return;
  end if;

  select * into v_code
  from public.discount_codes dc
  where upper(dc.code) = upper(btrim(p_code))
  limit 1;

  if not found then
    return query select false, false, null::text, 0::numeric, p_list_amount,
      '등록된 관리자 할인 코드가 아닙니다.'::text, null::text;
    return;
  end if;

  if not v_code.active then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '현재 사용할 수 없는 할인 코드입니다.'::text, v_code.eligibility_type;
    return;
  end if;

  if v_code.starts_at is not null and now() < v_code.starts_at then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '아직 사용 기간이 시작되지 않은 할인 코드입니다.'::text, v_code.eligibility_type;
    return;
  end if;

  if v_code.ends_at is not null and now() >= v_code.ends_at then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '사용 기간이 종료된 할인 코드입니다.'::text, v_code.eligibility_type;
    return;
  end if;

  if not (p_product_id = any(v_code.applies_to_products)) then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '선택한 상품에는 사용할 수 없는 할인 코드입니다.'::text, v_code.eligibility_type;
    return;
  end if;

  if not (p_region = any(v_code.applies_to_regions)) then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '선택한 지역에는 사용할 수 없는 할인 코드입니다.'::text, v_code.eligibility_type;
    return;
  end if;

  select * into v_user
  from public.users u
  where u.uid = p_user_id;

  if not found then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '회원 정보를 찾을 수 없습니다.'::text, v_code.eligibility_type;
    return;
  end if;

  if v_code.eligibility_type = 'first_purchase' and exists (
    select 1
    from public.payment_orders po
    where po.user_id = p_user_id
      and po.status = 'completed'
      and po.type in ('subscription_initial_payment', 'subscription_recurring', 'participation_pack_purchase')
  ) then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '첫 유료 구매 전용 할인 코드입니다.'::text, v_code.eligibility_type;
    return;
  end if;

  if v_code.eligibility_type = 'returning' then
    select exists (
      select 1
      from public.payment_orders po
      where po.user_id = p_user_id
        and po.status = 'completed'
        and po.type in ('subscription_initial_payment', 'subscription_recurring')
    ) into v_has_membership_history;

    if not v_has_membership_history then
      return query select true, false, v_code.code, 0::numeric, p_list_amount,
        '이 코드는 기존 멤버십 이용 후 복귀하는 회원 전용입니다.'::text, v_code.eligibility_type;
      return;
    end if;

    if v_user.has_active_subscription is true then
      return query select true, false, v_code.code, 0::numeric, p_list_amount,
        '현재 멤버십을 이용 중인 회원에게는 복귀 할인을 적용할 수 없습니다.'::text, v_code.eligibility_type;
      return;
    end if;

    if v_user.subscription_end_date is null then
      return query select true, false, v_code.code, 0::numeric, p_list_amount,
        '마지막 멤버십 종료일을 확인할 수 없습니다.'::text, v_code.eligibility_type;
      return;
    end if;

    v_inactive_cutoff := now() - make_interval(days => v_code.min_inactive_days);
    if v_user.subscription_end_date > v_inactive_cutoff then
      return query select true, false, v_code.code, 0::numeric, p_list_amount,
        format('멤버십 종료 후 %s일 이상 지난 회원만 사용할 수 있습니다.', v_code.min_inactive_days),
        v_code.eligibility_type;
      return;
    end if;
  end if;

  select count(*)::integer into v_total_used
  from public.discount_code_redemptions dcr
  where dcr.discount_code = v_code.code
    and dcr.status in ('claimed', 'consumed');

  if v_code.max_total_redemptions is not null and v_total_used >= v_code.max_total_redemptions then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '할인 코드의 전체 사용 한도가 소진되었습니다.'::text, v_code.eligibility_type;
    return;
  end if;

  select count(*)::integer into v_user_used
  from public.discount_code_redemptions dcr
  where dcr.discount_code = v_code.code
    and dcr.user_id = p_user_id
    and dcr.status in ('claimed', 'consumed');

  if v_user_used >= v_code.max_redemptions_per_user then
    return query select true, false, v_code.code, 0::numeric, p_list_amount,
      '이 계정에서 이미 할인 코드 사용 한도에 도달했습니다.'::text, v_code.eligibility_type;
    return;
  end if;

  v_raw_discount := case
    when v_code.discount_type = 'percent'
      then floor(greatest(0, p_list_amount) * v_code.discount_value / 100)
    else v_code.discount_value
  end;
  v_raw_discount := least(greatest(0, v_raw_discount), greatest(0, p_list_amount));

  return query select
    true,
    true,
    v_code.code,
    v_raw_discount,
    greatest(0, p_list_amount - v_raw_discount),
    case v_code.eligibility_type
      when 'returning' then '복귀 할인 코드가 적용되었습니다.'
      when 'first_purchase' then '첫 구매 할인 코드가 적용되었습니다.'
      else '할인 코드가 적용되었습니다.'
    end,
    v_code.eligibility_type;
end;
$function$;

create or replace function public.claim_checkout_discount_code(
  p_user_id text,
  p_code text,
  p_authorization_order_number text,
  p_product_id text,
  p_region text,
  p_list_amount numeric,
  p_discount_amount numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_code public.discount_codes%rowtype;
  v_quote record;
  v_existing public.discount_code_redemptions%rowtype;
begin
  select * into v_code
  from public.discount_codes dc
  where upper(dc.code) = upper(btrim(p_code))
  for update;

  if not found then
    raise exception '유효하지 않은 할인 코드입니다.' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.discount_code_redemptions dcr
  where dcr.authorization_order_number = p_authorization_order_number
  for update;

  if found then
    if v_existing.discount_code <> v_code.code or v_existing.user_id <> p_user_id then
      raise exception '다른 할인 코드 사용 기록과 충돌했습니다.' using errcode = 'P0001';
    end if;
    if v_existing.status in ('claimed', 'consumed') then
      return v_existing.discount_code;
    end if;
  end if;

  select * into v_quote
  from public.quote_checkout_discount_code(
    p_user_id,
    v_code.code,
    p_product_id,
    p_region,
    p_list_amount
  );

  if not coalesce(v_quote.valid, false) then
    raise exception '%', coalesce(v_quote.message, '할인 코드를 사용할 수 없습니다.') using errcode = 'P0001';
  end if;

  if v_quote.discount_amount is distinct from p_discount_amount then
    raise exception '할인 코드의 결제 금액이 올바르지 않습니다.' using errcode = 'P0001';
  end if;

  if v_existing.id is not null then
    update public.discount_code_redemptions
    set discount_code = v_code.code,
        user_id = p_user_id,
        product_id = p_product_id,
        region = p_region,
        discount_amount = p_discount_amount,
        status = 'claimed',
        claimed_at = now(),
        consumed_at = null,
        released_at = null
    where id = v_existing.id;
  else
    insert into public.discount_code_redemptions (
      discount_code,
      user_id,
      authorization_order_number,
      product_id,
      region,
      discount_amount,
      status
    ) values (
      v_code.code,
      p_user_id,
      p_authorization_order_number,
      p_product_id,
      p_region,
      p_discount_amount,
      'claimed'
    );
  end if;

  return v_code.code;
end;
$function$;

create or replace function public.release_checkout_discount_code(
  p_user_id text,
  p_authorization_order_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.discount_code_redemptions
  set status = 'released',
      released_at = now()
  where user_id = p_user_id
    and authorization_order_number = p_authorization_order_number
    and status = 'claimed';
end;
$function$;

create or replace function public.copy_checkout_discount_code_to_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.discount_code is null
     and new.related_auth_order is not null
     and new.type in ('subscription_initial_payment', 'participation_pack_purchase') then
    select po.discount_code
    into new.discount_code
    from public.payment_orders po
    where po.order_number = new.related_auth_order;
  end if;
  return new;
end;
$function$;

drop trigger if exists payment_orders_copy_discount_code on public.payment_orders;
create trigger payment_orders_copy_discount_code
before insert on public.payment_orders
for each row execute function public.copy_checkout_discount_code_to_charge();

create or replace function public.consume_checkout_discount_code_on_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'completed'
     and new.discount_code is not null
     and new.related_auth_order is not null
     and new.type in ('subscription_initial_payment', 'participation_pack_purchase') then
    update public.discount_code_redemptions
    set status = 'consumed',
        consumed_at = now(),
        released_at = null
    where user_id = new.user_id
      and authorization_order_number = new.related_auth_order
      and discount_code = new.discount_code
      and status = 'claimed';
  end if;
  return new;
end;
$function$;

drop trigger if exists payment_orders_consume_discount_code on public.payment_orders;
create trigger payment_orders_consume_discount_code
after insert on public.payment_orders
for each row execute function public.consume_checkout_discount_code_on_charge();

alter table public.discount_codes enable row level security;
alter table public.discount_code_redemptions enable row level security;

revoke all on public.discount_codes from public, anon;
revoke all on public.discount_code_redemptions from public, anon;
grant select, insert, update, delete on public.discount_codes to authenticated;
grant select on public.discount_code_redemptions to authenticated;
grant all on public.discount_codes to service_role;
grant all on public.discount_code_redemptions to service_role;

drop policy if exists "admin manage discount codes" on public.discount_codes;
create policy "admin manage discount codes"
on public.discount_codes
as permissive
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin read discount redemptions" on public.discount_code_redemptions;
create policy "admin read discount redemptions"
on public.discount_code_redemptions
as permissive
for select
to authenticated
using (public.is_admin());

-- The unified admin page can also view and enable/disable existing member referral codes.
grant select, update on public.referral_codes to authenticated;
drop policy if exists "admin manage referral codes" on public.referral_codes;
create policy "admin manage referral codes"
on public.referral_codes
as permissive
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on function public.quote_checkout_discount_code(text, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.claim_checkout_discount_code(text, text, text, text, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.release_checkout_discount_code(text, text) from public, anon, authenticated;

grant execute on function public.quote_checkout_discount_code(text, text, text, text, numeric) to service_role;
grant execute on function public.claim_checkout_discount_code(text, text, text, text, text, numeric, numeric) to service_role;
grant execute on function public.release_checkout_discount_code(text, text) to service_role;
