-- Refresh public Koreapas first-page view counts without triggering a post.
-- The post scheduler remains on its existing five-minute due-check cadence.
do $block$
begin
  if exists (select 1 from cron.job where jobname = 'marketing-performance-refresh') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'marketing-performance-refresh'),
      schedule => '*/10 * * * *',
      command => $cron$
        select net.http_post(
          url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/marketing',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-marketing-scheduler-secret', public.marketing_scheduler_secret()
          ),
          body := jsonb_build_object('action', 'refresh-performance')
        );
      $cron$,
      active => true
    );
  else
    perform cron.schedule('marketing-performance-refresh', '*/10 * * * *', $cron$
      select net.http_post(
        url := 'https://hetiycbotgjeluteicyk.supabase.co/functions/v1/marketing',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-marketing-scheduler-secret', public.marketing_scheduler_secret()
        ),
        body := jsonb_build_object('action', 'refresh-performance')
      );
    $cron$);
  end if;
end;
$block$;
