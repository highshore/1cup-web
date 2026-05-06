# Home Feature

## English

The home feature provides homepage support modules: aggregate stats, featured article topics, and display components used by `/` and `/new-home`.

- `services/stats_service.ts`: reads collection counts for homepage stats with fallback collection names.
- `services/topics_service.ts`: fetches featured article documents from Firestore.
- `components/`: homepage stat and topic UI sections.

## 한국어

home feature는 `/`와 `/new-home`에서 사용하는 홈페이지 지원 모듈입니다. 집계 통계, 추천 아티클 토픽, 표시 컴포넌트를 담당합니다.

- `services/stats_service.ts`: fallback 컬렉션 이름을 포함해 홈페이지 통계용 collection count를 읽습니다.
- `services/topics_service.ts`: Firestore에서 추천 아티클 문서를 가져옵니다.
- `components/`: 홈페이지 통계와 토픽 UI 섹션.
