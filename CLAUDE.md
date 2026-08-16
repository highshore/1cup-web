# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

One Cup English (영어 한잔 / `one-cup-eng`) is a Next.js App Router web app for English learning — offline meetups, article study, shadowing, live transcript copilot, payment/subscription, profiles, and reporting. Data lives in Firebase/Firestore; selected backend integrations run as Firebase Functions; the web app deploys to Vercel. UI is Korean-first (the product audience is Korean learners) and bilingual via i18n.

## Commands

```bash
npm install
npm run dev          # next dev --webpack  (local dev server)
npm run build        # next build --webpack — run this before any deployment-oriented change
npm run lint         # next lint (ESLint flat config)
```

There is **no test framework** in this repo — no `test` script, no test files. "Validation" means `npm run build` passes (TypeScript errors are NOT ignored: `next.config.mjs` sets `ignoreBuildErrors: false`).

### Deployment (split: web vs. Firebase infra)

```bash
npx vercel --prod --yes      # deploy the web app (also: npm run deploy:vercel)
npm run deploy:functions     # firebase deploy --only functions  (only when functions/ change)
npm run deploy:firebase      # firebase deploy --only firestore,storage  (only when rules/indexes change)
npm run deploy               # build + functions + firestore/storage + vercel (full)
```

Deploy Firebase **only** when `functions/`, `firestore.rules`, `firestore.indexes.json`, or `storage.rules` change. Routine code changes only need a Vercel deploy. Deployment is an outward-facing action — do not run it unless the user asks.

## Architecture

### App Router layout (`app/`)
- Route segments are feature folders (`meetup/`, `article/`, `shadow/`, `transcript/`, `report/`, `leaderboard/`, `payment/`, `profile/`, `blog/`, `admin/`, …). Keep route files (`page.tsx`) thin; non-trivial client UI goes into a sibling `*Client.tsx` with `"use client"` at the top.
- `app/layout.tsx` is the root: wraps everything in `StyledComponentsRegistry` → `GlobalStyles` → `AuthProvider` → `ConditionalLayoutWrapper` (the latter applies global nav/footer per route — don't add per-page nav/footer wrappers).
- `app/api/*/route.ts` are server route handlers (Node runtime): `transcript-copilot` (OpenAI), `home-topics`, `home-stats`, `public-profile/[uid]`, `soniox-token` (speech token mint).

### Shared code (`app/lib/`)
- `lib/features/<feature>/` — feature-scoped components/services/types/utils (`home`, `meetup`, `shadow`, `article`, `blog`). **Prefer adding feature code here over growing global helpers.**
- `lib/firebase/firebase.ts` — **client** Firebase SDK (auth, db, storage, functions). Functions client is pinned to region `asia-northeast3` (Seoul). Web API keys here are not secrets (restricted in GCP).
- `lib/firebase/firebaseAdmin.ts` — **server/Admin** SDK only. **Never import this into a client component.** Handles private-key newline normalization.
- `lib/contexts/auth_context.tsx` — `AuthProvider` + `useAuth()`. Exposes `currentUser`, `hasActiveSubscription`, `accountStatus` (`user`/`admin`), `isGdgMember`, sourced from Firebase Auth + the `users/{uid}` Firestore doc.
- `lib/i18n/` — `getDictionary(locale)` over `locales/en.ts` and `locales/ko.ts`, surfaced via `I18nProvider`. New user-facing text must go through i18n; **keep `en.ts` and `ko.ts` in sync** rather than hard-coding strings in components.
- `lib/constants/app_layout.ts` — shared page width/gutters (use these, don't redefine per page). `lib/constants/colors.ts` — color tokens.
- Styling is **styled-components** (SSR registry in `lib/styled-components/registry.tsx`, transform enabled in `next.config.mjs`). Prefer existing styled components and layout constants.

### Backend (`functions/`, region `asia-northeast3`)
Firebase Functions v2. Entry `functions/src/index.ts` re-exports across modules:
- `payment.ts` — Korean PG subscription flow (payment window, verify, cancel, recurring billing, referral codes).
- KakaoTalk AlimTalk (`sendKakaoMessages`) — templated notifications: daily article links (scheduled `sendLinksToUsers`, 08:00 KST), meetup reminders, subscription expiry.
- `cefr.ts` — `startCefrBatch` / `pollCefrBatches` (OpenAI batch CEFR leveling).
- `updateHomeStats.ts` — home page aggregate stats.
- `processKakaoUser.ts` — Kakao OAuth user processing.
- Functions has its **own** `package.json`/`tsconfig.json` and is excluded from the root tsconfig; deploy predeploy runs its own build.

### Data model notes
- `users/{uid}` carries `account_status`, `hasActiveSubscription`, `gdg_member`, category flags (`cat_tech`, `cat_business`), `received_articles`, `phone`, etc. Phone numbers are normalized to `010…` (strip `+82`/non-digits) when messaging.
- `firestore.rules`: `blog_posts` are gated (published-only read; admin write). **All other collections are currently `allow read, write: if true`** — security is enforced in app/function logic, not rules.

## Conventions (from nested `AGENTS.md` files — read the closest one before editing a subtree)
- Treat this as a production Next.js App Router project, not a Vite template.
- Prefer existing styled-components, shared layout constants, Firebase helpers, and i18n patterns over new globals.
- Keep `app/lib/` modules narrowly scoped — changes there ripple across pages.
- Do not commit real secrets, service-account values, exported production data, `.next`, or `node_modules`.
- `scripts/` holds one-off operational scripts (e.g. `export-articles-to-csv.mjs`), not app code.
