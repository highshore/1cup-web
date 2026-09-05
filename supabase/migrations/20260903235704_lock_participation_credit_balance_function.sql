-- The balance helper is used only inside privileged credit workflows. Calling it
-- directly with another member's uid would otherwise disclose that member's balance.
revoke all on function public.participation_credit_balance_for(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.participation_credit_balance_for(text, timestamptz)
  to service_role;
