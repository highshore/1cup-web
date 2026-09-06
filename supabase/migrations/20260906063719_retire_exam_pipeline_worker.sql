-- Test authoring and heavyweight media generation now run only in the local
-- desktop/exam-toefl-pipeline. Remove the hosted queue before deleting the
-- Edge Function so no scheduled invocation can be left behind.
do $retire$
declare
  scheduled_job_id bigint;
begin
  for scheduled_job_id in
    select jobid from cron.job where jobname = 'exam-pipeline-processing'
  loop
    perform cron.unschedule(scheduled_job_id);
  end loop;
end
$retire$;

drop function if exists public.claim_exam_pipeline_job();
drop function if exists public.exam_pipeline_scheduler_secret();
drop table if exists public.exam_pipeline_jobs;
