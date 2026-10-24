-- Promote the historical BOOMERANG operational code into the managed discount
-- system. The legacy referral_codes row is intentionally kept for historical payment
-- references; checkout resolves managed codes first, so BOOMERANG now follows the
-- explicit returning-member rule below.

insert into public.discount_codes (
  code,
  name,
  description,
  active,
  discount_type,
  discount_value,
  applies_to_products,
  applies_to_regions,
  eligibility_type,
  min_inactive_days,
  starts_at,
  ends_at,
  max_total_redemptions,
  max_redemptions_per_user
)
select
  rc.code,
  'Boomerang',
  '기존 운영 복귀 할인 코드. 멤버십 종료 후 30일 이상 미이용한 복귀 회원에게 적용.',
  coalesce(rc.active, true),
  case when rc.type = 'percent' then 'percent' else 'fixed_amount' end,
  coalesce(rc.discount, 0),
  array['membership_30d']::text[],
  array['anam', 'yeouido']::text[],
  'returning',
  30,
  null,
  null,
  null,
  1
from public.referral_codes rc
where lower(rc.code) = 'boomerang'
  and coalesce(rc.discount, 0) > 0
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    active = excluded.active,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    applies_to_products = excluded.applies_to_products,
    applies_to_regions = excluded.applies_to_regions,
    eligibility_type = excluded.eligibility_type,
    min_inactive_days = excluded.min_inactive_days,
    max_redemptions_per_user = excluded.max_redemptions_per_user,
    updated_at = now();
