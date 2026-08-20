# Agent Guide For `functions/`

Firebase Cloud Functions are decommissioned in production. This directory is a migration reference only: do not deploy it, and make production backend changes under `supabase/functions/` instead.

## English

- Treat payment code as high-risk. Preserve validation, logging, and error handling.
- Never log full payment secrets or credential values.
- Keep callback behavior backward compatible with Payple unless the integration contract changes.
- Never deploy Firebase Functions. Validate and deploy the matching Supabase Edge Function instead.

## Current implementation record

- `createAdminArticle.ts` is the retired Firebase article worker. The production worker is `supabase/functions/admin-article`.
- Preserve the staged workflow, robust JSON repair, factual refinement, exact three-bullet summary, 5–12 C1/C2 vocabulary entries, eight concise discussion questions, Korean post-editing, and mandatory photorealistic cover generation.
- Discussion prompts must remain direct and at most 22 words. Store `discussion_topic_ids` alongside `discussion_topics` for voting stability.
- `voteDiscussionTopic.ts` is the only write path for votes. It requires `users/{uid}.hasActiveSubscription === true`, keeps one mutable vote per user/topic, and updates aggregate totals transactionally.

## 한국어

- 결제 코드는 고위험 영역으로 취급합니다. 검증, 로그, 예외 처리를 유지합니다.
- 결제 secret이나 credential 전체 값을 로그로 남기지 않습니다.
- 연동 계약이 바뀌지 않는 한 Payple callback 동작의 하위 호환성을 유지합니다.
- Firebase Functions는 배포하지 않습니다. 대신 해당 Supabase Edge Function을 검증하고 배포합니다.

## 현재 구현 기록

- `createAdminArticle.ts`는 종료된 Firebase 아티클 워커입니다. 프로덕션 워커는 `supabase/functions/admin-article`입니다.
- 단계형 워크플로, 견고한 JSON 복구, 사실 기반 다듬기, 정확히 3개인 요약, 5–12개 C1/C2 어휘, 간결한 8개 토론 질문, 한국어 후편집, 필수 포토리얼리스틱 대표 이미지 생성을 유지합니다.
- 토론 질문은 직접적이고 22단어 이하여야 합니다. 투표 안정성을 위해 `discussion_topics`와 함께 `discussion_topic_ids`를 저장합니다.
- `voteDiscussionTopic.ts`만 투표 쓰기 경로입니다. `users/{uid}.hasActiveSubscription === true`를 요구하고, 사용자·주제당 하나의 변경 가능한 투표와 트랜잭션 기반 집계를 유지합니다.
