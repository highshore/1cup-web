# Firebase → Supabase migration tooling

Operational scripts for the data half of the migration and for the production cutover.
They are **not** part of the web app: this folder has its own `package.json` (like
`functions/`) so `firebase-admin` and `pg` stay out of the app's dependency tree.

```bash
cd scripts/migration && npm install
```

The Firestore export (~72MB of real names, phone numbers and payment records) stays
**outside this repository**. Scripts read it from `../../../1cup-db-migration/data` by
default; override with `MIGRATION_DATA_DIR`. Never commit that directory.

## Credentials

| Variable | Used by | Where to get it |
|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | the Firestore/Auth readers | a `one-cup-eng` service-account JSON (gitignored) |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | the REST loaders | Supabase → Settings → API |
| `SUPABASE_DB_URL` | `load_to_supabase.mjs`, `backfill_auth_identifiers.mjs` | Supabase → Settings → Database → Connection string → **Session pooler** (the direct host is IPv6-only) |

## Scripts

| Script | What it does |
|---|---|
| `firestore_to_ndjson_prod.mjs` | Dumps every production Firestore collection to `<data>/<collection>.ndjson`. Reads LIVE data — run it during a write-freeze for the real cutover. |
| `firestore_to_ndjson.mjs` | Same, against the local emulator. |
| `load_to_supabase.mjs` | Full load of the NDJSON into Postgres over a direct connection (`pg`). Needs `SUPABASE_DB_URL`. |
| `delta_to_supabase.mjs` | Same mapping over PostgREST with the service-role key, so it needs no DB password. Everything is an upsert, so it is idempotent and also picks up rows changed in Firebase. `--apply` to write. |
| `backfill_auth_identifiers.mjs` | Fills `users.phone` / `users.email` from **Firebase Auth** — phone-auth users keep their number there, not in the Firestore document, so the document-only export misses it. Needs `SUPABASE_DB_URL`. |
| `backfill_auth_identifiers_rest.mjs` | The same backfill over PostgREST. `--apply` to write. |
| `payment_crosscheck.mjs` | Reconciles payment records between the two systems. |

## Cutover order

1. Freeze writes on the Firebase app.
2. `firestore_to_ndjson_prod.mjs` → fresh NDJSON.
3. `delta_to_supabase.mjs --apply` (or `load_to_supabase.mjs` with a DB URL).
4. `backfill_auth_identifiers_rest.mjs --apply`.
5. `payment_crosscheck.mjs` and the row-count checks.
6. Disable the Firebase schedulers, enable the Supabase `pg_cron` jobs, flip the app.

Chunk sizes matter on the REST path: batches of ~500 rows with large `jsonb` payloads
(`speaking_reports`, `article_keywords`) can trip a Cloudflare 520. The loader retries
row-by-row, but dropping to 50–100 per chunk is faster when that happens.
