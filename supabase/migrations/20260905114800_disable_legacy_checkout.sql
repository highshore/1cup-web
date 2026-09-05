-- Cutover guard: the old `payment` Edge Function remains responsible for recurring
-- renewals and subscription cancellation, but must no longer be allowed to create new
-- checkout authorizations because its catalog predates regional pricing.
create or replace function public.block_legacy_checkout_orders()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  if new.status = 'pending_auth'
     and new.type in ('subscription_init', 'participation_pack_purchase') then
    raise exception 'Legacy checkout is disabled; use the regional checkout flow.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists block_legacy_checkout_orders on public.payment_orders;
create trigger block_legacy_checkout_orders
before insert on public.payment_orders
for each row execute function public.block_legacy_checkout_orders();

revoke all on function public.block_legacy_checkout_orders() from public, anon, authenticated;
