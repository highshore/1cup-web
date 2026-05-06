# Agent Guide For API Routes

## English

- Keep route handlers small and move reusable logic into `app/lib/features` or `app/lib/services`.
- Return graceful fallback data where the UI already expects fallback behavior.
- Avoid exposing secrets or raw service errors in JSON responses.

## 한국어

- route handler는 작게 유지하고 재사용 로직은 `app/lib/features` 또는 `app/lib/services`로 옮깁니다.
- UI가 fallback 동작을 기대하는 곳에서는 graceful fallback 데이터를 반환합니다.
- JSON 응답에 secret이나 raw service error를 노출하지 않습니다.
