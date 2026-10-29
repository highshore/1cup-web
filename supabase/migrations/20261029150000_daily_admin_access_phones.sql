-- Who may open One Cup Daily's admin (/daily/admin and its APIs): a 1cup admin account
-- whose phone number is on this list (010…, digits only). Being a 1cup admin alone is no
-- longer enough. The numbers live here, not in the code; set them with
--   update public.daily_config set admin_access_phones = '{010…,010…}' where id = 'settings';
-- An empty list lets nobody in.
alter table public.daily_config
  add column if not exists admin_access_phones text[] not null default '{}';

comment on column public.daily_config.admin_access_phones is
  'Phone numbers (010…, digits only) of the 1cup admin accounts allowed into the Daily admin.';
