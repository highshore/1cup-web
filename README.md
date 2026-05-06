# One Cup English

One Cup English is a Next.js web app for English learning, offline meetups, article study, shadowing, payment, profile, and reporting workflows. The app uses Firebase/Firestore for data, Firebase Functions for selected backend integrations, styled-components for UI styling, and Vercel for the main web deployment.

## Quick Start

```bash
npm install
npm run dev
npm run build
```

The local app runs with `next dev --webpack`. Production builds use `next build --webpack`.

## Main Structure

- `app/`: Next.js App Router pages, route handlers, shared UI, feature modules, Firebase clients, and localization.
- `functions/`: Firebase Functions backend code, mainly payment-related service endpoints.
- `public/`: Static images, videos, animations, and browser-loaded scripts.
- `scripts/`: One-off local scripts for operational tasks such as Firestore article export.
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`: Firebase security and index configuration.

## Environment

Runtime configuration is loaded from local environment files and Vercel/Firebase project settings. Do not commit real secrets. Firebase Admin private keys must preserve newline formatting; see `app/lib/firebase/firebaseAdmin.ts` for normalization logic.

## Validation And Deployment

Use these checks before production changes:

```bash
npm run build
npx vercel --prod --yes
```

Firebase infrastructure can be deployed separately when security rules, indexes, storage rules, or functions change:

```bash
npm run deploy:functions
npm run deploy:firebase
```

## 한국어

One Cup English는 영어 학습, 오프라인 밋업, 아티클 학습, 쉐도잉, 결제, 프로필, 리포트 기능을 제공하는 Next.js 웹 앱입니다. 데이터는 Firebase/Firestore를 사용하고, 일부 백엔드 연동은 Firebase Functions에서 처리하며, 주요 웹 배포는 Vercel을 사용합니다.

## 빠른 시작

```bash
npm install
npm run dev
npm run build
```

로컬 개발 서버는 `next dev --webpack`으로 실행됩니다. 프로덕션 빌드는 `next build --webpack`을 사용합니다.

## 주요 폴더

- `app/`: Next.js App Router 페이지, 라우트 핸들러, 공통 UI, 기능 모듈, Firebase 클라이언트, 다국어 설정.
- `functions/`: Firebase Functions 백엔드 코드. 주로 결제 관련 서비스 엔드포인트를 담당합니다.
- `public/`: 정적 이미지, 영상, 애니메이션, 브라우저에서 직접 로드하는 스크립트.
- `scripts/`: Firestore 아티클 CSV 추출처럼 운영용 일회성 스크립트.
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`: Firebase 보안 규칙과 인덱스 설정.

## 환경 변수

실행 환경 설정은 로컬 환경 파일과 Vercel/Firebase 프로젝트 설정에서 읽습니다. 실제 비밀값은 커밋하지 마세요. Firebase Admin private key는 줄바꿈 보존이 중요하며, 정규화 로직은 `app/lib/firebase/firebaseAdmin.ts`에 있습니다.

## 검증과 배포

프로덕션 변경 전에는 다음 명령을 사용합니다.

```bash
npm run build
npx vercel --prod --yes
```

보안 규칙, 인덱스, 스토리지 규칙, Functions 변경이 있을 때는 Firebase 배포를 별도로 실행합니다.

```bash
npm run deploy:functions
npm run deploy:firebase
```
