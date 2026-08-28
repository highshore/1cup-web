-- Server-owned quick-pick products for the Giftishow admin gift center.
-- Browser roles never read or mutate this table directly.
create table public.gift_favorites (
  goods_code text primary key,
  goods_name text not null,
  brand_code text,
  brand_name text,
  goods_image_url text,
  sale_price integer check (sale_price is null or sale_price >= 0),
  purchase_price integer check (purchase_price is null or purchase_price >= 0),
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gift_favorites_created_at_idx
  on public.gift_favorites (created_at asc, goods_code asc);

alter table public.gift_favorites enable row level security;

revoke all on table public.gift_favorites from public, anon, authenticated;
grant select, insert, update, delete on table public.gift_favorites to service_role;
