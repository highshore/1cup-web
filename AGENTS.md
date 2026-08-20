# Agent Guide

## English

- Treat this repository as a production Next.js App Router project, not a Vite template.
- Read the closest `AGENTS.md` before editing inside a subtree; nested files override broader guidance.
- Prefer existing styled-components, shared layout constants, Supabase helpers, and i18n patterns.
- Keep Korean and English localization in sync under `app/lib/i18n/locales`.
- Do not commit real secrets, service account values, exported production data, `.next`, or `node_modules`.
- Build with `npm run build` before deployment-oriented changes.
- Deploy the web app with `npx vercel --prod --yes` after user-facing changes.
- Deploy Supabase Edge Functions or migrations when `supabase/` changes. Firebase Storage remains enabled only for legacy article media; do not add new Firestore, Firebase Auth, or Cloud Functions usage.

## Current implementation record

- The admin portal is route-based: `/admin` is the overview, with `/admin/members`, `/admin/articles`, and `/admin/marketing` as focused work areas. Feedback belongs with members.
- The article pipeline writes customer-facing Supabase `articles` rows and short-lived `article_processing_jobs` rows through the `admin-article` Edge Function. Do not expose jobs or their source text to the client.
- Article discussion voting uses server-owned Supabase `article_discussion_stats` and private `article_discussion_votes` rows. Clients must call the `discussion-vote` Edge Function.
- Marketing is operated from `/admin/marketing` as a Gopas cron workspace backed by Supabase `growth_config`, `marketing_templates`, `marketing_cron_runs`, and `growth_posts`. The `marketing` Edge Function resolves `{{daysUntilSunday}}`, checks Gopas Free Ads before posting, and treats an empty weekday list as a disabled schedule. Each generated post has a unique `/r/{trackingCode}` redirect, invisible copied-text marker, and server-owned metrics.
- Growth redirects set a 30-day `growthTrackingCode` cookie and pass the code into the Supabase payment flow. Successful first payments attribute a single signup to the source post transactionally.

## 한국어

- 이 저장소는 Vite 템플릿이 아니라 프로덕션 Next.js App Router 프로젝트로 다룹니다.
- 하위 폴더를 수정하기 전에 가장 가까운 `AGENTS.md`를 읽으세요. 하위 파일의 지침이 상위 지침보다 우선합니다.
- 기존 styled-components, 공통 레이아웃 상수, Supabase 헬퍼, i18n 패턴을 우선 사용합니다.
- `app/lib/i18n/locales`의 한국어/영어 문구를 함께 맞춥니다.
- 실제 비밀값, 서비스 계정 값, 프로덕션 데이터 export, `.next`, `node_modules`는 커밋하지 않습니다.
- 배포 성격의 변경 전에는 `npm run build`를 실행합니다.
- 사용자에게 보이는 변경 후에는 `npx vercel --prod --yes`로 웹 앱을 배포합니다.
- `supabase/` 변경 시 Supabase Edge Function 또는 migration을 배포합니다. Firebase Storage는 기존 아티클 미디어용으로만 유지하며, Firestore·Firebase Auth·Cloud Functions 사용을 새로 추가하지 않습니다.

## 현재 구현 기록

- 관리자 포털은 라우트 기반입니다. `/admin`은 개요이고, `/admin/members`, `/admin/articles`, `/admin/marketing`은 각각의 작업 영역입니다. 피드백은 멤버 영역에 포함됩니다.
- 아티클 파이프라인은 Supabase `articles` 행과 짧게 유지되는 `article_processing_jobs` 행을 `admin-article` Edge Function으로 작성합니다. 작업 행과 원문은 클라이언트에 노출하지 않습니다.
- 아티클 토론 투표는 서버 소유 Supabase `article_discussion_stats`, 비공개 `article_discussion_votes` 행을 사용합니다. 클라이언트는 `discussion-vote` Edge Function으로만 투표해야 합니다.
- 마케팅은 Supabase `growth_config`, `marketing_templates`, `marketing_cron_runs`, `growth_posts`를 사용하는 `/admin/marketing`의 고파스 크론 작업 영역에서 운영합니다. `marketing` Edge Function은 `{{daysUntilSunday}}`를 실행일 기준으로 치환하고, 게시 전 고파스 무료홍보 게시판을 확인하며, 선택 요일이 없으면 자동 게시를 끕니다. 생성된 각 게시물에는 고유한 `/r/{trackingCode}` 리다이렉트, 복사 시 붙는 보이지 않는 표식, 서버 소유 성과가 있습니다.
- Growth 리다이렉트는 30일짜리 `growthTrackingCode` 쿠키를 설정하고 Supabase 결제 흐름에 코드를 전달합니다. 첫 결제가 성공하면 트랜잭션으로 원본 게시물에 가입 1건만 기여 처리합니다.
