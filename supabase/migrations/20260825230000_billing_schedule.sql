-- Bill in the morning, and again in the afternoon if the morning failed.
--
-- Why
-- ---
-- Recurring billing ran once a day at 20:00 KST. On 24 and 25 August it was rejected
-- outright and nobody was charged; the next opportunity was 24 hours later, and the
-- failure landed at an hour when no one was going to look. A billing run that can only
-- fail unattended, with no second attempt, turns a transient problem into a day of lost
-- revenue and two members wondering why nothing happened.
--
-- 09:00 KST puts the run at the start of the working day and 14:00 gives it a second
-- chance while someone is still around to act on the alert if both fail.
--
-- Safe because processRecurringPayments now checks today's completed recurring orders
-- before charging, so a member the morning run already billed is skipped in the
-- afternoon. Without that guard this schedule would be a double-charge waiting to
-- happen.
--
-- alter_job changes only the schedule. The command carries a credential and is left
-- exactly as it is.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'recurring-payments'),
  schedule := '0 0,5 * * *'   -- 09:00 and 14:00 KST
);

-- The deadline follows the last attempt, not the first: a morning failure that the
-- afternoon run fixes should never have raised an alert. Past 14:15 with nothing
-- recorded today means both attempts are gone, and it is still office hours.
update public.scheduler_heartbeats
   set expected_daily_at = time '14:15'
 where job_name = 'payment.process-recurring';
