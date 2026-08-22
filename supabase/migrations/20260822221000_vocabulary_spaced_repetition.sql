-- Anki-style spaced repetition for vocabulary decks.
--
-- Deck content stays shared, while each member gets independent scheduler state.
-- One study-card row is kept per scheduler so members can switch algorithms
-- without destroying progress made with another scheduler.

create table if not exists public.vocabulary_deck_study_preferences (
  user_id text not null,
  deck_id uuid not null,
  scheduler_algorithm text not null default 'fsrs',
  queue_strategy text not null default 'due_first',
  desired_retention numeric(4,3) not null default 0.900,
  daily_new_limit integer not null default 20,
  daily_review_limit integer not null default 200,
  maximum_interval_days integer not null default 36500,
  enable_fuzz boolean not null default true,
  learning_steps text[] not null default array['1m', '10m']::text[],
  relearning_steps text[] not null default array['10m']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_deck_study_preferences_pkey primary key (user_id, deck_id),
  constraint vocabulary_deck_study_preferences_user_id_fkey
    foreign key (user_id) references public.users(uid) on delete cascade,
  constraint vocabulary_deck_study_preferences_deck_id_fkey
    foreign key (deck_id) references public.vocabulary_decks(id) on delete cascade,
  constraint vocabulary_deck_study_preferences_algorithm_check
    check (scheduler_algorithm in ('fsrs', 'anki_legacy', 'leitner')),
  constraint vocabulary_deck_study_preferences_queue_check
    check (queue_strategy in ('due_first', 'frequency')),
  constraint vocabulary_deck_study_preferences_retention_check
    check (desired_retention between 0.700 and 0.990),
  constraint vocabulary_deck_study_preferences_new_limit_check
    check (daily_new_limit between 0 and 500),
  constraint vocabulary_deck_study_preferences_review_limit_check
    check (daily_review_limit between 1 and 2000),
  constraint vocabulary_deck_study_preferences_max_interval_check
    check (maximum_interval_days between 1 and 36500),
  constraint vocabulary_deck_study_preferences_learning_steps_check
    check (cardinality(learning_steps) <= 8),
  constraint vocabulary_deck_study_preferences_relearning_steps_check
    check (cardinality(relearning_steps) <= 8)
);

create index if not exists vocabulary_deck_study_preferences_deck_idx
  on public.vocabulary_deck_study_preferences(deck_id, user_id);

create table if not exists public.vocabulary_study_cards (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  deck_id uuid not null,
  entry_id uuid not null,
  meaning_id uuid,
  algorithm text not null,
  state text not null default 'new',
  scheduler_state jsonb not null default '{}'::jsonb,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  review_count integer not null default 0,
  lapse_count integer not null default 0,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_study_cards_user_id_fkey
    foreign key (user_id) references public.users(uid) on delete cascade,
  constraint vocabulary_study_cards_deck_id_fkey
    foreign key (deck_id) references public.vocabulary_decks(id) on delete cascade,
  constraint vocabulary_study_cards_entry_id_fkey
    foreign key (entry_id) references public.dictionary_entries(id) on delete cascade,
  constraint vocabulary_study_cards_meaning_id_fkey
    foreign key (meaning_id) references public.dictionary_meanings(id) on delete set null,
  constraint vocabulary_study_cards_algorithm_check
    check (algorithm in ('fsrs', 'anki_legacy', 'leitner')),
  constraint vocabulary_study_cards_state_check
    check (state in ('new', 'learning', 'review', 'relearning')),
  constraint vocabulary_study_cards_counts_check
    check (review_count >= 0 and lapse_count >= 0 and version >= 0)
);

create unique index if not exists vocabulary_study_cards_unique_scheduler_idx
  on public.vocabulary_study_cards(
    user_id,
    deck_id,
    entry_id,
    coalesce(meaning_id, '00000000-0000-0000-0000-000000000000'::uuid),
    algorithm
  );
create index if not exists vocabulary_study_cards_due_idx
  on public.vocabulary_study_cards(user_id, deck_id, algorithm, due_at, id);
create index if not exists vocabulary_study_cards_state_idx
  on public.vocabulary_study_cards(user_id, deck_id, algorithm, state, due_at);

create table if not exists public.vocabulary_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  deck_id uuid not null,
  study_card_id uuid,
  entry_id uuid not null,
  meaning_id uuid,
  algorithm text not null,
  rating text not null,
  reviewed_at timestamptz not null default now(),
  response_time_ms integer,
  previous_due_at timestamptz,
  next_due_at timestamptz not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  scheduled_interval_seconds bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint vocabulary_review_events_user_id_fkey
    foreign key (user_id) references public.users(uid) on delete cascade,
  constraint vocabulary_review_events_deck_id_fkey
    foreign key (deck_id) references public.vocabulary_decks(id) on delete cascade,
  constraint vocabulary_review_events_study_card_id_fkey
    foreign key (study_card_id) references public.vocabulary_study_cards(id) on delete set null,
  constraint vocabulary_review_events_entry_id_fkey
    foreign key (entry_id) references public.dictionary_entries(id) on delete cascade,
  constraint vocabulary_review_events_meaning_id_fkey
    foreign key (meaning_id) references public.dictionary_meanings(id) on delete set null,
  constraint vocabulary_review_events_algorithm_check
    check (algorithm in ('fsrs', 'anki_legacy', 'leitner')),
  constraint vocabulary_review_events_rating_check
    check (rating in ('again', 'hard', 'good', 'easy')),
  constraint vocabulary_review_events_response_time_check
    check (response_time_ms is null or response_time_ms between 0 and 3600000),
  constraint vocabulary_review_events_interval_check
    check (scheduled_interval_seconds >= 0)
);

create index if not exists vocabulary_review_events_user_reviewed_idx
  on public.vocabulary_review_events(user_id, reviewed_at desc, id);
create index if not exists vocabulary_review_events_deck_reviewed_idx
  on public.vocabulary_review_events(user_id, deck_id, reviewed_at desc, id);
create index if not exists vocabulary_review_events_card_idx
  on public.vocabulary_review_events(study_card_id, reviewed_at desc, id);

alter table public.vocabulary_deck_study_preferences enable row level security;
alter table public.vocabulary_study_cards enable row level security;
alter table public.vocabulary_review_events enable row level security;

-- Preferences are private to the member. A member may create preferences only for
-- a public deck or their own private/public deck.
drop policy if exists "vocabulary study preferences own read" on public.vocabulary_deck_study_preferences;
create policy "vocabulary study preferences own read"
on public.vocabulary_deck_study_preferences
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_deck_study_preferences.user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "vocabulary study preferences own insert" on public.vocabulary_deck_study_preferences;
create policy "vocabulary study preferences own insert"
on public.vocabulary_deck_study_preferences
for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_deck_study_preferences.user_id
      and u.auth_id = auth.uid()
  )
  and exists (
    select 1 from public.vocabulary_decks d
    where d.id = vocabulary_deck_study_preferences.deck_id
      and (
        d.visibility = 'public'
        or d.owner_user_id = vocabulary_deck_study_preferences.user_id
      )
  )
);

drop policy if exists "vocabulary study preferences own update" on public.vocabulary_deck_study_preferences;
create policy "vocabulary study preferences own update"
on public.vocabulary_deck_study_preferences
for update to authenticated
using (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_deck_study_preferences.user_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_deck_study_preferences.user_id
      and u.auth_id = auth.uid()
  )
  and exists (
    select 1 from public.vocabulary_decks d
    where d.id = vocabulary_deck_study_preferences.deck_id
      and (
        d.visibility = 'public'
        or d.owner_user_id = vocabulary_deck_study_preferences.user_id
      )
  )
);

drop policy if exists "vocabulary study preferences own delete" on public.vocabulary_deck_study_preferences;
create policy "vocabulary study preferences own delete"
on public.vocabulary_deck_study_preferences
for delete to authenticated
using (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_deck_study_preferences.user_id
      and u.auth_id = auth.uid()
  )
);

-- Study state is always private. Read/write is limited to the member and to decks
-- that member can currently access.
drop policy if exists "vocabulary study cards own read" on public.vocabulary_study_cards;
create policy "vocabulary study cards own read"
on public.vocabulary_study_cards
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_study_cards.user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "vocabulary study cards own insert" on public.vocabulary_study_cards;
create policy "vocabulary study cards own insert"
on public.vocabulary_study_cards
for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_study_cards.user_id
      and u.auth_id = auth.uid()
  )
  and exists (
    select 1 from public.vocabulary_decks d
    where d.id = vocabulary_study_cards.deck_id
      and (
        d.visibility = 'public'
        or d.owner_user_id = vocabulary_study_cards.user_id
      )
  )
  and (
    meaning_id is null
    or exists (
      select 1 from public.dictionary_meanings dm
      where dm.id = vocabulary_study_cards.meaning_id
        and dm.entry_id = vocabulary_study_cards.entry_id
    )
  )
);

drop policy if exists "vocabulary study cards own update" on public.vocabulary_study_cards;
create policy "vocabulary study cards own update"
on public.vocabulary_study_cards
for update to authenticated
using (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_study_cards.user_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_study_cards.user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "vocabulary study cards own delete" on public.vocabulary_study_cards;
create policy "vocabulary study cards own delete"
on public.vocabulary_study_cards
for delete to authenticated
using (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_study_cards.user_id
      and u.auth_id = auth.uid()
  )
);

-- Review history is append-only from the client perspective. Members can read
-- their own events; the security-definer RPC below is the only writer.
drop policy if exists "vocabulary review events own read" on public.vocabulary_review_events;
create policy "vocabulary review events own read"
on public.vocabulary_review_events
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.uid = vocabulary_review_events.user_id
      and u.auth_id = auth.uid()
  )
);

create or replace function public.record_vocabulary_review(
  p_study_card_id uuid,
  p_expected_version integer,
  p_rating text,
  p_reviewed_at timestamptz,
  p_response_time_ms integer,
  p_next_due_at timestamptz,
  p_next_state_label text,
  p_next_scheduler_state jsonb,
  p_scheduled_interval_seconds bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_card public.vocabulary_study_cards%rowtype;
  v_new_version integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_rating not in ('again', 'hard', 'good', 'easy') then
    raise exception 'Invalid rating';
  end if;
  if p_next_state_label not in ('new', 'learning', 'review', 'relearning') then
    raise exception 'Invalid next state';
  end if;
  if p_scheduled_interval_seconds < 0 then
    raise exception 'Invalid interval';
  end if;
  if p_response_time_ms is not null and (p_response_time_ms < 0 or p_response_time_ms > 3600000) then
    raise exception 'Invalid response time';
  end if;

  select u.uid into v_user_id
  from public.users u
  where u.auth_id = auth.uid()
  limit 1;

  if v_user_id is null then
    raise exception 'Member profile not found';
  end if;

  select * into v_card
  from public.vocabulary_study_cards sc
  where sc.id = p_study_card_id
    and sc.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Study card not found';
  end if;

  if v_card.version <> p_expected_version then
    raise exception 'Study card changed; refresh required' using errcode = '40001';
  end if;

  v_new_version := v_card.version + 1;

  update public.vocabulary_study_cards
  set scheduler_state = coalesce(p_next_scheduler_state, '{}'::jsonb),
      state = p_next_state_label,
      due_at = p_next_due_at,
      last_reviewed_at = p_reviewed_at,
      review_count = review_count + 1,
      lapse_count = lapse_count + case
        when p_rating = 'again' and v_card.state = 'review' then 1 else 0 end,
      version = v_new_version,
      updated_at = now()
  where id = v_card.id;

  insert into public.vocabulary_review_events (
    user_id,
    deck_id,
    study_card_id,
    entry_id,
    meaning_id,
    algorithm,
    rating,
    reviewed_at,
    response_time_ms,
    previous_due_at,
    next_due_at,
    previous_state,
    next_state,
    scheduled_interval_seconds
  ) values (
    v_card.user_id,
    v_card.deck_id,
    v_card.id,
    v_card.entry_id,
    v_card.meaning_id,
    v_card.algorithm,
    p_rating,
    p_reviewed_at,
    p_response_time_ms,
    v_card.due_at,
    p_next_due_at,
    jsonb_build_object(
      'state', v_card.state,
      'scheduler_state', v_card.scheduler_state,
      'version', v_card.version
    ),
    jsonb_build_object(
      'state', p_next_state_label,
      'scheduler_state', coalesce(p_next_scheduler_state, '{}'::jsonb),
      'version', v_new_version
    ),
    p_scheduled_interval_seconds
  );

  return jsonb_build_object(
    'id', v_card.id,
    'version', v_new_version,
    'state', p_next_state_label,
    'due_at', p_next_due_at,
    'algorithm', v_card.algorithm
  );
end;
$$;

revoke all on function public.record_vocabulary_review(
  uuid, integer, text, timestamptz, integer, timestamptz, text, jsonb, bigint
) from public;
grant execute on function public.record_vocabulary_review(
  uuid, integer, text, timestamptz, integer, timestamptz, text, jsonb, bigint
) to authenticated;
