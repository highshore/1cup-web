-- New pass prices (terms 제4조, version 2026-10-27.2): 3개월 ₩13,500 → ₩12,300,
-- 6개월 ₩27,000 → ₩23,400. daily_products is what checkout charges; orders already
-- placed keep the amount they were charged.
update public.daily_products set amount = 12300 where id = 'pass_3m';
update public.daily_products set amount = 23400 where id = 'pass_6m';
