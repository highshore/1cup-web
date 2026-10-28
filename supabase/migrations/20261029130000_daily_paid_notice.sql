-- When the payment notice (KakaoTalk, payments.ts notifyPaid) went out for an order.
-- Claimed before sending, so each paid checkout or renewal is announced once. Orders
-- paid before this have it set to their payment time and are never announced.

alter table public.daily_orders add column paid_notice_at timestamptz;

update public.daily_orders
   set paid_notice_at = completed_at
 where status = 'completed';
