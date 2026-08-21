-- Prevent a member from using their own referral code to discount a payment.
-- The payment edge function already ignores self-referral attribution, but the
-- browser-supplied amount also needs a DB-side guard before verification reads it.

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
    new.referral_code := null;
    new.amount := 9700;
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
  'Removes self-referral attribution and restores the standard 9,700 KRW membership price.';
