# Agent Guide For `app/lib/`

## English

- Keep shared modules stable and narrowly scoped; changes here can affect many pages.
- Prefer adding feature-specific code under `features/<feature>` before adding more global helpers.
- Browser access uses `supabase/client.ts`; server/admin access uses `supabase/server.ts`.
- Never import the service-role `admin()` client into client components.
- Keep shared constants small, explicit, and named by usage rather than by one-off visual style.

## 한국어

- 이 폴더의 공통 모듈은 여러 페이지에 영향을 줄 수 있으므로 범위를 작고 안정적으로 유지합니다.
- 전역 helper를 늘리기 전에 기능별 코드는 먼저 `features/<feature>` 아래에 둡니다.
- 브라우저 접근은 `supabase/client.ts`, 서버/Admin 접근은 `supabase/server.ts`를 사용합니다.
- 클라이언트 컴포넌트에서 service-role `admin()` client를 import하지 않습니다.
- 공통 상수는 작고 명확하게 유지하고, 일회성 시각 스타일보다 사용 목적을 기준으로 이름을 짓습니다.
