-- Every membership is operated from one of the two meetup locations. Existing
-- members predate the choice, so they all begin at Anam.
alter table public.users
  add column if not exists location text;

update public.users
   set location = 'anam';

alter table public.users
  alter column location set default 'anam',
  alter column location set not null;

alter table public.users
  drop constraint if exists users_location_check;

alter table public.users
  add constraint users_location_check
  check (location in ('yeouido', 'anam'));
