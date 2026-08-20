# Growth Marketing Guide

- This feature is the admin-only Gopas scheduling workspace. Keep browser Supabase/Edge Function access in `services/growth_service.ts` and the UI in `components/GrowthDashboard.tsx`.
- `growth_config` row `settings` is only the single active-run lease. Every `marketing_templates` row holds its reusable destination/title/copy/CTA/photo preset and its own KST schedule; `marketing_cron_runs` holds immutable per-run snapshots for the cards; `growth_posts` holds the resulting post and its accumulated metrics.
- `growth_image_service.ts` uploads at most six JPG/PNG/WebP photos per template to Supabase Storage `assets/marketing/`. Preserve their user-defined order; the publisher receives the photo list and generated HTML puts each image before the post body.
- Copying a prepared post appends both the `/r/{trackingCode}` first-party redirect and an invisible zero-width marker. Do not expose the marker in visible text.
- The `marketing` Edge Function refreshes prior post performance at the start of each run. Redirect click totals and successful paid-signup attribution remain server-owned; payment attribution occurs in the Supabase `payment` Edge Function.
- The schedule UI sends an explicit empty weekday list when all days are off; preserve it as a disabled schedule rather than defaulting back to weekdays. Template variables such as `{{daysUntilSunday}}` are deterministic and must remain server-resolved at run time, not expanded in the browser or by an AI model.
- Before each publish attempt, the Edge Function checks the first page of Gopas Free Ads for the normalized ad title. A match is a `skipped` run, not a post or a failure.
