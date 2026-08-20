# Agent Guide For Home Feature

## English

- Keep homepage server fetches resilient; homepage failures should degrade gracefully.
- Avoid adding slow serial Supabase reads when the data can be fetched in parallel.
- Keep `/new-home` machine/agent markdown output derived from localized content.

## 한국어

- 홈페이지 서버 fetch는 장애에 강하게 유지합니다. 홈페이지 데이터 실패는 가능한 한 화면 전체 실패로 이어지지 않게 처리합니다.
- 병렬로 가져올 수 있는 데이터에 느린 직렬 Supabase read를 추가하지 않습니다.
- `/new-home`의 machine/agent markdown 출력은 localized content에서 파생되게 유지합니다.
