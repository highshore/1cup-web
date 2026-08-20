# Decommissioned Firebase Functions

## English

`functions/` is a historical Firebase Functions reference. All production backend work now runs through `supabase/functions/`; no Firebase Cloud Functions are deployed.

## Production Replacements

| Retired Firebase surface | Production Supabase replacement |
| --- | --- |
| Payple payment, callback, recurring billing | `supabase/functions/payment` + authenticated `pg_cron` |
| Kakao messages and reminders | `supabase/functions/messaging` + authenticated `pg_cron` |
| CEFR | `supabase/functions/cefr` + authenticated `pg_cron` |
| Article processing | `supabase/functions/admin-article` |
| Marketing | `supabase/functions/marketing` + private scheduler header |
| Voting, Kakao login, reports, external proxies | Their corresponding Edge Functions |

Do not run `firebase deploy --only functions` or `npm run deploy` in this directory. Use the matching Supabase Edge Function and deploy it after validation.

## 한국어

`functions/`는 과거 Firebase Functions 참고 소스입니다. 프로덕션 백엔드는 모두 `supabase/functions/`에서 동작하며, 배포된 Firebase Cloud Functions는 없습니다.

## 프로덕션 대체 경로

| 종료된 Firebase 기능 | 프로덕션 Supabase 대체 경로 |
| --- | --- |
| Payple 결제·callback·정기결제 | `supabase/functions/payment` + 인증된 `pg_cron` |
| Kakao 메시지·리마인더 | `supabase/functions/messaging` + 인증된 `pg_cron` |
| CEFR | `supabase/functions/cefr` + 인증된 `pg_cron` |
| 아티클 처리 | `supabase/functions/admin-article` |
| 마케팅 | `supabase/functions/marketing` + private scheduler header |
| 투표·Kakao 로그인·리포트·외부 proxy | 각각의 Edge Function |

이 디렉터리에서 `firebase deploy --only functions` 또는 `npm run deploy`를 실행하지 마세요. 검증 후 해당 Supabase Edge Function을 배포하세요.
