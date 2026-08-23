# Agent Guide For Meetup Feature

## English

- Exclude admin/leader accounts from public leaderboard metrics unless the user explicitly asks otherwise.
- Keep new member leaderboards ordered by first subscription date first; fall back to newest registered active subscribers when first subscription history is unavailable.
- Keep privacy masking for public display names.
- Do not add Firestore queries or indexes; the retained legacy index file is in `docs/migration/artifacts/legacy-firebase/`.
- Preserve compatibility with the mobile-style `meetup` collection schema.

## 한국어

- 사용자가 명시적으로 다르게 요청하지 않는 한 공개 리더보드 지표에서 admin/leader 계정은 제외합니다.
- 신규 멤버 리더보드는 최초 구독일을 기준으로 정렬합니다. 최초 구독 이력이 없으면 활성 구독자의 최신 가입일을 fallback으로 사용합니다.
- 공개 표시 이름의 개인정보 마스킹을 유지합니다.
- Firestore query나 index를 새로 추가하지 마세요. 보존된 기존 index 파일은 `docs/migration/artifacts/legacy-firebase/`에 있습니다.
- 모바일 앱 스타일 `meetup` 컬렉션 schema와의 호환성을 유지합니다.
