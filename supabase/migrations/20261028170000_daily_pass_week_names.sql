-- Pass names say how many weeks they cover (1개월 = 4주): the subscribe page, the
-- account page's payment history and Payple show these names.
update public.daily_products set name = '영어 한잔 Daily 1개월 (4주) 이용권' where id = 'pass_1m';
update public.daily_products set name = '영어 한잔 Daily 3개월 (12주) 이용권' where id = 'pass_3m';
update public.daily_products set name = '영어 한잔 Daily 6개월 (24주) 이용권' where id = 'pass_6m';
