# Agent Guide For `functions/`

## English

- Treat payment code as high-risk. Preserve validation, logging, and error handling.
- Never log full payment secrets or credential values.
- Keep callback behavior backward compatible with Payple unless the integration contract changes.
- Deploy Firebase Functions only after a successful local/type build.

## Current implementation record

- `createAdminArticle.ts` is the production article worker. It uses Vertex AI with `gemini-3.7-flash` for text and `gemini-3.1-flash-lite-image` for covers; rely on Google Application Default Credentials, not browser keys.
- Preserve the staged workflow, robust JSON repair, factual refinement, exact three-bullet summary, 5–12 C1/C2 vocabulary entries, eight concise discussion questions, Korean post-editing, and mandatory photorealistic cover generation.
- Discussion prompts must remain direct and at most 22 words. Store `discussion_topic_ids` alongside `discussion_topics` for voting stability.
- `voteDiscussionTopic.ts` is the only write path for votes. It requires `users/{uid}.hasActiveSubscription === true`, keeps one mutable vote per user/topic, and updates aggregate totals transactionally.

## 한국어

- 결제 코드는 고위험 영역으로 취급합니다. 검증, 로그, 예외 처리를 유지합니다.
- 결제 secret이나 credential 전체 값을 로그로 남기지 않습니다.
- 연동 계약이 바뀌지 않는 한 Payple callback 동작의 하위 호환성을 유지합니다.
- 로컬/type build 성공 후에만 Firebase Functions를 배포합니다.

## 현재 구현 기록

- `createAdminArticle.ts`는 프로덕션 아티클 워커입니다. 텍스트는 Vertex AI `gemini-3.7-flash`, 대표 이미지는 `gemini-3.1-flash-lite-image`를 사용하며 브라우저 키가 아닌 Google Application Default Credentials를 사용합니다.
- 단계형 워크플로, 견고한 JSON 복구, 사실 기반 다듬기, 정확히 3개인 요약, 5–12개 C1/C2 어휘, 간결한 8개 토론 질문, 한국어 후편집, 필수 포토리얼리스틱 대표 이미지 생성을 유지합니다.
- 토론 질문은 직접적이고 22단어 이하여야 합니다. 투표 안정성을 위해 `discussion_topics`와 함께 `discussion_topic_ids`를 저장합니다.
- `voteDiscussionTopic.ts`만 투표 쓰기 경로입니다. `users/{uid}.hasActiveSubscription === true`를 요구하고, 사용자·주제당 하나의 변경 가능한 투표와 트랜잭션 기반 집계를 유지합니다.
