# OpenAI Ads readiness: One Cup Daily

Status: implementation draft. Advertiser billing, logo, identity checks, and account review are complete. No conversion source or API key exists yet. Do not merge or deploy the coordinated Next.js / Supabase changes until all preflight checks pass.

## Live advertiser account blockers observed on 2026-10-29 (Asia/Seoul)
- Advertiser: Native PT, KRW; account review approved as of latest 2026-10-29 connector read.
- Account logo uploaded and billing setup complete. Identity verification completed.
- No conversion sources, standard event settings, or campaigns existed at inspection.
- Promotion qualifying: pay KRW 300,000 in eligible ad charges by 2026-11-12 02:01 KST to earn up to KRW 300,000 credit, subject to exact promotion terms. Credit is not currently spendable.
- A campaign budget can spend real card funds; do not activate without approval of a fixed KRW budget and campaign dates.

## Code changes in this branch
- /daily is now indexable and in sitemap. Public robots.txt permits /daily (still disallows /api/).
- Optional, consent-gated OpenAI Pixel only under /daily, including page_viewed, confirmed trial_started, and checkout_started.
- Forward Pixel's first-party __oppref and __obref cookies only after opt-in when a checkout is verified.
- Report order_created from Supabase daily payment settlement after confirmed Payple charge and completed first-time checkout; exclude renewal transactions and non-first purchases. Stable event IDs deduplicate repeated verifies; CAPI failures cannot undo a completed payment.
- Daily privacy copy explains the optional disclosure. Mandatory Daily checkout terms remain version 2026-10-29.1; the optional ads measurement choice is independent of payment consent.

## Required account setup
1. In Ads Manager -> Conversions, create a website data source / Pixel named **One Cup Daily**, for the 1cupenglish.com origin. Landing page and instrumentation scope is **/daily and its subroutes only**; /daily is a URL path, not a separate registrable domain. Set standard order_created as the primary goal and generate a Conversions API key. This action is currently unsupported by the ChatGPT Ads Manager connector, so it must be completed within Ads Manager or through an authorized advertiser Ads API.
2. Add Vercel production env NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID with the **Pixel ID** (not the API key).
3. Add Supabase daily Edge secrets OPENAI_ADS_PIXEL_ID and OPENAI_ADS_CAPI_KEY (not a generic OPENAI_API_KEY). Keep the CAPI key server-only. Do not paste keys into GitHub, PRs, logs, or chat.
4. Review privacy-law requirements (including domestic and cross-border advertisement measurement notices/consent) before activation; ensure tracking consent is effective.
5. Inspect CSP and permit https://bzrcdn.openai.com (script/connect) and https://bzr.openai.com (connect/img) if CSP blocks them.

## Release and validation order
1. Review PR and verify GitHub Actions Next.js build and Daily Edge type-check. Do not merge if either fails. Vercel intentionally ignores non-production branch builds for this project.
2. Ensure Ads Manager pixel source and key exist, and env vars are set.
3. Deploy the updated Supabase daily Edge Function first (backward compatible); then release the Next.js production build. Checkout terms remain version 2026-10-29.1 on both sides.
4. Verify GET /daily returns 200, index/follow metadata, public sitemap contains /daily; confirm there is no added x-robots noindex header.
5. Verify Pixel is NOT loaded or sending events before consent. After opt-in, confirm page_viewed, trial_started after confirmed free-lesson activation, and checkout_started after checkout-window created. On opt-out, confirm no further tracking.
6. Use a *user-approved test card/payment or Payple sandbox* through the normal payment flow. Do not trigger a real charge merely to test the Ads SDK without authorization.
7. Only after verified Payple settlement, confirm one order_created event with actual KRW amount in the Ads Manager 15-minute conversion events diagnostic view. Confirm duplicate checkout-verify requests cause no duplicate charge or conversion.
8. Compare Payple success, daily_orders.completed, subscription grant, and Ads Manager events. Treat any mismatch as a launch blocker.
9. Create one KRW campaign with purchase objective, two focused ad groups (business English at work; daily habit), three approved chat-card variants, explicit total campaign budget and end date. Activate only with specific approval for billable spend.

## Limitations
- Without NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID the client component is inert. The Pixel component is mounted only on /daily routes, and disables measurement on unmount when leaving Daily; it is never imported by the main 1 Cup homepage, meetup, or blog routes.
- Without Supabase OPENAI_ADS_PIXEL_ID or OPENAI_ADS_CAPI_KEY the backend does not send events.
- Backend events are sent inline with a 5-second timeout; failures are only logged, not queued for retry. Add a durable event outbox before material scaling if needed.
- The server sends only first purchases whose final checkout verification carries the visitor's explicit ad-measurement consent. Both browser and backend tracking is limited to /daily; the separate 1cup main site and membership orders are out of scope. Renewals remain available to count internally for LTV, not primary ad acquisition.
- Baseline results with very few subscribers cannot establish reliable LTV or sustainable CAC.

## Reference
- https://developers.openai.com/ads/measurement-pixel
- https://developers.openai.com/ads/conversions-api
