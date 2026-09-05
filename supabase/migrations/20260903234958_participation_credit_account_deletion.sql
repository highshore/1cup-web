-- Add participation-credit privacy handling to the already-deployed atomic account
-- deletion function. Financial values and order links remain for statutory audit;
-- free-form adjustment metadata is not needed after deletion and may be personal.
create or replace function public.delete_account_data(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_phone text;
  v_meetups text[];
  v_now timestamptz := now();
begin
  if p_uid is null or btrim(p_uid) = '' then
    raise exception 'uid is required';
  end if;

  select phone into v_phone from public.users where uid = p_uid;

  select coalesce(array_agg(id), '{}') into v_meetups
    from public.meetups where date_time >= v_now;

  if array_length(v_meetups, 1) is not null then
    delete from public.meetup_participants
     where user_id = p_uid and meetup_id = any(v_meetups);

    update public.meetups m
       set current_participants = (
             select count(*) from public.meetup_participants p where p.meetup_id = m.id)
     where m.id = any(v_meetups);
  end if;

  delete from public.profile_likes where liker_id = p_uid or liked_id = p_uid;
  delete from public.user_blocks where blocker_id = p_uid or blocked_user_id = p_uid;
  delete from public.conversation_members where user_id = p_uid;
  delete from public.messages where sender_id = p_uid;
  update public.conversations set created_by = null where created_by = p_uid;
  delete from public.conversations where system_owner_user_id = p_uid;
  delete from public.article_discussion_votes where user_id = p_uid;
  delete from public.notification_reads where user_id = p_uid;
  delete from public.notification_deliveries where user_id = p_uid;

  delete from public.user_vocabulary where user_id = p_uid;
  delete from public.vocabulary_study_cards where user_id = p_uid;
  delete from public.vocabulary_review_events where user_id = p_uid;
  delete from public.vocabulary_deck_follows where user_id = p_uid;
  delete from public.vocabulary_deck_study_preferences where user_id = p_uid;
  delete from public.exam_attempts where user_id = p_uid;
  delete from public.speaking_test_attempts where user_id = p_uid;
  delete from public.blog_post_likes where user_id = p_uid;
  delete from public.non_korean_applications where user_id = p_uid;
  delete from public.auth_session_events where uid = p_uid;

  if v_phone is not null and btrim(v_phone) <> '' then
    delete from public.phone_otp where phone = v_phone;
  end if;

  update public.feedback
     set user_id = null, other_reason = null, survey = null where user_id = p_uid;
  update public.speaking_reports
     set user_script = null, speaker_id = null, metadata = '{}'::jsonb where user_id = p_uid;
  update public.billing_stops set reason = null where user_id = p_uid;
  update public.payment_cancellations
     set reason = null, payple_response = '{}'::jsonb, payple_error_message = null
   where user_id = p_uid;
  update public.payment_orders
     set billing_key_used = null,
         payment_result = '{}'::jsonb,
         payple_response = '{}'::jsonb,
         payple_params_attempted = '{}'::jsonb
   where user_id = p_uid;
  update public.participation_credit_transactions
     set metadata = jsonb_build_object('account_deleted', true, 'audit_retained', true)
   where user_id = p_uid;

  update public.referral_codes set active = false, referrer = null where referrer = p_uid;

  update public.users
     set email = null, display_name = 'Deleted member', photo_url = null, phone = null,
         kakao_id = null, auth_id = null, account_status = 'deleted', user_type = null,
         gdg_member = false, has_active_subscription = false, plan_price = null,
         billing_key = null, payment_method = null, billing_cancelled = true,
         subscription_start_date = null, subscription_end_date = null,
         last_billing_date = null, billing_updated_at = null,
         cancellation_timestamp = v_now, cancellation_type = 'account_deleted',
         cancellation_reason = null, cat_tech = false, cat_business = false,
         received_articles = '{}', last_received = null, left_count = null,
         saved_words = '{}', referral_code = null, referral_generated_at = null,
         bio = null, work = null, school = null, interests = null,
         location = 'anam',
         profile_public = false, last_login_at = null, deleted_at = v_now,
         updated_at = v_now
   where uid = p_uid;

  return jsonb_build_object('uid', p_uid, 'erased_at', v_now);
end;
$function$;

revoke all on function public.delete_account_data(text) from public, anon, authenticated;
