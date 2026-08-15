# Agent Guide

## English

- Treat this repository as a production Next.js App Router project, not a Vite template.
- Read the closest `AGENTS.md` before editing inside a subtree; nested files override broader guidance.
- Prefer existing styled-components, shared layout constants, Firebase helpers, and i18n patterns.
- Keep Korean and English localization in sync under `app/lib/i18n/locales`.
- Do not commit real secrets, service account values, exported production data, `.next`, or `node_modules`.
- Build with `npm run build` before deployment-oriented changes.
- Deploy the web app with `npx vercel --prod --yes` after user-facing changes.
- Deploy Firebase only when `functions/`, Firestore rules/indexes, or storage rules change.

## Current implementation record

- The admin portal is route-based: `/admin` is the overview, with `/admin/members`, `/admin/articles`, and `/admin/marketing` as focused work areas. Feedback belongs with members.
- The article pipeline writes customer-facing `articles` documents and short-lived `article_processing_jobs`. Do not expose jobs or their source text to the client.
- Article discussion voting uses server-owned `article_discussion_stats` and private `article_discussion_votes` collections. Keep their Firestore rules restrictive; clients must use the callable Function to vote.

## 한국어

- 이 저장소는 Vite 템플릿이 아니라 프로덕션 Next.js App Router 프로젝트로 다룹니다.
- 하위 폴더를 수정하기 전에 가장 가까운 `AGENTS.md`를 읽으세요. 하위 파일의 지침이 상위 지침보다 우선합니다.
- 기존 styled-components, 공통 레이아웃 상수, Firebase 헬퍼, i18n 패턴을 우선 사용합니다.
- `app/lib/i18n/locales`의 한국어/영어 문구를 함께 맞춥니다.
- 실제 비밀값, 서비스 계정 값, 프로덕션 데이터 export, `.next`, `node_modules`는 커밋하지 않습니다.
- 배포 성격의 변경 전에는 `npm run build`를 실행합니다.
- 사용자에게 보이는 변경 후에는 `npx vercel --prod --yes`로 웹 앱을 배포합니다.
- Firebase 배포는 `functions/`, Firestore rules/indexes, storage rules 변경 시에만 실행합니다.

## 현재 구현 기록

- 관리자 포털은 라우트 기반입니다. `/admin`은 개요이고, `/admin/members`, `/admin/articles`, `/admin/marketing`은 각각의 작업 영역입니다. 피드백은 멤버 영역에 포함됩니다.
- 아티클 파이프라인은 고객용 `articles` 문서와 짧게 유지되는 `article_processing_jobs`를 사용합니다. 작업 문서와 원문은 클라이언트에 노출하지 않습니다.
- 아티클 토론 투표는 서버 소유 `article_discussion_stats`, 비공개 `article_discussion_votes` 컬렉션을 사용합니다. Firestore 규칙을 제한적으로 유지하고, 클라이언트는 callable Function으로만 투표해야 합니다.
