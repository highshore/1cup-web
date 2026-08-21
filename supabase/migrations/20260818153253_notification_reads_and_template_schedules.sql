-- ---------------------------------------------------------------- unread state
-- System messages are private to one member. A separate read marker keeps the
-- immutable message/campaign audit intact while allowing the bell badge to be
-- computed safely for the signed-in member.
create table public.notification_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id text not null default public.current_uid() references public.users(uid) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index notification_reads_user_read_at_idx
  on public.notification_reads (user_id, read_at desc);

alter table public.notification_reads enable row level security;
revoke all on table public.notification_reads from public, anon, authenticated;
grant select, insert on table public.notification_reads to authenticated;

create policy "notification reads own select"
  on public.notification_reads
  for select to authenticated
  using (user_id = public.current_uid());

create policy "notification reads own insert"
  on public.notification_reads
  for insert to authenticated
  with check (
    user_id = public.current_uid()
    and exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = notification_reads.message_id
        and m.type in ('system', 'meetup')
        and c.type = 'system'
        and c.system_owner_user_id = public.current_uid()
    )
  );

create or replace function public.notification_unread_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $function$
  select count(*)::integer
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  left join public.notification_reads r
    on r.message_id = m.id
   and r.user_id = public.current_uid()
  where c.type = 'system'
    and c.system_owner_user_id = public.current_uid()
    and m.type in ('system', 'meetup')
    and r.message_id is null;
$function$;

revoke execute on function public.notification_unread_count() from public, anon;
grant execute on function public.notification_unread_count() to authenticated, service_role;

-- ----------------------------------------------------- reusable notification templates
create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  audience text not null check (audience in ('all_members', 'active_subscribers', 'selected_members')),
  recipient_ids text[] not null default '{}'::text[],
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  action_label text,
  action_url text,
  schedule_enabled boolean not null default false,
  schedule jsonb not null default '{"minute":0,"hour":19,"daysOfWeek":[]}'::jsonb,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by text not null references public.users(uid) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_templates_action_shape_check check (
    (action_label is null and action_url is null)
    or (action_label is not null and action_url is not null)
  )
);

create index notification_templates_due_idx
  on public.notification_templates (next_run_at)
  where schedule_enabled = true;

alter table public.notification_templates enable row level security;
revoke all on table public.notification_templates from public, anon, authenticated;
grant select on table public.notification_templates to authenticated;

create policy "notification templates admin read"
  on public.notification_templates
  for select to authenticated
  using (public.is_admin());

-- Schedules are always evaluated in Korea time. Keeping this in the database
-- means the cron worker and admin UI agree about the next eligible run.
create or replace function private.next_kst_scheduled_at(
  p_schedule jsonb,
  p_after timestamptz
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_minute integer := coalesce((p_schedule ->> 'minute')::integer, 0);
  v_hour integer := coalesce((p_schedule ->> 'hour')::integer, 0);
  v_days integer[] := coalesce(
    array(
      select value::integer
      from jsonb_array_elements_text(coalesce(p_schedule -> 'daysOfWeek', '[]'::jsonb)) as day(value)
      where value ~ '^[0-6]$'
      order by value::integer
    ),
    '{}'::integer[]
  );
  v_local_after timestamp := p_after at time zone 'Asia/Seoul';
  v_candidate timestamp;
  v_offset integer;
begin
  if v_minute not between 0 and 59 or v_hour not between 0 and 23 or cardinality(v_days) = 0 then
    return null;
  end if;

  for v_offset in 0..370 loop
    v_candidate := date_trunc('day', v_local_after)
      + make_interval(days => v_offset, hours => v_hour, mins => v_minute);
    if extract(dow from v_candidate)::integer = any(v_days)
       and v_candidate > v_local_after then
      return v_candidate at time zone 'Asia/Seoul';
    end if;
  end loop;

  return null;
end;
$function$;

revoke all on function private.next_kst_scheduled_at(jsonb, timestamptz) from public;
grant execute on function private.next_kst_scheduled_at(jsonb, timestamptz) to service_role;

-- A small server-only cron target sends every due template transactionally. The
-- cron role invokes this function directly; no browser role can call it.
create or replace function public.process_due_notification_templates()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_template public.notification_templates%rowtype;
  v_now timestamptz := now();
  v_next_run_at timestamptz;
  v_processed integer := 0;
begin
  for v_template in
    select *
    from public.notification_templates
    where schedule_enabled = true
      and next_run_at is not null
      and next_run_at <= v_now
    order by next_run_at, id
    for update skip locked
  loop
    if not exists (
      select 1 from public.users u
      where u.uid = v_template.created_by and u.account_status = 'admin'
    ) then
      update public.notification_templates
         set schedule_enabled = false,
             next_run_at = null,
             updated_at = v_now
       where id = v_template.id;
      continue;
    end if;

    v_next_run_at := private.next_kst_scheduled_at(v_template.schedule, v_now);
    update public.notification_templates
       set next_run_at = v_next_run_at,
           last_run_at = v_now,
           updated_at = v_now
     where id = v_template.id;

    perform public.send_admin_notification(
      v_template.created_by,
      v_template.audience,
      case when v_template.audience = 'selected_members'
        then v_template.recipient_ids else '{}'::text[] end,
      v_template.title,
      v_template.body,
      v_template.action_label,
      v_template.action_url
    );
    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$function$;

revoke execute on function public.process_due_notification_templates() from public, anon, authenticated;
grant execute on function public.process_due_notification_templates() to service_role;

do $block$
begin
  if not exists (select 1 from cron.job where jobname = 'notification-template-tick') then
    perform cron.schedule(
      'notification-template-tick',
      '*/5 * * * *',
      'select public.process_due_notification_templates();'
    );
  end if;
end;
$block$;

-- ------------------------------------------------ marketing schedules per template
alter table public.marketing_templates
  add column if not exists schedule_enabled boolean not null default false,
  add column if not exists schedule jsonb not null default '{"minute":0,"hour":19,"daysOfWeek":[]}'::jsonb,
  add column if not exists next_run_at timestamptz,
  add column if not exists last_run_at timestamptz;

alter table public.marketing_cron_runs
  add column if not exists template_id text references public.marketing_templates(id) on delete set null;

create index if not exists marketing_templates_due_idx
  on public.marketing_templates (next_run_at)
  where schedule_enabled = true;

-- Preserve the current weekday -> template mapping by materializing a separate
-- KST schedule on each matching template. The edge function recalculates all
-- next-run timestamps after deployment, so the obsolete singleton next-run is
-- never reused.
update public.marketing_templates t
   set schedule = jsonb_build_object(
         'minute', coalesce((c.schedule ->> 'minute')::integer, 0),
         'hour', coalesce((c.schedule ->> 'hour')::integer, 19),
         'daysOfWeek', coalesce((
           select jsonb_agg(day.value::integer order by day.value::integer)
           from jsonb_array_elements_text(coalesce(c.schedule -> 'daysOfWeek', '[]'::jsonb)) as day(value)
           where coalesce(c.template_assignments ->> day.value, c.template_id) = t.id
         ), '[]'::jsonb)
       ),
       schedule_enabled = c.enabled and exists (
         select 1
         from jsonb_array_elements_text(coalesce(c.schedule -> 'daysOfWeek', '[]'::jsonb)) as day(value)
         where coalesce(c.template_assignments ->> day.value, c.template_id) = t.id
       ),
       next_run_at = null,
       updated_at = now()
  from public.growth_config c
 where c.id = 'settings';

-- The legacy singleton scheduler is disabled before the edge function switches
-- to template-owned schedules, preventing a duplicate run during deployment.
update public.growth_config
   set enabled = false,
       next_run_at = null,
       template_assignments = '{}'::jsonb,
       updated_at = now()
 where id = 'settings';
