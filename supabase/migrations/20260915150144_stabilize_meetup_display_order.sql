alter table public.meetup_articles
  add column if not exists position integer;

-- Historical meetup_articles rows did not store selection order. Give every
-- existing row a deterministic baseline so public reads no longer depend on
-- PostgreSQL's incidental row order. Admin saves will replace these values with
-- the actual article selection order going forward.
with ranked as (
  select
    meetup_id,
    article_id,
    row_number() over (
      partition by meetup_id
      order by article_id
    ) - 1 as position
  from public.meetup_articles
  where position is null
)
update public.meetup_articles as target
set position = ranked.position
from ranked
where target.meetup_id = ranked.meetup_id
  and target.article_id = ranked.article_id
  and target.position is null;

do $$ begin
  alter table public.meetup_articles
    add constraint meetup_articles_position_nonnegative
    check (position is null or position >= 0);
exception when duplicate_object then null; end $$;

create unique index if not exists meetup_articles_meetup_position_uidx
  on public.meetup_articles (meetup_id, position)
  where position is not null;

-- registered_at is the canonical signup order for current registrations.
create index if not exists meetup_participants_active_registration_order_idx
  on public.meetup_participants (meetup_id, registered_at, user_id)
  where registration_status = 'registered';
