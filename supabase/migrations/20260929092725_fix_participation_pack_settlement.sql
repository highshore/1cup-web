-- Keep the purchase idempotency rule simple enough for PostgreSQL to infer
-- from INSERT ... ON CONFLICT (payment_order_id) WHERE type = 'purchase'.
drop index if exists public.participation_credit_purchase_once_per_order_idx;

create unique index participation_credit_purchase_once_per_order_idx
  on public.participation_credit_transactions (payment_order_id)
  where type = 'purchase';

alter table public.participation_credit_transactions
  drop constraint if exists participation_credit_purchase_requires_payment_order;

alter table public.participation_credit_transactions
  add constraint participation_credit_purchase_requires_payment_order
  check (type <> 'purchase' or payment_order_id is not null);
