-- Sessions started from a Kakao message link now last 14 days (they lasted 30, like a
-- Kakao Login session). Shorten the live ones to match; Kakao Login sessions keep 30.
update public.daily_sessions
   set expires_at = least(expires_at, created_at + interval '14 days')
 where scope = 'link' and revoked_at is null;
