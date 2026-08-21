-- Server-owned campaigns back the Admin notification center. The delivered
-- content continues to live in each member's private system conversation, which
-- is what the navbar bell already reads and receives over Realtime Broadcast.
create table public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by text references public.users(uid) on delete set null,
  audience text not null check (audience in ('all_members', 'active_subscribers', 'selected_members')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  action_label text,
  action_url text,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  created_at timestamptz not null default now(),
  constraint notification_campaigns_action_shape_check check (
    (action_label is null and action_url is null)
    or (action_label is not null and action_url is not null)
  )
);

create table public.notification_deliveries (
  campaign_id uuid not null references public.notification_campaigns(id) on delete cascade,
  user_id text not null references public.users(uid) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (campaign_id, user_id),
  unique (message_id)
);

create index notification_campaigns_created_at_idx
  on public.notification_campaigns (created_at desc, id desc);
create index notification_deliveries_user_delivered_at_idx
  on public.notification_deliveries (user_id, delivered_at desc);

-- Campaign data is accessible to administrators for audit/history only. Browser
-- writes are never allowed: sending flows through the authenticated Next route
-- and the service-role-only RPC below.
alter table public.notification_campaigns enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on table public.notification_campaigns from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;
grant select on table public.notification_campaigns to authenticated;
grant select on table public.notification_deliveries to authenticated;

create policy "notification campaigns admin read"
  on public.notification_campaigns
  for select to authenticated
  using (public.is_admin());

create policy "notification deliveries admin read"
  on public.notification_deliveries
  for select to authenticated
  using (public.is_admin());

-- This function is intentionally service-role-only. It validates the server's
-- admin principal, snapshots a concrete recipient set, creates one campaign,
-- and persists every recipient's system message plus a delivery audit row in a
-- single transaction.
create or replace function public.send_admin_notification(
  p_created_by text,
  p_audience text,
  p_recipient_ids text[],
  p_title text,
  p_body text,
  p_action_label text default null,
  p_action_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign_id uuid;
  v_message_id uuid;
  v_recipient_ids text[];
  v_user_id text;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_action_label text := nullif(btrim(coalesce(p_action_label, '')), '');
  v_action_url text := nullif(btrim(coalesce(p_action_url, '')), '');
  v_requested_count integer;
  v_recipient_count integer;
  v_delivered_count integer := 0;
  v_metadata jsonb;
begin
  if p_created_by is null or not exists (
    select 1
    from public.users u
    where u.uid = p_created_by
      and u.account_status = 'admin'
  ) then
    raise exception 'An administrator is required' using errcode = '42501';
  end if;

  if p_audience not in ('all_members', 'active_subscribers', 'selected_members') then
    raise exception 'Unsupported notification audience' using errcode = '22023';
  end if;

  if char_length(v_title) not between 1 and 120 then
    raise exception 'Notification title must be between 1 and 120 characters' using errcode = '22023';
  end if;

  if char_length(v_body) not between 1 and 4000 then
    raise exception 'Notification message must be between 1 and 4000 characters' using errcode = '22023';
  end if;

  if (v_action_label is null) <> (v_action_url is null) then
    raise exception 'An action needs both a label and an internal URL' using errcode = '22023';
  end if;

  if v_action_label is not null and char_length(v_action_label) > 80 then
    raise exception 'Notification action label is too long' using errcode = '22023';
  end if;

  if v_action_url is not null and (
    char_length(v_action_url) > 500
    or left(v_action_url, 1) <> '/'
    or left(v_action_url, 2) = '//'
    or v_action_url ~ '[[:space:]]'
  ) then
    raise exception 'Notification action URL must be an internal path' using errcode = '22023';
  end if;

  if p_audience = 'all_members' then
    select coalesce(array_agg(u.uid order by u.uid), array[]::text[])
      into v_recipient_ids
      from public.users u
     where coalesce(u.is_placeholder, false) = false
       and coalesce(u.account_status, 'user') <> 'admin';
  elsif p_audience = 'active_subscribers' then
    select coalesce(array_agg(u.uid order by u.uid), array[]::text[])
      into v_recipient_ids
      from public.users u
     where coalesce(u.is_placeholder, false) = false
       and coalesce(u.account_status, 'user') <> 'admin'
       and coalesce(u.has_active_subscription, false) = true;
  else
    if cardinality(p_recipient_ids) is null or cardinality(p_recipient_ids) = 0 then
      raise exception 'Select at least one member' using errcode = '22023';
    end if;

    if cardinality(p_recipient_ids) > 1000 or exists (
      select 1 from unnest(p_recipient_ids) as requested(uid)
      where requested.uid is null or btrim(requested.uid) = ''
    ) then
      raise exception 'Invalid selected members' using errcode = '22023';
    end if;

    select count(distinct requested.uid)::integer
      into v_requested_count
      from unnest(p_recipient_ids) as requested(uid);

    select coalesce(array_agg(u.uid order by u.uid), array[]::text[])
      into v_recipient_ids
      from public.users u
     where u.uid = any(p_recipient_ids)
       and coalesce(u.is_placeholder, false) = false;

    if cardinality(v_recipient_ids) <> v_requested_count then
      raise exception 'One or more selected members are unavailable' using errcode = '23503';
    end if;
  end if;

  v_recipient_count := cardinality(v_recipient_ids);
  if v_recipient_count = 0 then
    raise exception 'No eligible members matched this audience' using errcode = '22023';
  end if;

  insert into public.notification_campaigns (
    created_by,
    audience,
    title,
    body,
    action_label,
    action_url,
    recipient_count,
    delivered_count
  ) values (
    p_created_by,
    p_audience,
    v_title,
    v_body,
    v_action_label,
    v_action_url,
    v_recipient_count,
    0
  )
  returning id into v_campaign_id;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'title', v_title,
    'campaignId', v_campaign_id,
    'actionLabel', v_action_label,
    'actionUrl', v_action_url
  ));

  foreach v_user_id in array v_recipient_ids loop
    v_message_id := public.send_system_message(
      v_user_id,
      'system',
      v_body,
      v_metadata
    );

    insert into public.notification_deliveries (campaign_id, user_id, message_id)
    values (v_campaign_id, v_user_id, v_message_id);

    v_delivered_count := v_delivered_count + 1;
  end loop;

  update public.notification_campaigns
     set delivered_count = v_delivered_count
   where id = v_campaign_id;

  return jsonb_build_object(
    'campaignId', v_campaign_id,
    'recipientCount', v_recipient_count,
    'deliveredCount', v_delivered_count
  );
end;
$function$;

revoke execute on function public.send_admin_notification(text, text, text[], text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.send_admin_notification(text, text, text[], text, text, text, text)
  to service_role;
