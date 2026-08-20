-- A cold Edge Function may take more than one second to accept the dispatch request.
-- The function responds immediately and performs the durable job in waitUntil(), so ten
-- seconds is transport headroom rather than a limit on article processing itself.
create or replace function public.enqueue_article_processing_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform net.http_post(
    url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/admin-article',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-article-processing-scheduler-secret', public.article_processing_scheduler_secret()
    ),
    body := jsonb_build_object('action', 'process-next'),
    timeout_milliseconds := 10_000
  );
  return new;
end;
$function$;

revoke execute on function public.enqueue_article_processing_job() from public, anon, authenticated;

select cron.alter_job(
  (select jobid from cron.job where jobname = 'admin-article-processing'),
  schedule => '* * * * *',
  command => $cron$
    select net.http_post(
      url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/admin-article',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-article-processing-scheduler-secret', public.article_processing_scheduler_secret()
      ),
      body := jsonb_build_object('action', 'process-next'),
      timeout_milliseconds := 10_000
    );
  $cron$,
  active => true
);
