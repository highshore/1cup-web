-- Regional v2 pricing schema and grandfathering.

alter table public.users
  add column if not exists pricing_version text;

-- Existing continuously-active subscribers keep exactly what the current renewal job
-- would charge today. That job falls back to 4,700 when plan_price is null.
update public.users
set plan_price = coalesce(plan_price, 4700),
    pricing_version = coalesce(pricing_version, 'legacy')
where has_active_subscription is true;

alter table public.payment_orders
  add column if not exists region text,
  add column if not exists list_amount numeric,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists pricing_version text;

do $$ begin
  alter table public.payment_orders
    add constraint payment_orders_region_check
    check (region is null or region in ('anam', 'yeouido'));
exception when duplicate_object then null; end $$;

alter table public.payment_cancellations
  add column if not exists credits_reversed integer,
  add column if not exists refund_policy text;

create table if not exists public.payment_products (
  product_id text not null,
  region text not null,
  display_name text not null,
  list_amount numeric not null check (list_amount > 0),
  referral_discount_amount numeric not null default 0 check (referral_discount_amount >= 0),
  recurring boolean not null,
  credit_quantity integer,
  validity_days integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, region),
  constraint payment_products_region_check check (region in ('anam', 'yeouido')),
  constraint payment_products_product_check check (product_id in ('membership_30d', 'participation_pack_5')),
  constraint payment_products_credit_shape_check check (
    (product_id = 'membership_30d' and recurring is true and credit_quantity is null and validity_days is null)
    or
    (product_id = 'participation_pack_5' and recurring is false and credit_quantity > 0 and validity_days > 0)
  )
);

insert into public.payment_products (
  product_id, region, display_name, list_amount, referral_discount_amount,
  recurring, credit_quantity, validity_days, active
) values
  ('membership_30d', 'anam', '영어 한잔 안암 30일 이용권', 9700, 3200, true, null, null, true),
  ('membership_30d', 'yeouido', '영어 한잔 여의도 30일 이용권', 19700, 3200, true, null, null, true),
  ('participation_pack_5', 'anam', '영어 한잔 안암 5회 이용권', 14700, 3000, false, 5, 180, true),
  ('participation_pack_5', 'yeouido', '영어 한잔 여의도 5회 이용권', 29700, 3000, false, 5, 180, true)
on conflict (product_id, region) do update
set display_name = excluded.display_name,
    list_amount = excluded.list_amount,
    referral_discount_amount = excluded.referral_discount_amount,
    recurring = excluded.recurring,
    credit_quantity = excluded.credit_quantity,
    validity_days = excluded.validity_days,
    active = excluded.active,
    updated_at = now();

alter table public.payment_products enable row level security;
revoke all on public.payment_products from public, anon, authenticated;
grant all on public.payment_products to service_role;

create table if not exists public.referral_redemptions (
  user_id text primary key references public.users(uid) on delete restrict,
  referral_code text not null references public.referral_codes(code) on delete restrict,
  referrer_uid text references public.users(uid) on delete restrict,
  authorization_order_number text not null references public.payment_orders(order_number) on delete restrict,
  product_id text not null,
  region text not null,
  discount_amount numeric not null check (discount_amount >= 0),
  status text not null default 'claimed',
  claimed_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  constraint referral_redemptions_status_check check (status in ('claimed', 'consumed', 'released')),
  constraint referral_redemptions_region_check check (region in ('anam', 'yeouido'))
);

create index if not exists referral_redemptions_code_idx
  on public.referral_redemptions (referral_code, status);

alter table public.referral_redemptions enable row level security;
revoke all on public.referral_redemptions from public, anon, authenticated;
grant all on public.referral_redemptions to service_role;

-- Every meetup gets a region. Existing data only uses the two communities; anything not
-- explicitly identifiable as Yeouido keeps the historical Anam default.
alter table public.meetups
  add column if not exists region text;

update public.meetups
set region = case
  when concat_ws(' ', location_name, location_address, location_extra_info) ~* '(여의도|영등포)' then 'yeouido'
  else 'anam'
end
where region is null;

alter table public.meetups
  alter column region set default 'anam',
  alter column region set not null;

do $$ begin
  alter table public.meetups
    add constraint meetups_region_check check (region in ('anam', 'yeouido'));
exception when duplicate_object then null; end $$;
