# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

One Cup English (영어 한잔 / `one-cup-eng`) is a Next.js App Router web app for English learning — offline meetups, article study, shadowing, live transcript copilot, payment/subscription, profiles, and reporting. Product data, authentication, and server workflows use Supabase; Firebase Storage remains only for legacy article media. The web app deploys to Vercel. UI is Korean-first and bilingual via i18n.

## Commands

```bash
npm install
npm run dev          # next dev --webpack  (local dev server)
npm run build        # next build --webpack — run this before any deployment-oriented change
npm run lint         # next lint (ESLint flat config)
```

There is **no test framework** in this repo — no `test` script, no test files. "Validation" means `npm run build` passes (TypeScript errors are NOT ignored: `next.config.mjs` sets `ignoreBuildErrors: false`).

### Deployment (web, Supabase, legacy Storage)

```bash
npx vercel --prod --yes      # deploy the web app (also: npm run deploy:vercel)
npm run deploy:firebase      # legacy Firebase Storage rules only
npm run deploy               # build + Vercel
```

Deploy Supabase migrations and the affected Edge Function whenever `supabase/` changes. Do not deploy Firebase Functions or Firestore; the legacy `functions/` directory is retained for migration reference only. Deployment is an outward-facing action — do not run it unless the user asks.

## Architecture

### App Router layout (`app/`)
- Route segments are feature folders (`meetup/`, `article/`, `shadow/`, `transcript/`, `report/`, `leaderboard/`, `payment/`, `profile/`, `blog/`, `admin/`, …). Keep route files (`page.tsx`) thin; non-trivial client UI goes into a sibling `*Client.tsx` with `"use client"` at the top.
- `app/layout.tsx` is the root: wraps everything in `StyledComponentsRegistry` → `GlobalStyles` → `AuthProvider` → `ConditionalLayoutWrapper` (the latter applies global nav/footer per route — don't add per-page nav/footer wrappers).
- `app/api/*/route.ts` are server route handlers (Node runtime): `transcript-copilot` (OpenAI), `home-topics`, `home-stats`, `public-profile/[uid]`, `soniox-token` (speech token mint).

### Shared code (`app/lib/`)
- `lib/features/<feature>/` — feature-scoped components/services/types/utils (`home`, `meetup`, `shadow`, `article`, `blog`). **Prefer adding feature code here over growing global helpers.**
- `lib/supabase/client.ts` — browser Supabase client and typed Edge Function invocation helper.
- `lib/supabase/server.ts` — server/browser-auth Supabase clients. **Never import the service-role `admin()` client into a client component.**
- `lib/contexts/auth_context.tsx` — `AuthProvider` + `useAuth()`. Exposes `currentUser`, `hasActiveSubscription`, `accountStatus` (`user`/`admin`), and `isGdgMember`, sourced from Supabase Auth plus `public.users`.
- `lib/i18n/` — `getDictionary(locale)` over `locales/en.ts` and `locales/ko.ts`, surfaced via `I18nProvider`. New user-facing text must go through i18n; **keep `en.ts` and `ko.ts` in sync** rather than hard-coding strings in components.
- `lib/constants/app_layout.ts` — shared page width/gutters (use these, don't redefine per page). `lib/constants/colors.ts` — color tokens.
- Styling is **styled-components** (SSR registry in `lib/styled-components/registry.tsx`, transform enabled in `next.config.mjs`). Prefer existing styled components and layout constants.

### Backend (`supabase/functions/`)
Supabase Edge Functions own payment, messaging, CEFR processing, article ingest, Kakao login, discussion voting, marketing, proxies, and speaking reports. Firebase Cloud Functions are decommissioned; `functions/` is retained only as a migration reference and is not deployed by repository scripts.

### Data model notes
- `public.users` carries `account_status`, `has_active_subscription`, `gdg_member`, category flags, `received_articles`, `phone`, and other member data. Phone numbers are normalized to `010…` (strip `+82`/non-digits) when messaging.

## Conventions (from nested `AGENTS.md` files — read the closest one before editing a subtree)
- Treat this as a production Next.js App Router project, not a Vite template.
- Prefer existing styled-components, shared layout constants, Supabase helpers, and i18n patterns over new globals.
- Keep `app/lib/` modules narrowly scoped — changes there ripple across pages.
- Do not commit real secrets, service-account values, exported production data, `.next`, or `node_modules`.
- `scripts/` holds one-off operational scripts (e.g. `export-articles-to-csv.mjs`), not app code.
