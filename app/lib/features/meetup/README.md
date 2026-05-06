# Meetup Feature

## English

The meetup feature powers event lists, event details, leaderboards, participant data, user profile lookups, and Firestore schema conversion.

## Firestore Shape

The primary event collection is `meetup`. Event documents are converted from the mobile-style schema into UI-friendly `MeetupEvent` objects.

Important source fields:

- `date_time`: Firestore timestamp.
- `description`: event description.
- `duration_minutes`: event duration.
- `image_urls`: event image URLs.
- `leaders`: user IDs for event leaders.
- `participants`: joined user IDs.
- `location`: tuple-like array containing name, address, map URL, latitude, longitude, and extra info.
- `max_participants`: capacity.
- `lockdown_minutes`: registration lock timing.
- `topics`: topic references.

## Module Map

- `services/meetup_service.ts`: client-side event and leaderboard reads.
- `services/meetup_service_server.ts`: server-side event reads.
- `services/user_service.ts`: user profile lookup helpers.
- `types/meetup_types.ts`: shared meetup contracts.
- `utils/meetup_helpers.ts`: Firestore conversion, date formatting, and lock-state helpers.
- `components/`: meetup-specific UI.
- `scripts/`: feature-specific maintenance/import scripts.

## 한국어

meetup feature는 이벤트 목록, 이벤트 상세, 리더보드, 참여자 데이터, 사용자 프로필 조회, Firestore schema 변환을 담당합니다.

## Firestore 구조

기본 이벤트 컬렉션은 `meetup`입니다. 이벤트 문서는 모바일 앱 스타일 schema에서 UI 친화적인 `MeetupEvent` 객체로 변환됩니다.

주요 원본 필드:

- `date_time`: Firestore timestamp.
- `description`: 이벤트 설명.
- `duration_minutes`: 이벤트 진행 시간.
- `image_urls`: 이벤트 이미지 URL 목록.
- `leaders`: 이벤트 리더 user ID 목록.
- `participants`: 참여자 user ID 목록.
- `location`: 장소명, 주소, 지도 URL, 위도, 경도, 추가 정보를 담은 배열.
- `max_participants`: 정원.
- `lockdown_minutes`: 신청 마감 시간 계산에 쓰이는 값.
- `topics`: 토픽 참조.

## 모듈 구조

- `services/meetup_service.ts`: 클라이언트 이벤트/리더보드 조회.
- `services/meetup_service_server.ts`: 서버 이벤트 조회.
- `services/user_service.ts`: 사용자 프로필 조회 helper.
- `types/meetup_types.ts`: 공통 meetup 계약.
- `utils/meetup_helpers.ts`: Firestore 변환, 날짜 포맷, lock 상태 helper.
- `components/`: meetup 전용 UI.
- `scripts/`: 기능 전용 유지보수/import 스크립트.
