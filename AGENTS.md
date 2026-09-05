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

### Kakao auth / Supabase browser-path constraints

- Kakao login intentionally avoids a browser navigation to the project's `*.supabase.co` Auth hostname. Some managed/client networks produced `NET::ERR_CERT_AUTHORITY_INVALID` before OAuth could complete. Do not reintroduce a browser-facing `signInWithOAuth()` flow that depends on direct navigation to the Supabase project Auth domain without explicitly validating this constraint.
- Current Kakao flow is first-party at the browser boundary: `1cupenglish.com -> Kakao -> 1cupenglish.com/kakao_callback`. The callback exchanges the Kakao authorization code server-side and creates the Supabase session server-side with `signInWithIdToken()`.
- Direct Kakao OIDC must use the **same Kakao REST application configured in Supabase Auth**. A token from a different Kakao app has a different `aud` and Supabase will reject it as an unacceptable audience. Keep the explicit ID-token audience validation in place.
- `KAKAO_DIRECT_CLIENT_SECRET` is server-only. Never expose it through a `NEXT_PUBLIC_*` variable, client bundle, logs, docs, fixtures, or committed config. Public client IDs may be referenced where technically required, but prefer configuration over duplication.
- Preserve the existing Supabase auth cookie/storage key when changing the browser Supabase base URL; otherwise browser and server can silently create parallel sessions.
- If browser Supabase traffic is proxied through Vercel in the future, proxy only Supabase service namespaces such as `/rest/v1/*`, `/auth/v1/*`, `/functions/v1/*`, `/storage/v1/*`, `/realtime/v1/*`, and `/graphql/v1/*`. Do **not** use a blanket `/:path*` rewrite, because it can swallow real Next.js routes and make 404/future-route behavior ambiguous.
- Even with a first-party Supabase proxy, keep Kakao OAuth on the dedicated first-party callback path unless the provider callback itself is guaranteed to stay off the raw `*.supabase.co` hostname.

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

### Kakao 인증 / Supabase 브라우저 경로 제약

- Kakao 로그인은 브라우저가 프로젝트의 `*.supabase.co` Auth 호스트로 직접 이동하지 않도록 의도적으로 설계되어 있습니다. 일부 관리형/클라이언트 네트워크에서 OAuth가 시작되기 전에 `NET::ERR_CERT_AUTHORITY_INVALID`가 발생했습니다. 이 제약을 명시적으로 검증하지 않은 채 브라우저가 Supabase 프로젝트 Auth 도메인으로 직접 이동하는 `signInWithOAuth()` 흐름을 다시 도입하지 마세요.
- 현재 Kakao 흐름은 브라우저 경계에서 first-party입니다: `1cupenglish.com -> Kakao -> 1cupenglish.com/kakao_callback`. callback에서 Kakao authorization code를 서버에서 교환하고, `signInWithIdToken()`으로 Supabase 세션도 서버에서 생성합니다.
- Direct Kakao OIDC는 반드시 **Supabase Auth에 등록된 것과 동일한 Kakao REST 앱**을 사용해야 합니다. 다른 Kakao 앱에서 발급된 토큰은 `aud`가 달라 Supabase가 `unacceptable audience`로 거부합니다. ID token audience의 명시적 검증을 유지하세요.
- `KAKAO_DIRECT_CLIENT_SECRET`은 서버 전용입니다. `NEXT_PUBLIC_*`, 클라이언트 번들, 로그, 문서, fixture, 커밋된 설정에 노출하지 마세요. 공개 client ID는 기술적으로 필요한 경우 사용할 수 있지만 중복 하드코딩보다는 설정을 우선합니다.
- 브라우저용 Supabase base URL을 변경할 때 기존 Supabase auth cookie/storage key를 유지하세요. 그렇지 않으면 브라우저와 서버가 서로 다른 병렬 세션을 조용히 만들 수 있습니다.
- 향후 브라우저 Supabase 트래픽을 Vercel로 프록시한다면 `/rest/v1/*`, `/auth/v1/*`, `/functions/v1/*`, `/storage/v1/*`, `/realtime/v1/*`, `/graphql/v1/*` 같은 Supabase 서비스 namespace만 프록시하세요. `/:path*` blanket rewrite는 실제 Next.js 라우트를 삼키고 404/향후 라우트 동작을 모호하게 만들 수 있으므로 사용하지 마세요.
- first-party Supabase proxy를 쓰더라도 provider callback 자체가 raw `*.supabase.co` 호스트를 절대 거치지 않는 것이 보장되지 않는 한, Kakao OAuth는 전용 first-party callback 경로를 유지하세요.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
