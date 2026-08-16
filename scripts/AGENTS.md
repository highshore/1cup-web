# Agent Guide For `scripts/`

## English

- Scripts run against the production Supabase project with a service-role key (RLS is
  bypassed); avoid writes unless the user explicitly asks.
- Reuse `_supabase.mjs` instead of constructing another client.
- Do not commit generated exports unless the user requests it.
- Keep credentials in environment variables, not in script files.

## 한국어

- 스크립트는 service-role 키로 프로덕션 Supabase 프로젝트에 접속하며 RLS 를 우회합니다.
  사용자가 명시적으로 요청하지 않으면 write 작업을 하지 않습니다.
- 새 클라이언트를 만들지 말고 `_supabase.mjs` 를 재사용합니다.
- 사용자가 요청하지 않은 generated export 파일은 커밋하지 않습니다.
- 인증 정보는 스크립트 파일이 아니라 환경 변수에 둡니다.
