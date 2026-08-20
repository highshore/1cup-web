# One Cup English

One Cup English is a Next.js web app for English learning, offline meetups, article study, shadowing, payment, profile, and reporting workflows. Product data, authentication, and backend integrations use Supabase (Postgres, Auth, Storage, and Edge Functions); Firebase Storage remains only for legacy article media URLs. The web app deploys to Vercel.

## Quick Start

```bash
npm install
npm run dev
npm run build
```

The local app runs with `next dev --webpack`. Production builds use `next build --webpack`.

## Main Structure

- `app/`: Next.js App Router pages, route handlers, shared UI, feature modules, Supabase clients, and localization.
- `supabase/functions/`: Supabase Edge Functions for payment, messaging, content processing, and other server-owned workflows.
- `functions/`: Decommissioned Firebase Functions source retained only as a migration reference; it is not part of the application deployment.
- `public/`: Static images, videos, animations, and browser-loaded scripts.
- `scripts/`: One-off local scripts for operational tasks and migration support.
- `storage.rules`: Firebase Storage rules for legacy article media only.

## Environment

Runtime configuration is loaded from local environment files and Vercel/Supabase project settings. Do not commit real secrets.

## Validation And Deployment

Use these checks before production changes:

```bash
npm run build
npx vercel --prod --yes
```

Apply Supabase migrations and deploy the relevant Edge Function when `supabase/` changes. Firebase deployment is limited to legacy Storage rules:

```bash
npm run deploy:firebase
```

## 한국어

One Cup English는 영어 학습, 오프라인 밋업, 아티클 학습, 쉐도잉, 결제, 프로필, 리포트 기능을 제공하는 Next.js 웹 앱입니다. 제품 데이터·인증·백엔드는 Supabase(Postgres, Auth, Storage, Edge Functions)를 사용하며, Firebase Storage는 기존 아티클 미디어 URL을 위해서만 유지합니다. 웹 앱은 Vercel에 배포합니다.

## 빠른 시작

```bash
npm install
npm run dev
npm run build
```

로컬 개발 서버는 `next dev --webpack`으로 실행됩니다. 프로덕션 빌드는 `next build --webpack`을 사용합니다.

## 주요 폴더

- `app/`: Next.js App Router 페이지, 라우트 핸들러, 공통 UI, 기능 모듈, Supabase 클라이언트, 다국어 설정.
- `supabase/functions/`: 결제, 메시지, 콘텐츠 처리 등 서버 소유 작업을 담당하는 Supabase Edge Functions.
- `functions/`: 마이그레이션 참고용으로만 남긴 종료된 Firebase Functions 소스이며 앱 배포에는 사용하지 않습니다.
- `public/`: 정적 이미지, 영상, 애니메이션, 브라우저에서 직접 로드하는 스크립트.
- `scripts/`: 운영과 마이그레이션을 위한 일회성 스크립트.
- `storage.rules`: 기존 아티클 미디어만을 위한 Firebase Storage 규칙.

## 환경 변수

실행 환경 설정은 로컬 환경 파일과 Vercel/Supabase 프로젝트 설정에서 읽습니다. 실제 비밀값은 커밋하지 마세요.

## 검증과 배포

프로덕션 변경 전에는 다음 명령을 사용합니다.

```bash
npm run build
npx vercel --prod --yes
```

`supabase/`가 바뀌면 관련 migration과 Edge Function을 배포하세요. Firebase 배포는 기존 Storage 규칙에만 사용합니다.

```bash
npm run deploy:firebase
```
