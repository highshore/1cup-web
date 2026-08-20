# Agent Guide For `app/lib/features/`

## English

- Keep feature code inside its domain unless it is clearly reused by multiple unrelated features.
- Use typed service functions for Supabase/API access; avoid ad hoc fetch/query logic inside page components.
- Preserve existing Supabase fallback behavior unless the user asks to remove it.
- When adding user-visible labels from a feature, wire them through `app/lib/i18n/locales`.

## 한국어

- 여러 무관한 기능에서 명확히 재사용되는 코드가 아니라면 해당 기능 도메인 안에 유지합니다.
- Supabase/API 접근은 타입이 있는 service 함수로 처리하고, page component 안에 임시 fetch/query 로직을 넣지 않습니다.
- 사용자가 명시적으로 제거를 요청하지 않는 한 기존 Supabase fallback 동작을 유지합니다.
- 기능에서 사용자에게 보이는 문구를 추가할 때는 `app/lib/i18n/locales`를 통해 연결합니다.
