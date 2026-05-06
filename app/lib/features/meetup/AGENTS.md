# Agent Guide For Meetup Feature

## English

- Exclude admin/leader accounts from public leaderboard metrics unless the user explicitly asks otherwise.
- Keep new member leaderboards ordered by newest paying members first.
- Keep privacy masking for public display names.
- Avoid Firestore query changes that require new indexes unless you also update `firestore.indexes.json`.
- Preserve compatibility with the mobile-style `meetup` collection schema.

## 한국어

- 사용자가 명시적으로 다르게 요청하지 않는 한 공개 리더보드 지표에서 admin/leader 계정은 제외합니다.
- 신규 멤버 리더보드는 최신 유료 멤버가 먼저 오도록 유지합니다.
- 공개 표시 이름의 개인정보 마스킹을 유지합니다.
- 새 인덱스가 필요한 Firestore query 변경은 `firestore.indexes.json`도 함께 수정합니다.
- 모바일 앱 스타일 `meetup` 컬렉션 schema와의 호환성을 유지합니다.
