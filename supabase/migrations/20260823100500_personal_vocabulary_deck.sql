-- Give every member a built-in private vocabulary deck backed by user_vocabulary.
-- The personal deck is a presentation/study surface; user_vocabulary remains the
-- source of truth so article saves and direct dictionary saves stay in sync.

create or replace function public.ensure_personal_vocabulary_deck_for_user(p_user_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck_id uuid;
  v_system_key text := 'personal:' || p_user_id;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'user id is required';
  end if;

  insert into public.vocabulary_decks (
    owner_user_id,
    name,
    description,
    visibility,
    icon,
    theme,
    is_official,
    system_key
  ) values (
    p_user_id,
    'My Vocabulary',
    '',
    'private',
    '📚',
    'orange',
    false,
    v_system_key
  )
  on conflict (system_key) where system_key is not null
  do update set owner_user_id = excluded.owner_user_id
  returning id into v_deck_id;

  insert into public.vocabulary_deck_items (deck_id, entry_id, meaning_id, position)
  select
    v_deck_id,
    uv.entry_id,
    uv.meaning_id,
    null
  from public.user_vocabulary uv
  where uv.user_id = p_user_id
  on conflict do nothing;

  return v_deck_id;
end;
$$;

revoke all on function public.ensure_personal_vocabulary_deck_for_user(text) from public;

create or replace function public.ensure_personal_vocabulary_deck()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
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

  return public.ensure_personal_vocabulary_deck_for_user(v_user_id);
end;
$$;

revoke all on function public.ensure_personal_vocabulary_deck() from public;
grant execute on function public.ensure_personal_vocabulary_deck() to authenticated;

create or replace function public.sync_user_vocabulary_personal_deck()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_deck_id uuid;
  v_new_deck_id uuid;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    v_old_deck_id := public.ensure_personal_vocabulary_deck_for_user(old.user_id);

    delete from public.vocabulary_deck_items di
    where di.deck_id = v_old_deck_id
      and di.entry_id = old.entry_id
      and coalesce(di.meaning_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(old.meaning_id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new_deck_id := public.ensure_personal_vocabulary_deck_for_user(new.user_id);

    insert into public.vocabulary_deck_items (deck_id, entry_id, meaning_id, position)
    values (v_new_deck_id, new.entry_id, new.meaning_id, null)
    on conflict do nothing;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists user_vocabulary_personal_deck_trigger on public.user_vocabulary;
create trigger user_vocabulary_personal_deck_trigger
after insert or update of user_id, entry_id, meaning_id or delete
on public.user_vocabulary
for each row execute function public.sync_user_vocabulary_personal_deck();

-- Backfill a personal deck for every existing member, including members who have
-- not saved a word yet, so "My Vocabulary" is always present on first visit.
do $$
declare
  v_user record;
begin
  for v_user in select uid from public.users loop
    perform public.ensure_personal_vocabulary_deck_for_user(v_user.uid);
  end loop;
end;
$$;
