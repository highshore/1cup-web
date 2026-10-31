-- Shadowing was removed from the product. Its `shadow-processing` cron job called the
-- `shadow-admin` Edge Function every minute; unschedule it so nothing keeps calling the
-- retired function. Shadow tables and their data are intentionally kept (not dropped).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'shadow-processing') then
    perform cron.unschedule('shadow-processing');
  end if;
end;
$$;
