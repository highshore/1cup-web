-- One free trial per phone number, whichever level (terms 제4조, 2026-10-30.1).
--
-- daily_trial_claims was keyed (recipient_phone, track), so someone whose 초·중급 trial had
-- ended could start a second one on 고급. The claim is now keyed by the number alone:
-- daily_start_trial is unchanged, because its `insert … on conflict do nothing` already
-- refuses a second claim for the number, whatever the level, with 'trial-used'.
--
-- A number that has already claimed both levels keeps its earliest claim. The track column
-- stays, as a record of which level the trial was on.

delete from public.daily_trial_claims t
 using public.daily_trial_claims e
 where e.recipient_phone = t.recipient_phone
   and (e.claimed_at, e.track) < (t.claimed_at, t.track);

alter table public.daily_trial_claims drop constraint daily_trial_claims_pkey;
alter table public.daily_trial_claims add constraint daily_trial_claims_pkey primary key (recipient_phone);
