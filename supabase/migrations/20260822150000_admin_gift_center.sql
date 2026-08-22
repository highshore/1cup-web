-- Server-owned audit log for Giftishow Biz mobile coupon sends.
-- Recipient phone numbers are intentionally not persisted; only the last four digits
-- are kept for administrator-facing history. All provider calls happen in trusted
-- Next.js server code, so browser roles do not receive table access.
create table public.gift_sends (
  id uuid primary key default gen_random_uuid(),
  tr_id text not null unique check (char_length(tr_id) between 1 and 25),
  created_by text references public.users(uid) on delete set null,
  member_id text references public.users(uid) on delete set null,
  recipient_name text,
  recipient_phone_last4 text check (
    recipient_phone_last4 is null or recipient_phone_last4 ~ '^[0-9]{4}$'
  ),
  goods_code text not null,
  goods_name text not null,
  brand_name text,
  goods_image_url text,
  sale_price integer check (sale_price is null or sale_price >= 0),
  purchase_price integer check (purchase_price is null or purchase_price >= 0),
  mms_title text not null,
  mms_message text not null,
  order_no text,
  provider_code text,
  provider_message text,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'failed', 'cancelled_after_timeout', 'timeout_unknown')
  ),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index gift_sends_created_at_idx
  on public.gift_sends (created_at desc, id desc);
create index gift_sends_member_id_idx
  on public.gift_sends (member_id, created_at desc)
  where member_id is not null;

alter table public.gift_sends enable row level security;

revoke all on table public.gift_sends from public, anon, authenticated;
grant select, insert, update on table public.gift_sends to service_role;
