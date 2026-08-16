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
- Marketing is operated from `/admin/marketing` as a Gopas cron workspace. The admin-only original Gopas ad is seeded as the first template; a top form selects an editable template above the post fields, saves changed content as a new template through a naming dialog, lets admins upload/order up to six post photos, and assigns a saved template to each scheduled KST weekday. No selected weekday disables automatic posts. `{{daysUntilSunday}}` is resolved server-side on the run date, and each run checks Gopas Free Ads’ first page for an existing matching advert before publishing. `marketing_cron_runs` provides the run cards; each generated post has a unique `/r/{trackingCode}` redirect, invisible copied-text marker, and admin-owned metrics in `growth_posts`.
- Growth redirects set a 30-day `growthTrackingCode` cookie and pass the code into the payment flow. Successful first payments attribute a single signup to the source post transactionally.

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
- 마케팅은 `/admin/marketing`의 고파스 크론 작업 영역에서 운영합니다. 기존 고파스 홍보글은 관리자 전용 첫 템플릿으로 생성되며, 상단 양식은 게시물 입력값 위에서 편집할 템플릿을 선택하고 이름 입력 팝업을 통해 변경 내용을 새 템플릿으로 저장하며 최대 6장의 사진을 업로드·정렬하고 KST 기준 각 게시 요일에 저장된 템플릿을 지정합니다. 선택된 요일이 없으면 자동 게시는 꺼집니다. `{{daysUntilSunday}}`는 실행일 기준 서버에서 치환하며, 실행 전 고파스 무료홍보 게시판 1페이지에서 같은 광고를 확인합니다. `marketing_cron_runs`는 실행 카드 기록을 제공합니다. 생성된 각 게시물에는 고유한 `/r/{trackingCode}` 리다이렉트, 복사 시 붙는 보이지 않는 표식, `growth_posts`의 관리자 전용 성과가 있습니다.
- Growth 리다이렉트는 30일짜리 `growthTrackingCode` 쿠키를 설정하고 결제 흐름에 코드를 전달합니다. 첫 결제가 성공하면 트랜잭션으로 원본 게시물에 가입 1건만 기여 처리합니다.
