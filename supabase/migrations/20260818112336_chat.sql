-- Private, persisted member messaging. 1 Cup's durable member identifier is
-- public.users.uid (text), not auth.users.id: one member can authenticate with
-- both Kakao and phone OTP. Conversation/message records still use UUIDs.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------- chat tables
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'system', 'group')),
  created_by text references public.users(uid) on delete set null,
  dm_key text,
  system_owner_user_id text references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_shape_check check (
    (type = 'dm' and dm_key is not null and system_owner_user_id is null)
    or (type = 'system' and dm_key is null and system_owner_user_id is not null)
    or (type = 'group' and dm_key is null and system_owner_user_id is null)
  )
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id text not null references public.users(uid) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id text references public.users(uid) on delete set null,
  type text not null check (type in ('text', 'system', 'meetup')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint messages_body_check check (
    char_length(body) between 1 and 4000 and char_length(btrim(body)) > 0
  ),
  constraint messages_sender_shape_check check (
    (type = 'text' and sender_id is not null)
    or (type in ('system', 'meetup') and sender_id is null)
  )
);

create table public.user_blocks (
  blocker_id text not null references public.users(uid) on delete cascade,
  blocked_user_id text not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint user_blocks_not_self_check check (blocker_id <> blocked_user_id)
);

create unique index conversations_dm_key_unique
  on public.conversations (dm_key)
  where dm_key is not null;

create unique index conversations_system_owner_unique
  on public.conversations (system_owner_user_id)
  where system_owner_user_id is not null;

create index conversations_updated_at_idx
  on public.conversations (updated_at desc, id desc);
create index conversation_members_user_conversation_idx
  on public.conversation_members (user_id, conversation_id);
create index messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc, id desc);
create index user_blocks_blocked_user_idx
  on public.user_blocks (blocked_user_id, blocker_id);

-- -------------------------------------------------------- authorization helpers
-- These functions are intentionally in a non-exposed schema. Authenticated users
-- need EXECUTE only because RLS evaluates them; they are not PostgREST RPCs.
create or replace function private.is_chat_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.conversation_members cm
       join public.conversations c on c.id = cm.conversation_id
       where cm.conversation_id = p_conversation_id
         and cm.user_id = public.current_uid()
         and (c.type <> 'system' or c.system_owner_user_id = public.current_uid())
     );
$function$;

create or replace function private.can_send_dm(p_conversation_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id text;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  v_user_id := public.current_uid();
  if v_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and c.type = 'dm'
      and exists (
        select 1
        from public.conversation_members me
        where me.conversation_id = c.id
          and me.user_id = v_user_id
      )
      and 2 = (
        select count(*)
        from public.conversation_members cm
        where cm.conversation_id = c.id
      )
      and not exists (
        select 1
        from public.conversation_members other_member
        join public.user_blocks b
          on (
            (b.blocker_id = v_user_id and b.blocked_user_id = other_member.user_id)
            or (b.blocker_id = other_member.user_id and b.blocked_user_id = v_user_id)
          )
        where other_member.conversation_id = c.id
          and other_member.user_id <> v_user_id
      )
  );
end;
$function$;

create or replace function private.can_receive_chat_broadcast(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.conversation_members cm
       join public.conversations c on c.id = cm.conversation_id
       where p_topic = 'conversation:' || cm.conversation_id::text
         and cm.user_id = public.current_uid()
         and (c.type <> 'system' or c.system_owner_user_id = public.current_uid())
     );
$function$;

revoke all on function private.is_chat_member(uuid) from public;
revoke all on function private.can_send_dm(uuid) from public;
revoke all on function private.can_receive_chat_broadcast(text) from public;
grant execute on function private.is_chat_member(uuid) to authenticated, service_role;
grant execute on function private.can_send_dm(uuid) to authenticated, service_role;
grant execute on function private.can_receive_chat_broadcast(text) to authenticated, service_role;

-- --------------------------------------- atomic, authenticated conversation RPCs
create or replace function public.get_or_create_dm(p_other_user_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id text;
  v_dm_key text;
  v_conversation_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_user_id := public.current_uid();
  if v_user_id is null then
    raise exception 'Member profile not found' using errcode = '28000';
  end if;

  if p_other_user_id is null or btrim(p_other_user_id) = '' then
    raise exception 'A recipient is required' using errcode = '22023';
  end if;

  if p_other_user_id = v_user_id then
    raise exception 'You cannot message yourself' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.uid = p_other_user_id
      and coalesce(u.is_placeholder, false) = false
  ) then
    raise exception 'Member not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = v_user_id and b.blocked_user_id = p_other_user_id)
       or (b.blocker_id = p_other_user_id and b.blocked_user_id = v_user_id)
  ) then
    raise exception 'Messaging is unavailable for this conversation' using errcode = 'P0001';
  end if;

  -- The lexically normalized key, plus the unique partial index below, makes the
  -- operation race-safe even when both members open the room at the same time.
  v_dm_key := least(v_user_id, p_other_user_id) || ':' || greatest(v_user_id, p_other_user_id);

  insert into public.conversations (type, created_by, dm_key)
  values ('dm', v_user_id, v_dm_key)
  on conflict (dm_key) where dm_key is not null do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select c.id into v_conversation_id
    from public.conversations c
    where c.dm_key = v_dm_key;
  end if;

  if v_conversation_id is null then
    raise exception 'Unable to create conversation' using errcode = 'P0001';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values
    (v_conversation_id, v_user_id, 'member'),
    (v_conversation_id, p_other_user_id, 'member')
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$function$;

create or replace function public.get_or_create_system_conversation()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id text;
  v_conversation_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_user_id := public.current_uid();
  if v_user_id is null then
    raise exception 'Member profile not found' using errcode = '28000';
  end if;

  insert into public.conversations (type, created_by, system_owner_user_id)
  values ('system', v_user_id, v_user_id)
  on conflict (system_owner_user_id) where system_owner_user_id is not null do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select c.id into v_conversation_id
    from public.conversations c
    where c.system_owner_user_id = v_user_id;
  end if;

  if v_conversation_id is null then
    raise exception 'Unable to create system conversation' using errcode = 'P0001';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conversation_id, v_user_id, 'admin')
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$function$;

-- Gives the client only the status it needs for its own DM. A block created by
-- the other participant is deliberately reported as the generic unavailable
-- state, preserving that member's privacy.
create or replace function public.get_dm_messaging_status(p_conversation_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id text;
  v_other_user_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_user_id := public.current_uid();
  if v_user_id is null then
    return 'unavailable';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and c.type = 'dm'
      and exists (
        select 1
        from public.conversation_members cm
        where cm.conversation_id = c.id
          and cm.user_id = v_user_id
      )
  ) then
    return 'unavailable';
  end if;

  select cm.user_id into v_other_user_id
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.user_id <> v_user_id
  limit 1;

  if v_other_user_id is null then
    return 'unavailable';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where b.blocker_id = v_user_id
      and b.blocked_user_id = v_other_user_id
  ) then
    return 'blocked_by_me';
  end if;

  if private.can_send_dm(p_conversation_id) then
    return 'available';
  end if;

  return 'unavailable';
end;
$function$;

-- Only trusted server-side code using the service-role client can call this RPC.
-- It deliberately has no browser/API grant and is the future hook for push workers.
create or replace function public.send_system_message(
  p_user_id text,
  p_type text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_conversation_id uuid;
  v_message_id uuid;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    raise exception 'A member is required' using errcode = '22023';
  end if;

  if p_type not in ('system', 'meetup') then
    raise exception 'Unsupported system message type' using errcode = '22023';
  end if;

  if p_body is null or char_length(p_body) > 4000 or char_length(btrim(p_body)) = 0 then
    raise exception 'System message body must be between 1 and 4000 characters' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.uid = p_user_id
      and coalesce(u.is_placeholder, false) = false
  ) then
    raise exception 'Member not found' using errcode = '23503';
  end if;

  insert into public.conversations (type, created_by, system_owner_user_id)
  values ('system', p_user_id, p_user_id)
  on conflict (system_owner_user_id) where system_owner_user_id is not null do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select c.id into v_conversation_id
    from public.conversations c
    where c.system_owner_user_id = p_user_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conversation_id, p_user_id, 'admin')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages (conversation_id, sender_id, type, body, metadata)
  values (v_conversation_id, null, p_type, p_body, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_message_id;

  return v_message_id;
end;
$function$;

revoke all on function public.get_or_create_dm(text) from public;
revoke all on function public.get_or_create_system_conversation() from public;
revoke all on function public.get_dm_messaging_status(uuid) from public;
revoke all on function public.send_system_message(text, text, text, jsonb) from public;
grant execute on function public.get_or_create_dm(text) to authenticated;
grant execute on function public.get_or_create_system_conversation() to authenticated;
grant execute on function public.get_dm_messaging_status(uuid) to authenticated;
grant execute on function public.send_system_message(text, text, text, jsonb) to service_role;

-- One query for the conversation list: it returns only RLS-authorized rooms and
-- their latest persisted message, avoiding one message/profile query per room.
create or replace function public.chat_conversation_summaries()
returns table (
  conversation_id uuid,
  conversation_type text,
  conversation_created_at timestamptz,
  conversation_updated_at timestamptz,
  other_user_id text,
  other_display_name text,
  other_photo_url text,
  latest_message_id uuid,
  latest_body text,
  latest_type text,
  latest_metadata jsonb,
  latest_created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    c.id,
    c.type,
    c.created_at,
    c.updated_at,
    other_member.user_id,
    public_member.display_name,
    public_member.photo_url,
    latest_message.id,
    latest_message.body,
    latest_message.type,
    latest_message.metadata,
    latest_message.created_at
  from public.conversations c
  left join lateral (
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = c.id
      and cm.user_id <> public.current_uid()
    limit 1
  ) other_member on c.type = 'dm'
  left join public.public_users public_member
    on public_member.uid = other_member.user_id
  left join lateral (
    select m.id, m.body, m.type, m.metadata, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest_message on true
  where c.type in ('dm', 'system')
    and private.is_chat_member(c.id)
  order by
    case when c.type = 'system' then 0 else 1 end,
    coalesce(latest_message.created_at, c.updated_at) desc,
    c.id desc;
$function$;

revoke all on function public.chat_conversation_summaries() from public;
grant execute on function public.chat_conversation_summaries() to authenticated;

-- --------------------------------------------------------------- row security
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_blocks enable row level security;

revoke all on table public.conversations from anon, authenticated;
revoke all on table public.conversation_members from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.user_blocks from anon, authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.conversation_members to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert, delete on table public.user_blocks to authenticated;

create policy "chat members read conversations"
  on public.conversations
  for select to authenticated
  using (private.is_chat_member(id));

create policy "chat members read memberships"
  on public.conversation_members
  for select to authenticated
  using (private.is_chat_member(conversation_id));

create policy "chat members read messages"
  on public.messages
  for select to authenticated
  using (private.is_chat_member(conversation_id));

create policy "chat members insert their dm messages"
  on public.messages
  for insert to authenticated
  with check (
    sender_id = public.current_uid()
    and type = 'text'
    and private.can_send_dm(conversation_id)
  );

create policy "members read their blocks"
  on public.user_blocks
  for select to authenticated
  using (blocker_id = public.current_uid());

create policy "members create their blocks"
  on public.user_blocks
  for insert to authenticated
  with check (
    blocker_id = public.current_uid()
    and blocker_id <> blocked_user_id
  );

create policy "members remove their blocks"
  on public.user_blocks
  for delete to authenticated
  using (blocker_id = public.current_uid());

-- -------------------------------------------------------- database Broadcast
create or replace function private.touch_chat_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$function$;

create or replace function private.broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform realtime.broadcast_changes(
    'conversation:' || new.conversation_id::text,
    'INSERT',
    'INSERT',
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return new;
end;
$function$;

drop trigger if exists touch_chat_conversation_after_insert on public.messages;
create trigger touch_chat_conversation_after_insert
  after insert on public.messages
  for each row execute function private.touch_chat_conversation();

drop trigger if exists broadcast_chat_message_after_insert on public.messages;
create trigger broadcast_chat_message_after_insert
  after insert on public.messages
  for each row execute function private.broadcast_chat_message();

-- Realtime's RLS is evaluated while a client joins the private channel. There is
-- deliberately no INSERT policy: database triggers are the only broadcast source.
drop policy if exists "chat members receive broadcasts" on realtime.messages;
create policy "chat members receive broadcasts"
  on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and private.can_receive_chat_broadcast(realtime.topic())
  );
