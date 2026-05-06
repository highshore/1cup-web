# App Directory

## English

This directory contains the Next.js App Router application. Route folders map to pages such as `/`, `/new-home`, `/meetup`, `/leaderboard`, `/blog`, `/shadow`, `/payment`, `/profile`, `/report`, and `/transcript`.

Use `page.tsx` files as thin route wrappers whenever possible. Put substantial UI logic in `*Client.tsx`, shared feature logic in `app/lib/features`, and reusable app-wide pieces in `app/lib`.

## Key Areas

- `layout.tsx`: Root HTML shell and global providers.
- `page.tsx`: Main landing route.
- `new-home/`: Current experimental/modern homepage experience.
- `meetup/` and `leaderboard/`: Meetup event browsing and participation rankings.
- `lib/`: Shared UI, services, Firebase, context, i18n, and feature modules.
- `api/`: Next.js route handlers used by server/client data fetches.

## 한국어

이 폴더는 Next.js App Router 애플리케이션을 담고 있습니다. 각 라우트 폴더는 `/`, `/new-home`, `/meetup`, `/leaderboard`, `/blog`, `/shadow`, `/payment`, `/profile`, `/report`, `/transcript` 같은 페이지와 연결됩니다.

가능하면 `page.tsx`는 얇은 라우트 래퍼로 유지하세요. 복잡한 UI 로직은 `*Client.tsx`, 기능별 공통 로직은 `app/lib/features`, 앱 전체 공통 요소는 `app/lib`에 둡니다.

## 주요 영역

- `layout.tsx`: 루트 HTML 셸과 글로벌 Provider.
- `page.tsx`: 메인 랜딩 라우트.
- `new-home/`: 현재 사용 중인 최신 홈페이지 경험.
- `meetup/`, `leaderboard/`: 밋업 이벤트와 참여 랭킹.
- `lib/`: 공통 UI, 서비스, Firebase, context, i18n, 기능 모듈.
- `api/`: 서버/클라이언트 데이터 fetch에 쓰이는 Next.js route handler.
