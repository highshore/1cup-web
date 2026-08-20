-- The queue contains copied source material while a job is in flight.  It is
-- intentionally accessible only to the service role.  An explicit restrictive
-- policy keeps that contract visible to the database advisor without granting
-- any browser role access.
drop policy if exists "article_processing_jobs deny browser access" on public.article_processing_jobs;

create policy "article_processing_jobs deny browser access"
on public.article_processing_jobs
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
