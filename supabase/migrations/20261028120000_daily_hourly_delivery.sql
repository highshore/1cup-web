-- Delivery times are now on the hour only (06:00–22:00); the half-hour slots are gone.
-- No subscription used a half-hour time when this was written.
alter table public.daily_subscriptions
  drop constraint daily_subscriptions_delivery_time_check,
  add constraint daily_subscriptions_delivery_time_check check (
    delivery_time between time '06:00' and time '22:00'
    and extract(minute from delivery_time) = 0
    and extract(second from delivery_time) = 0
  );

-- The customer's own settings. Time is per track; name and marketing consent are the
-- customer's and apply to every track. Moving the time reschedules the next slot.
create or replace function public.daily_update_settings(
  p_customer_id uuid,
  p_track       text,
  p_time        time,
  p_name        text,
  p_marketing   boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_time is not null then
    if p_time < time '06:00' or p_time > time '22:00' or extract(minute from p_time) <> 0
       or extract(second from p_time) <> 0 then
      raise exception 'invalid-time' using errcode = 'P0001';
    end if;
    update public.daily_subscriptions s
       set delivery_time = p_time,
           -- A trial keeps its notice at least 12 hours after signup, as daily_start_trial set it.
           next_send_at = case
             when s.next_send_at is null then null
             when s.status = 'trial' then public.daily_next_send_at(
               p_time, greatest(now(), coalesce(s.trial_started_at, now()) + interval '12 hours'))
             else public.daily_next_send_at(p_time, now())
           end
     where s.customer_id = p_customer_id and s.track = p_track and s.status in ('trial', 'active');
  end if;
  if p_name is not null then
    update public.daily_customers set name = nullif(left(trim(p_name), 20), '') where id = p_customer_id;
    update public.daily_subscriptions set recipient_name = nullif(left(trim(p_name), 20), '')
     where customer_id = p_customer_id;
  end if;
  if p_marketing is not null then
    update public.daily_subscriptions
       set marketing_consent_at = case when p_marketing then coalesce(marketing_consent_at, now()) end
     where customer_id = p_customer_id;
  end if;
end;
$$;

revoke execute on function public.daily_update_settings(uuid, text, time, text, boolean) from public, anon, authenticated;
grant execute on function public.daily_update_settings(uuid, text, time, text, boolean) to service_role;
