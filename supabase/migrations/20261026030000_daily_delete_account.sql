-- Deleting a Daily account from /daily/account, like 1cup's own account deletion: type
-- the confirmation phrase, stop recurring billing first, and the account is gone.
--
-- What goes: subscriptions and their message history, reviews, sign-in sessions and
-- codes, the name, and the phone number. What stays, as the Daily privacy notice says:
--   * payment and refund records (전자상거래법, 5 years), kept against a customer row
--     with no phone number or name, and with the payer fields and card key stripped;
--   * the free-trial record (phone and track, 1 year), so deleting and signing up again
--     does not hand out another free trial.
-- A customer with no payments is deleted outright.
--
-- Additive: phone becomes nullable (only for deleted customers) and deleted_at is new.

alter table public.daily_customers
  alter column phone drop not null,
  add column deleted_at timestamptz,
  add constraint daily_customers_phone_unless_deleted check (phone is not null or deleted_at is not null);

-- Payer details Payple echoes back in its results; dropped from kept records on deletion.
create or replace function private.daily_strip_payer(p_result jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_result is null then null
    else p_result - 'PCD_PAYER_ID' - 'PCD_PAYER_NAME' - 'PCD_PAYER_HP' - 'PCD_PAYER_EMAIL' - 'PCD_PAYER_NO'
  end;
$$;

create or replace function public.daily_delete_account(p_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.daily_customers;
begin
  select * into v_customer from public.daily_customers where id = p_customer_id for update;
  if not found or v_customer.deleted_at is not null then
    return 'already-deleted';
  end if;
  -- A refund still waiting needs the customer to hear back about it.
  if exists (select 1 from public.daily_refunds r
              where r.customer_id = p_customer_id and r.status in ('requested', 'refunding')) then
    raise exception 'refund-open' using errcode = 'P0001';
  end if;
  -- Same rule as 1cup: recurring billing is stopped by the customer first, never
  -- silently abandoned by a deletion.
  if exists (select 1 from public.daily_subscriptions s
              where s.customer_id = p_customer_id and s.status = 'active' and s.auto_renew) then
    raise exception 'billing-stop-required' using errcode = 'P0001';
  end if;

  delete from public.daily_reviews where customer_id = p_customer_id;
  -- Deliveries go with their subscriptions; orders and trial claims keep their rows.
  delete from public.daily_subscriptions where customer_id = p_customer_id;
  delete from public.daily_sessions where customer_id = p_customer_id;
  delete from public.daily_otp_codes where phone = v_customer.phone;

  if exists (select 1 from public.daily_orders o where o.customer_id = p_customer_id)
     or exists (select 1 from public.daily_refunds r where r.customer_id = p_customer_id) then
    update public.daily_orders
       set billing_key = null, payment_result = private.daily_strip_payer(payment_result)
     where customer_id = p_customer_id;
    update public.daily_refunds
       set payment_result = private.daily_strip_payer(payment_result)
     where customer_id = p_customer_id;
    update public.daily_customers
       set phone = null, name = null, last_login_at = null, deleted_at = now()
     where id = p_customer_id;
    return 'anonymized';
  end if;

  delete from public.daily_customers where id = p_customer_id;
  return 'deleted';
end;
$$;

revoke execute on function private.daily_strip_payer(jsonb) from public, anon, authenticated;
revoke execute on function public.daily_delete_account(uuid) from public, anon, authenticated;
grant execute on function public.daily_delete_account(uuid) to service_role;
