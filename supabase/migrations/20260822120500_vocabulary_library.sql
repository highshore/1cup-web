-- Shared dictionary + per-member vocabulary collection.
--
-- Dictionary content is global. Member rows only store ownership and learning state.
-- `dictionary_meanings` intentionally uses product-friendly names rather than
-- linguistics-heavy `sense` / `part_of_speech` terminology.

create table if not exists public.dictionary_entries (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  normalized_term text not null,
  entry_type text not null default 'word',
  language_code text not null default 'en',
  source text,
  source_url text,
  source_license text,
  source_dataset text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dictionary_entries_entry_type_check
    check (entry_type in ('word', 'expression')),
  constraint dictionary_entries_language_term_key
    unique (language_code, normalized_term)
);

create table if not exists public.dictionary_meanings (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  source_meaning_id text,
  grammar_type text not null default 'unknown',
  definition_en text not null,
  definition_ko text,
  usage_labels text[] not null default '{}'::text[],
  synonyms text[] not null default '{}'::text[],
  antonyms text[] not null default '{}'::text[],
  pronunciation_ipa text,
  meaning_order integer not null default 0,
  source text not null,
  source_url text,
  source_license text,
  source_dataset text,
  source_metadata jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dictionary_meanings_entry_id_fkey
    foreign key (entry_id) references public.dictionary_entries(id) on delete cascade
);

create unique index if not exists dictionary_meanings_source_id_key
  on public.dictionary_meanings(source, source_meaning_id)
  where source_meaning_id is not null;
create index if not exists dictionary_meanings_entry_idx
  on public.dictionary_meanings(entry_id, meaning_order, id);
create index if not exists dictionary_entries_term_search_idx
  on public.dictionary_entries(normalized_term);

create table if not exists public.article_vocabulary (
  article_id text not null,
  meaning_id uuid not null,
  example_en text,
  example_ko text,
  is_key_vocabulary boolean not null default true,
  source_order integer,
  created_at timestamptz not null default now(),
  constraint article_vocabulary_pkey primary key (article_id, meaning_id),
  constraint article_vocabulary_article_id_fkey
    foreign key (article_id) references public.articles(id) on delete cascade,
  constraint article_vocabulary_meaning_id_fkey
    foreign key (meaning_id) references public.dictionary_meanings(id) on delete cascade
);

create index if not exists article_vocabulary_meaning_idx
  on public.article_vocabulary(meaning_id);

create table if not exists public.user_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  entry_id uuid not null,
  meaning_id uuid,
  source_article_id text,
  saved_at timestamptz not null default now(),
  learning_status text not null default 'saved',
  last_reviewed_at timestamptz,
  note text,
  updated_at timestamptz not null default now(),
  constraint user_vocabulary_user_id_fkey
    foreign key (user_id) references public.users(uid) on delete cascade,
  constraint user_vocabulary_entry_id_fkey
    foreign key (entry_id) references public.dictionary_entries(id) on delete cascade,
  constraint user_vocabulary_meaning_id_fkey
    foreign key (meaning_id) references public.dictionary_meanings(id) on delete set null,
  constraint user_vocabulary_source_article_id_fkey
    foreign key (source_article_id) references public.articles(id) on delete set null,
  constraint user_vocabulary_learning_status_check
    check (learning_status in ('saved', 'learning', 'learned'))
);

-- NULL meaning_id is a deliberate migration bridge for legacy saved words whose
-- exact dictionary meaning has not been identified yet.
create unique index if not exists user_vocabulary_unique_item_idx
  on public.user_vocabulary(
    user_id,
    entry_id,
    coalesce(meaning_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists user_vocabulary_user_saved_idx
  on public.user_vocabulary(user_id, saved_at desc);
create index if not exists user_vocabulary_entry_idx
  on public.user_vocabulary(entry_id);

-- Seed the entry catalogue from the application's existing vocabulary inventory.
insert into public.dictionary_entries (
  term, normalized_term, entry_type, language_code,
  source, source_dataset
)
select
  trim(w.word),
  lower(regexp_replace(trim(w.word), '\s+', ' ', 'g')),
  case when trim(w.word) ~ '\s' then 'expression' else 'word' end,
  'en',
  'one_cup_legacy',
  'public.words'
from public.words w
where nullif(trim(w.word), '') is not null
on conflict (language_code, normalized_term) do nothing;

-- Preserve the old global definitions as explicitly-labelled legacy meanings.
-- Wiktionary imports can coexist with these rows and become the preferred source.
insert into public.dictionary_meanings (
  entry_id,
  source_meaning_id,
  grammar_type,
  definition_en,
  definition_ko,
  synonyms,
  antonyms,
  meaning_order,
  source,
  source_dataset,
  is_verified
)
select
  e.id,
  'legacy:' || e.normalized_term,
  coalesce(nullif(w.categories -> 'english' ->> 0, ''), 'unknown'),
  w.definitions ->> 'english',
  nullif(w.definitions ->> 'korean', ''),
  coalesce(w.synonyms, '{}'::text[]),
  coalesce(w.antonyms, '{}'::text[]),
  0,
  'one_cup_legacy',
  'public.words',
  false
from public.words w
join public.dictionary_entries e
  on e.language_code = 'en'
 and e.normalized_term = lower(regexp_replace(trim(w.word), '\s+', ' ', 'g'))
where nullif(w.definitions ->> 'english', '') is not null
on conflict do nothing;

-- Add every current article keyword/expression to the shared entry catalogue so
-- a member can save it even before a Wiktionary meaning has been imported.
insert into public.dictionary_entries (
  term, normalized_term, entry_type, language_code,
  source, source_dataset
)
select distinct
  trim(keyword.term),
  lower(regexp_replace(trim(keyword.term), '\s+', ' ', 'g')),
  case when trim(keyword.term) ~ '\s' then 'expression' else 'word' end,
  'en',
  'one_cup_article',
  'articles.keywords'
from public.articles a
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(a.keywords) = 'array' then a.keywords else '[]'::jsonb end
) as keyword(term)
where nullif(trim(keyword.term), '') is not null
on conflict (language_code, normalized_term) do nothing;

-- Backfill legacy per-user saved_words without dropping the original column.
insert into public.dictionary_entries (
  term, normalized_term, entry_type, language_code,
  source, source_dataset
)
select distinct
  trim(saved.term),
  lower(regexp_replace(trim(saved.term), '\s+', ' ', 'g')),
  case when trim(saved.term) ~ '\s' then 'expression' else 'word' end,
  'en',
  'one_cup_legacy_saved',
  'users.saved_words'
from public.users u
cross join lateral unnest(coalesce(u.saved_words, '{}'::text[])) as saved(term)
where nullif(trim(saved.term), '') is not null
on conflict (language_code, normalized_term) do nothing;

insert into public.user_vocabulary (user_id, entry_id, meaning_id, learning_status)
select
  u.uid,
  e.id,
  null,
  'saved'
from public.users u
cross join lateral unnest(coalesce(u.saved_words, '{}'::text[])) as saved(term)
join public.dictionary_entries e
  on e.language_code = 'en'
 and e.normalized_term = lower(regexp_replace(trim(saved.term), '\s+', ' ', 'g'))
where nullif(trim(saved.term), '') is not null
on conflict do nothing;

alter table public.dictionary_entries enable row level security;
alter table public.dictionary_meanings enable row level security;
alter table public.article_vocabulary enable row level security;
alter table public.user_vocabulary enable row level security;

-- Dictionary data is customer-facing reference material. Only admins/service-role
-- write it; normal members can read it.
drop policy if exists "dictionary entries read" on public.dictionary_entries;
create policy "dictionary entries read" on public.dictionary_entries
  for select to anon, authenticated using (true);

drop policy if exists "dictionary entries admin write" on public.dictionary_entries;
create policy "dictionary entries admin write" on public.dictionary_entries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "dictionary meanings read" on public.dictionary_meanings;
create policy "dictionary meanings read" on public.dictionary_meanings
  for select to anon, authenticated using (true);

drop policy if exists "dictionary meanings admin write" on public.dictionary_meanings;
create policy "dictionary meanings admin write" on public.dictionary_meanings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "article vocabulary read" on public.article_vocabulary;
create policy "article vocabulary read" on public.article_vocabulary
  for select to anon, authenticated using (true);

drop policy if exists "article vocabulary admin write" on public.article_vocabulary;
create policy "article vocabulary admin write" on public.article_vocabulary
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A member can only see and mutate their own vocabulary collection.
drop policy if exists "user vocabulary own read" on public.user_vocabulary;
create policy "user vocabulary own read" on public.user_vocabulary
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.uid = user_vocabulary.user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "user vocabulary own insert" on public.user_vocabulary;
create policy "user vocabulary own insert" on public.user_vocabulary
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.uid = user_vocabulary.user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "user vocabulary own update" on public.user_vocabulary;
create policy "user vocabulary own update" on public.user_vocabulary
  for update to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.uid = user_vocabulary.user_id
        and u.auth_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.uid = user_vocabulary.user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "user vocabulary own delete" on public.user_vocabulary;
create policy "user vocabulary own delete" on public.user_vocabulary
  for delete to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.uid = user_vocabulary.user_id
        and u.auth_id = auth.uid()
    )
  );

-- Atomic member save. This avoids the previous read-modify-write race on
-- users.saved_words and also guarantees that every saved term has one shared
-- dictionary entry. If an article has already been mapped to a meaning, save that
-- exact meaning; otherwise preserve the entry-level save until mapping is ready.
create or replace function public.save_vocabulary_term(
  p_term text,
  p_source_article_id text default null,
  p_meaning_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_normalized text;
  v_entry_id uuid;
  v_meaning_id uuid;
  v_saved_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select u.uid into v_user_id
  from public.users u
  where u.auth_id = auth.uid()
  limit 1;

  if v_user_id is null then
    raise exception 'Member profile not found';
  end if;

  v_normalized := lower(regexp_replace(trim(coalesce(p_term, '')), '\s+', ' ', 'g'));
  if v_normalized = '' then
    raise exception 'Term is required';
  end if;

  insert into public.dictionary_entries (
    term, normalized_term, entry_type, language_code,
    source, source_dataset
  ) values (
    trim(p_term),
    v_normalized,
    case when trim(p_term) ~ '\s' then 'expression' else 'word' end,
    'en',
    'one_cup_member_save',
    'runtime'
  )
  on conflict (language_code, normalized_term)
  do update set updated_at = now()
  returning id into v_entry_id;

  v_meaning_id := p_meaning_id;

  if v_meaning_id is not null and not exists (
    select 1 from public.dictionary_meanings dm
    where dm.id = v_meaning_id and dm.entry_id = v_entry_id
  ) then
    raise exception 'Meaning does not belong to term';
  end if;

  if v_meaning_id is null and p_source_article_id is not null then
    select av.meaning_id into v_meaning_id
    from public.article_vocabulary av
    join public.dictionary_meanings dm on dm.id = av.meaning_id
    where av.article_id = p_source_article_id
      and dm.entry_id = v_entry_id
    order by av.source_order nulls last, dm.meaning_order, dm.id
    limit 1;
  end if;

  -- Upgrade an old entry-level save when a specific meaning is now known.
  if v_meaning_id is not null then
    update public.user_vocabulary uv
    set meaning_id = v_meaning_id,
        source_article_id = coalesce(p_source_article_id, uv.source_article_id),
        updated_at = now()
    where uv.user_id = v_user_id
      and uv.entry_id = v_entry_id
      and uv.meaning_id is null
    returning uv.id into v_saved_id;

    if v_saved_id is not null then
      return v_saved_id;
    end if;
  end if;

  select uv.id into v_saved_id
  from public.user_vocabulary uv
  where uv.user_id = v_user_id
    and uv.entry_id = v_entry_id
    and uv.meaning_id is not distinct from v_meaning_id
  limit 1;

  if v_saved_id is not null then
    return v_saved_id;
  end if;

  insert into public.user_vocabulary (
    user_id, entry_id, meaning_id, source_article_id, learning_status
  ) values (
    v_user_id, v_entry_id, v_meaning_id, p_source_article_id, 'saved'
  )
  returning id into v_saved_id;

  return v_saved_id;
end;
$$;

revoke all on function public.save_vocabulary_term(text, text, uuid) from public;
grant execute on function public.save_vocabulary_term(text, text, uuid) to authenticated;
