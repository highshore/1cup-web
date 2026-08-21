-- Keep referral ownership on the canonical application profile id (public.users.uid).
-- Migrated users may have one or more Supabase auth UUIDs, but current_uid() resolves
-- all of those identities back to this stable profile id.
update public.referral_codes rc
set referrer = u.uid
from public.users u
where u.referral_code = rc.code
  and rc.referrer is distinct from u.uid;

create or replace function public.check_referral_code_for_current_user(p_code text)
returns table (
  valid boolean,
  discount numeric,
  discount_type text,
  message text,
  original_price numeric,
  self_referral boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid text := public.current_uid();
  v_ref public.referral_codes%rowtype;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select false, null::numeric, null::text, '코드를 입력해주세요.'::text, 9700::numeric, false;
    return;
  end if;

  select * into v_ref
  from public.referral_codes
  where code = btrim(p_code);

  if not found then
    return query select false, null::numeric, null::text, '유효하지 않은 코드입니다.'::text, 9700::numeric, false;
    return;
  end if;

  if not v_ref.active then
    return query select false, null::numeric, null::text, '만료된 코드입니다.'::text, 9700::numeric, false;
    return;
  end if;

  if v_uid is not null and v_ref.referrer = v_uid then
    return query select false, v_ref.discount, coalesce(v_ref.type, 'fixed_price'), '본인의 추천 코드는 사용할 수 없습니다.'::text, 9700::numeric, true;
    return;
  end if;

  return query select true, v_ref.discount, coalesce(v_ref.type, 'fixed_price'), '할인 코드가 적용되었습니다.'::text, 9700::numeric, false;
end;
$$;

revoke all on function public.check_referral_code_for_current_user(text) from public;
revoke all on function public.check_referral_code_for_current_user(text) from anon;
grant execute on function public.check_referral_code_for_current_user(text) to authenticated;

-- Authoritative payment guard. A modified client cannot submit a discounted amount
-- without a valid referral, and self-referral is rejected before the order is created.
create or replace function public.enforce_no_self_referral_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referral_codes%rowtype;
  v_raw_discount numeric;
  v_rounded_discount numeric;
  v_expected_amount numeric;
begin
  if new.type is distinct from 'subscription_init' then
    return new;
  end if;

  if new.referral_code is null then
    if new.amount is distinct from 9700::numeric then
      raise exception '할인 결제에는 유효한 추천 코드가 필요합니다.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  select * into v_ref
  from public.referral_codes
  where code = new.referral_code;

  if not found then
    raise exception '유효하지 않은 추천 코드입니다.' using errcode = 'P0001';
  end if;

  if not v_ref.active then
    raise exception '만료된 추천 코드입니다.' using errcode = 'P0001';
  end if;

  if v_ref.referrer is not null and v_ref.referrer = new.user_id then
    raise exception '본인의 추천 코드는 사용할 수 없습니다.' using errcode = 'P0001';
  end if;

  v_raw_discount := case
    when coalesce(v_ref.type, 'fixed_price') = 'percent'
      then 9700::numeric * (v_ref.discount / 100::numeric)
    else v_ref.discount
  end;
  v_rounded_discount := floor(v_raw_discount / 10::numeric) * 10::numeric;
  v_expected_amount := ceil(greatest(0::numeric, 9700::numeric - v_rounded_discount) / 10::numeric) * 10::numeric;

  if new.amount is distinct from v_expected_amount then
    raise exception '추천 코드 할인 금액이 올바르지 않습니다.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.check_referral_code_for_current_user(text) is
  'Validates a referral code for the signed-in canonical profile and identifies self-referral without exposing referral ownership rows.';
comment on function public.enforce_no_self_referral_payment() is
  'Validates referral ownership and server-expected initial subscription amount before a payment order can be created.';
