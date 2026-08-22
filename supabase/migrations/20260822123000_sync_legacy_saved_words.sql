-- Compatibility bridge while the article page is cut over from users.saved_words.
-- Existing UI only adds saved words, so preserve the union on concurrent/stale
-- writes instead of allowing one browser tab to overwrite another tab's additions.

create or replace function public.preserve_legacy_saved_words()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.saved_words is distinct from old.saved_words then
    select coalesce(array_agg(distinct term order by term), '{}'::text[])
      into new.saved_words
    from unnest(
      coalesce(old.saved_words, '{}'::text[]) || coalesce(new.saved_words, '{}'::text[])
    ) as value(term)
    where nullif(trim(term), '') is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_legacy_saved_words_before_update on public.users;
create trigger preserve_legacy_saved_words_before_update
before update of saved_words on public.users
for each row execute function public.preserve_legacy_saved_words();

create or replace function public.sync_legacy_saved_words_to_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term text;
  v_normalized text;
  v_entry_id uuid;
begin
  foreach v_term in array coalesce(new.saved_words, '{}'::text[])
  loop
    v_normalized := lower(regexp_replace(trim(v_term), '\s+', ' ', 'g'));
    if v_normalized = '' then
      continue;
    end if;

    insert into public.dictionary_entries (
      term, normalized_term, entry_type, language_code,
      source, source_dataset
    ) values (
      trim(v_term),
      v_normalized,
      case when trim(v_term) ~ '\s' then 'expression' else 'word' end,
      'en',
      'one_cup_legacy_saved',
      'users.saved_words'
    )
    on conflict (language_code, normalized_term)
    do update set updated_at = now()
    returning id into v_entry_id;

    insert into public.user_vocabulary (
      user_id, entry_id, meaning_id, learning_status
    ) values (
      new.uid, v_entry_id, null, 'saved'
    )
    on conflict do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists sync_legacy_saved_words_after_write on public.users;
create trigger sync_legacy_saved_words_after_write
after insert or update of saved_words on public.users
for each row execute function public.sync_legacy_saved_words_to_collection();
