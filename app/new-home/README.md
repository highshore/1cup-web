# New Home Route

## English

`app/new-home` contains the modern homepage experience. It combines a media hero, live/homepage stats, featured topics, membership pricing, FAQ, CTA sections, and the Human/Agent render-mode toggle.

- `page.tsx`: server wrapper that fetches initial homepage data.
- `NewHomeClient.tsx`: client experience, render-mode toggle, hero event stack, and markdown agent view.
- `components/`: homepage-specific shared components such as navbar and section headings.
- `sections/`: homepage page sections.

## 한국어

`app/new-home`는 최신 홈페이지 경험을 담습니다. 미디어 hero, 홈페이지 통계, 추천 토픽, 멤버십 가격, FAQ, CTA 섹션, Human/Agent 표시 모드 토글을 포함합니다.

- `page.tsx`: 초기 홈페이지 데이터를 가져오는 서버 래퍼.
- `NewHomeClient.tsx`: 클라이언트 경험, 표시 모드 토글, hero 이벤트 스택, markdown agent view.
- `components/`: navbar, section heading 같은 홈페이지 전용 공통 컴포넌트.
- `sections/`: 홈페이지 섹션.
