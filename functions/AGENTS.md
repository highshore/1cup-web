# Agent Guide For `functions/`

## English

- Treat payment code as high-risk. Preserve validation, logging, and error handling.
- Never log full payment secrets or credential values.
- Keep callback behavior backward compatible with Payple unless the integration contract changes.
- Deploy Firebase Functions only after a successful local/type build.

## 한국어

- 결제 코드는 고위험 영역으로 취급합니다. 검증, 로그, 예외 처리를 유지합니다.
- 결제 secret이나 credential 전체 값을 로그로 남기지 않습니다.
- 연동 계약이 바뀌지 않는 한 Payple callback 동작의 하위 호환성을 유지합니다.
- 로컬/type build 성공 후에만 Firebase Functions를 배포합니다.
