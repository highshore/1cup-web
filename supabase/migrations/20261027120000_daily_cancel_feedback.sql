-- Why a customer turned off auto-renew, asked for in the 서비스 중단하기 sheet on
-- /daily/account (the same survey 1cup shows before stopping billing). Refund reasons
-- already live on daily_refunds.reason; this holds the other half.
--
-- Additive only. Written by the daily edge function (service role); no one else reads
-- or writes it, so RLS is on with no policies.

create table if not exists public.daily_cancel_feedback (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.daily_customers (id) on delete cascade,
  track        text not null,
  reasons      text[] not null default '{}',
  other        text check (other is null or length(other) <= 500),
  created_at   timestamptz not null default now()
);

create index if not exists daily_cancel_feedback_created on public.daily_cancel_feedback (created_at desc);

alter table public.daily_cancel_feedback enable row level security;
revoke all on public.daily_cancel_feedback from anon, authenticated;
