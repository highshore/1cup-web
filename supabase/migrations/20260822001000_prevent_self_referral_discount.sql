-- Prevent a member from using their own referral code to discount a payment.
-- The browser performs an early check when possible, but this trigger is the
-- authoritative boundary and also protects against modified/direct clients.

create or replace function public.enforce_no_self_referral_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referral_code is null then
    return new;
  end if;

  if exists (
    select 1
    from public.referral_codes rc
    where rc.code = new.referral_code
      and rc.referrer = new.user_id
  ) then
    raise exception '본인의 추천 코드는 사용할 수 없습니다.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_referral_payment on public.payment_orders;

create trigger trg_prevent_self_referral_payment
before insert or update of referral_code, amount on public.payment_orders
for each row
execute function public.enforce_no_self_referral_payment();

comment on function public.enforce_no_self_referral_payment() is
  'Rejects payment orders that attempt to use the payer''s own referral code.';
