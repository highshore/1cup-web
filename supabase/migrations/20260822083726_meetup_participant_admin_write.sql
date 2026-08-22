drop policy if exists "meetup_participants admin write" on public.meetup_participants;

create policy "meetup_participants admin write"
on public.meetup_participants
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
