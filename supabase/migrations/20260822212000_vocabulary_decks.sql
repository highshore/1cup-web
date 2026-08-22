-- Public/private vocabulary decks built on top of the shared dictionary.
-- A user's personal collection remains in user_vocabulary; decks are curated
-- subsets that can be private, shared publicly, and followed by other members.

create table if not exists public.vocabulary_decks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text,
  name text not null,
  description text not null default '',
  visibility text not null default 'private',
  icon text not null default '📚',
  theme text not null default 'orange',
  is_official boolean not null default false,
  system_key text,
  item_count integer not null default 0,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_decks_owner_user_id_fkey
    foreign key (owner_user_id) references public.users(uid) on delete cascade,
  constraint vocabulary_decks_visibility_check
    check (visibility in ('private', 'public')),
  constraint vocabulary_decks_theme_check
    check (theme in ('orange', 'blue', 'green', 'purple', 'pink')),
  constraint vocabulary_decks_name_length_check
    check (char_length(trim(name)) between 1 and 80),
  constraint vocabulary_decks_description_length_check
    check (char_length(description) <= 500),
  constraint vocabulary_decks_owner_kind_check
    check (
      (is_official = true and owner_user_id is null and visibility = 'public')
      or (is_official = false and owner_user_id is not null)
    )
);

create unique index if not exists vocabulary_decks_system_key_unique
  on public.vocabulary_decks(system_key)
  where system_key is not null;
create index if not exists vocabulary_decks_owner_idx
  on public.vocabulary_decks(owner_user_id, updated_at desc);
create index if not exists vocabulary_decks_public_idx
  on public.vocabulary_decks(visibility, follower_count desc, updated_at desc)
  where visibility = 'public';

create table if not exists public.vocabulary_deck_items (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null,
  entry_id uuid not null,
  meaning_id uuid,
  note text,
  position integer,
  added_at timestamptz not null default now(),
  constraint vocabulary_deck_items_deck_id_fkey
    foreign key (deck_id) references public.vocabulary_decks(id) on delete cascade,
  constraint vocabulary_deck_items_entry_id_fkey
    foreign key (entry_id) references public.dictionary_entries(id) on delete cascade,
  constraint vocabulary_deck_items_meaning_id_fkey
    foreign key (meaning_id) references public.dictionary_meanings(id) on delete set null,
  constraint vocabulary_deck_items_note_length_check
    check (note is null or char_length(note) <= 500)
);

create unique index if not exists vocabulary_deck_items_unique_term_idx
  on public.vocabulary_deck_items(
    deck_id,
    entry_id,
    coalesce(meaning_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists vocabulary_deck_items_deck_position_idx
  on public.vocabulary_deck_items(deck_id, position nulls last, added_at, id);

create table if not exists public.vocabulary_deck_follows (
  deck_id uuid not null,
  user_id text not null,
  followed_at timestamptz not null default now(),
  constraint vocabulary_deck_follows_pkey primary key (deck_id, user_id),
  constraint vocabulary_deck_follows_deck_id_fkey
    foreign key (deck_id) references public.vocabulary_decks(id) on delete cascade,
  constraint vocabulary_deck_follows_user_id_fkey
    foreign key (user_id) references public.users(uid) on delete cascade
);

create index if not exists vocabulary_deck_follows_user_idx
  on public.vocabulary_deck_follows(user_id, followed_at desc);

create or replace function public.refresh_vocabulary_deck_item_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.vocabulary_decks
    set item_count = greatest(item_count - 1, 0), updated_at = now()
    where id = old.deck_id;
    return old;
  end if;

  update public.vocabulary_decks
  set item_count = item_count + 1, updated_at = now()
  where id = new.deck_id;
  return new;
end;
$$;

drop trigger if exists vocabulary_deck_items_count_trigger on public.vocabulary_deck_items;
create trigger vocabulary_deck_items_count_trigger
after insert or delete on public.vocabulary_deck_items
for each row execute function public.refresh_vocabulary_deck_item_count();

create or replace function public.refresh_vocabulary_deck_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.vocabulary_decks
    set follower_count = greatest(follower_count - 1, 0), updated_at = now()
    where id = old.deck_id;
    return old;
  end if;

  update public.vocabulary_decks
  set follower_count = follower_count + 1, updated_at = now()
  where id = new.deck_id;
  return new;
end;
$$;

drop trigger if exists vocabulary_deck_follows_count_trigger on public.vocabulary_deck_follows;
create trigger vocabulary_deck_follows_count_trigger
after insert or delete on public.vocabulary_deck_follows
for each row execute function public.refresh_vocabulary_deck_follower_count();

-- A public deck that becomes private should stop being followed immediately.
create or replace function public.clear_private_vocabulary_deck_follows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.visibility = 'public' and new.visibility = 'private' then
    delete from public.vocabulary_deck_follows where deck_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists vocabulary_deck_private_cleanup_trigger on public.vocabulary_decks;
create trigger vocabulary_deck_private_cleanup_trigger
after update of visibility on public.vocabulary_decks
for each row execute function public.clear_private_vocabulary_deck_follows();

alter table public.vocabulary_decks enable row level security;
alter table public.vocabulary_deck_items enable row level security;
alter table public.vocabulary_deck_follows enable row level security;

-- Public decks are discoverable. Private decks are only visible to their owner.
drop policy if exists "vocabulary decks read" on public.vocabulary_decks;
create policy "vocabulary decks read" on public.vocabulary_decks
  for select to anon, authenticated
  using (
    visibility = 'public'
    or exists (
      select 1 from public.users u
      where u.uid = vocabulary_decks.owner_user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "vocabulary decks own insert" on public.vocabulary_decks;
create policy "vocabulary decks own insert" on public.vocabulary_decks
  for insert to authenticated
  with check (
    is_official = false
    and exists (
      select 1 from public.users u
      where u.uid = vocabulary_decks.owner_user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "vocabulary decks own update" on public.vocabulary_decks;
create policy "vocabulary decks own update" on public.vocabulary_decks
  for update to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.uid = vocabulary_decks.owner_user_id
        and u.auth_id = auth.uid()
    )
  )
  with check (
    is_official = false
    and exists (
      select 1 from public.users u
      where u.uid = vocabulary_decks.owner_user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "vocabulary decks own delete" on public.vocabulary_decks;
create policy "vocabulary decks own delete" on public.vocabulary_decks
  for delete to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.uid = vocabulary_decks.owner_user_id
        and u.auth_id = auth.uid()
    )
  );

-- Deck items inherit deck visibility for reads; only the deck owner can curate.
drop policy if exists "vocabulary deck items read" on public.vocabulary_deck_items;
create policy "vocabulary deck items read" on public.vocabulary_deck_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.vocabulary_decks d
      where d.id = vocabulary_deck_items.deck_id
        and (
          d.visibility = 'public'
          or exists (
            select 1 from public.users u
            where u.uid = d.owner_user_id
              and u.auth_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "vocabulary deck items owner insert" on public.vocabulary_deck_items;
create policy "vocabulary deck items owner insert" on public.vocabulary_deck_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.vocabulary_decks d
      join public.users u on u.uid = d.owner_user_id
      where d.id = vocabulary_deck_items.deck_id
        and u.auth_id = auth.uid()
    )
    and (
      meaning_id is null
      or exists (
        select 1 from public.dictionary_meanings dm
        where dm.id = vocabulary_deck_items.meaning_id
          and dm.entry_id = vocabulary_deck_items.entry_id
      )
    )
  );

drop policy if exists "vocabulary deck items owner update" on public.vocabulary_deck_items;
create policy "vocabulary deck items owner update" on public.vocabulary_deck_items
  for update to authenticated
  using (
    exists (
      select 1 from public.vocabulary_decks d
      join public.users u on u.uid = d.owner_user_id
      where d.id = vocabulary_deck_items.deck_id
        and u.auth_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vocabulary_decks d
      join public.users u on u.uid = d.owner_user_id
      where d.id = vocabulary_deck_items.deck_id
        and u.auth_id = auth.uid()
    )
    and (
      meaning_id is null
      or exists (
        select 1 from public.dictionary_meanings dm
        where dm.id = vocabulary_deck_items.meaning_id
          and dm.entry_id = vocabulary_deck_items.entry_id
      )
    )
  );

drop policy if exists "vocabulary deck items owner delete" on public.vocabulary_deck_items;
create policy "vocabulary deck items owner delete" on public.vocabulary_deck_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.vocabulary_decks d
      join public.users u on u.uid = d.owner_user_id
      where d.id = vocabulary_deck_items.deck_id
        and u.auth_id = auth.uid()
    )
  );

-- Follow membership is private. Counts are denormalized on vocabulary_decks.
drop policy if exists "vocabulary deck follows own read" on public.vocabulary_deck_follows;
create policy "vocabulary deck follows own read" on public.vocabulary_deck_follows
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.uid = vocabulary_deck_follows.user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "vocabulary deck follows own insert" on public.vocabulary_deck_follows;
create policy "vocabulary deck follows own insert" on public.vocabulary_deck_follows
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.uid = vocabulary_deck_follows.user_id
        and u.auth_id = auth.uid()
    )
    and exists (
      select 1 from public.vocabulary_decks d
      where d.id = vocabulary_deck_follows.deck_id
        and d.visibility = 'public'
        and (d.owner_user_id is null or d.owner_user_id <> vocabulary_deck_follows.user_id)
    )
  );

drop policy if exists "vocabulary deck follows own delete" on public.vocabulary_deck_follows;
create policy "vocabulary deck follows own delete" on public.vocabulary_deck_follows
  for delete to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.uid = vocabulary_deck_follows.user_id
        and u.auth_id = auth.uid()
    )
  );

-- Seed one small official deck so the discovery experience is useful from day one.
insert into public.vocabulary_decks (
  name, description, visibility, icon, theme, is_official, system_key
)
values (
  'Business English Starter',
  'A compact starter deck of useful vocabulary for business and technology discussions.',
  'public',
  '☕',
  'orange',
  true,
  'official-business-starter'
)
on conflict (system_key) where system_key is not null do update
set name = excluded.name,
    description = excluded.description,
    visibility = 'public',
    icon = excluded.icon,
    theme = excluded.theme,
    updated_at = now();

insert into public.vocabulary_deck_items (deck_id, entry_id, meaning_id, position)
select
  d.id,
  e.id,
  (
    select dm.id
    from public.dictionary_meanings dm
    where dm.entry_id = e.id
    order by case when dm.source = 'wiktionary' then 0 else 1 end,
             dm.meaning_order,
             dm.id
    limit 1
  ),
  x.position
from public.vocabulary_decks d
join (
  values
    ('leverage', 1),
    ('benchmark', 2),
    ('milestone', 3),
    ('scalable', 4)
) as x(normalized_term, position) on true
join public.dictionary_entries e
  on e.language_code = 'en'
 and e.normalized_term = x.normalized_term
where d.system_key = 'official-business-starter'
on conflict do nothing;
