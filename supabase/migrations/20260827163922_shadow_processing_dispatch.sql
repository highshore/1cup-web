-- Dispatch queued shadow jobs without exposing a project API key. The function
-- validates this vault-backed header before it can claim a queued lesson.
do $block$
begin
  if not exists (
    select 1 from vault.secrets where name = 'shadow_processing_scheduler_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'shadow_processing_scheduler_secret'
    );
  end if;
end;
$block$;

create or replace function public.shadow_processing_scheduler_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'shadow_processing_scheduler_secret'
  limit 1;
$function$;

revoke execute on function public.shadow_processing_scheduler_secret() from public, anon, authenticated;
grant execute on function public.shadow_processing_scheduler_secret() to service_role, postgres;

create or replace function public.enqueue_shadow_processing_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform net.http_post(
    url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/shadow-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-shadow-processing-scheduler-secret', public.shadow_processing_scheduler_secret()
    ),
    body := jsonb_build_object('action', 'process-next'),
    timeout_milliseconds := 10_000
  );
  return new;
end;
$function$;

revoke execute on function public.enqueue_shadow_processing_job() from public, anon, authenticated;

drop trigger if exists enqueue_shadow_processing_job on public.shadow_processing_jobs;
drop trigger if exists reenqueue_shadow_processing_job on public.shadow_processing_jobs;
create trigger enqueue_shadow_processing_job
after insert on public.shadow_processing_jobs
for each row
when (new.status = 'queued')
execute function public.enqueue_shadow_processing_job();

create trigger reenqueue_shadow_processing_job
after update of status on public.shadow_processing_jobs
for each row
when (new.status = 'queued' and old.status is distinct from new.status)
execute function public.enqueue_shadow_processing_job();

do $block$
begin
  if exists (select 1 from cron.job where jobname = 'shadow-processing') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'shadow-processing'),
      schedule => '* * * * *',
      command => $cron$
        select net.http_post(
          url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/shadow-admin',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-shadow-processing-scheduler-secret', public.shadow_processing_scheduler_secret()
          ),
          body := jsonb_build_object('action', 'process-next'),
          timeout_milliseconds := 10_000
        );
      $cron$,
      active => true
    );
  else
    perform cron.schedule('shadow-processing', '* * * * *', $cron$
      select net.http_post(
        url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/shadow-admin',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-shadow-processing-scheduler-secret', public.shadow_processing_scheduler_secret()
        ),
        body := jsonb_build_object('action', 'process-next'),
        timeout_milliseconds := 10_000
      );
    $cron$);
  end if;
end;
$block$;
