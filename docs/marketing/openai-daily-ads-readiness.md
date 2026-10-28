# OpenAI Ads readiness: One Cup Daily

Status: implementation draft only. Do not publish the campaign or deploy this change until all preflight checks pass.

## Live advertiser account blockers observed on 2026-10-29 (Asia/Seoul)
- Advertiser: Native PT, KRW; account rejected with reason "missing_favicon".
- Account logo not submitted. Card billing setup required. Identity check not required.
- No conversion sources, standard event settings, or campaigns existed at inspection.
- Promotion qualifying: pay KRW 300,000 in eligible ad charges by 2026-11-12 02:01 KST to earn up to KRW 300,000 credit, subject to exact promotion terms. Credit is not currently spendable.
- A campaign budget can spend real card funds; do not activate without approval of a fixed KRW budget and campaign dates.

## Code changes in this branch
- /daily is now indexable and in sitemap. Public robots.txt permits /daily (still disallows /api/).
- Optional, consent-gated OpenAI Pixel only under /daily, including page_viewed, confirmed trial_started, and checkout_started.
- Forward Pixel's first-party __oppref and __obref cookies only after opt-in when a checkout is verified.
- Report order_created from Supabase daily payment settlement after confirmed Payple charge and completed first-time checkout; exclude renewal transactions and non-first purchases. Stable event IDs deduplicate repeated verifies; CAPI failures cannot undo a completed payment.
- Daily privacy copy explains the optional disclosure. Consent terms were advanced to version 2026-10-29.2 in three locations (Daily frontend constants, Edge index, Edge payments).

## Required account setup
1. Select and approve the correct public square brand logo for Native PT, upload it, apply as account logo, and obtain account review approval. A public logo candidate is https://1cupenglish.com/images/logos/1cup_logo.jpg, not yet approved.
2. Complete billing card setup in Ads Manager; do not share card details here.
3. In Ads Manager -> Conversions, create a website Pixel with a standard order_created event goal and a Conversions API key.
4. Add Vercel production env NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID with the **Pixel ID** (not the API key).
5. Add Supabase daily Edge secrets OPENAI_ADS_PIXEL_ID and OPENAI_ADS_CAPI_KEY (not a generic OPENAI_API_KEY). Keep the CAPI key server-only. Do not paste keys into GitHub, PRs, logs, or chat.
6. Review privacy-law requirements (including domestic and cross-border advertisement measurement notices/consent) before activation; ensure tracking consent is effective.
7. Inspect CSP and permit https://bzrcdn.openai.com (script/connect) and https://bzr.openai.com (connect/img) if CSP blocks them.

## Release and validation order
1. Review PR and run npm run build. Do not merge if it fails.
2. Ensure Ads Manager pixel source and key exist, and env vars are set.
3. Deploy the updated Supabase daily Edge Function and Next.js production build in one coordinated release because the Daily terms version must match.
4. Verify GET /daily returns 200, index/follow metadata, public sitemap contains /daily; confirm there is no added x-robots noindex header.
5. Verify Pixel is NOT loaded or sending events before consent. After opt-in, confirm page_viewed, trial_started after confirmed free-lesson activation, and checkout_started after checkout-window created. On opt-out, confirm no further tracking.
6. Use a *user-approved test card/payment or Payple sandbox* through the normal payment flow. Do not trigger a real charge merely to test the Ads SDK without authorization.
7. Only after verified Payple settlement, confirm one order_created event with actual KRW amount in the Ads Manager 15-minute conversion events diagnostic view. Confirm duplicate checkout-verify requests cause no duplicate charge or conversion.
8. Compare Payple success, daily_orders.completed, subscription grant, and Ads Manager events. Treat any mismatch as a launch blocker.
9. Create one KRW campaign with purchase objective, two focused ad groups (business English at work; daily habit), three approved chat-card variants, explicit total campaign budget and end date. Activate only with specific approval for billable spend.

## Limitations
- Without NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID the client component is inert.
- Without Supabase OPENAI_ADS_PIXEL_ID or OPENAI_ADS_CAPI_KEY the backend does not send events.
- Backend events are sent inline with a 5-second timeout; failures are only logged, not queued for retry. Add a durable event outbox before material scaling if needed.
- The server sends only first purchases whose final checkout verification carries the visitor's explicit ad-measurement consent. Renewals remain available to count internally for LTV, not primary ad acquisition.
- Baseline results with very few subscribers cannot establish reliable LTV or sustainable CAC.

## Reference
- https://developers.openai.com/ads/measurement-pixel
- https://developers.openai.com/ads/conversions-api
