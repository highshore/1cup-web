# Koreapas publisher

Private Cloud Run service used by `supabase/functions/marketing`. It receives a
validated, tracked post over HTTPS, drives Chromium to log in to Koreapas, and
returns only after the title is visible on the Free Ads first page.

It needs these Secret Manager secrets at runtime:

- `KOREAPAS_USER_ID`
- `KOREAPAS_PASSWORD`
- `PUBLISHER_TOKEN` — the same value as Supabase's `KOREAPAS_PUBLISHER_TOKEN`

Deploy with a private Cloud Run service, then make it callable only by the
Supabase publisher token. The public URL is acceptable because requests without
the token are rejected before any browser or credential access occurs.
