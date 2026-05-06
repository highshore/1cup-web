# Agent Guide For `scripts/`

## English

- Scripts may read production Firebase data; avoid writes unless the user explicitly asks.
- Do not commit generated exports unless the user requests it.
- Keep credentials in environment variables, not in script files.

## 한국어

- 스크립트는 프로덕션 Firebase 데이터를 읽을 수 있습니다. 사용자가 명시적으로 요청하지 않으면 write 작업을 하지 않습니다.
- 사용자가 요청하지 않은 generated export 파일은 커밋하지 않습니다.
- 인증 정보는 스크립트 파일이 아니라 환경 변수에 둡니다.
