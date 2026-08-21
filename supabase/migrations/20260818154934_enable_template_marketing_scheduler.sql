-- The marketing Edge Function performs the publisher integration, so pg_cron
-- wakes it up every five minutes. The shared header value lives in Vault and is
-- exposed only to the service-role client used by the function.
do $block$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'marketing_scheduler_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'marketing_scheduler_secret'
    );
  end if;
end;
$block$;

create or replace function public.marketing_scheduler_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'marketing_scheduler_secret'
  limit 1;
$function$;

revoke execute on function public.marketing_scheduler_secret() from public, anon, authenticated;
grant execute on function public.marketing_scheduler_secret() to service_role, postgres;

-- Keep the singleton only as a run lease. A template now owns its own schedule.
insert into public.growth_config (id, enabled, next_run_at, updated_at)
values ('settings', false, null, now())
on conflict (id) do nothing;

-- The first per-template migration deliberately cleared singleton next-run data.
-- Restore eligible template timestamps now that the worker reads template rows.
update public.marketing_templates
   set next_run_at = private.next_kst_scheduled_at(schedule, now()),
       updated_at = now()
 where schedule_enabled = true
   and next_run_at is null;

do $block$
begin
  if exists (select 1 from cron.job where jobname = 'marketing-tick') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'marketing-tick'),
      schedule => '*/5 * * * *',
      command => $cron$
        select net.http_post(
          url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/marketing',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-marketing-scheduler-secret', public.marketing_scheduler_secret()
          ),
          body := jsonb_build_object('action', 'tick')
        );
      $cron$,
      active => true
    );
  else
    perform cron.schedule('marketing-tick', '*/5 * * * *', $cron$
      select net.http_post(
        url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/marketing',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-marketing-scheduler-secret', public.marketing_scheduler_secret()
        ),
        body := jsonb_build_object('action', 'tick')
      );
    $cron$);
  end if;
end;
$block$;
