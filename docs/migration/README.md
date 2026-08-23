# Migration artifact package

This directory is the single entry point for retained Firebase → Supabase migration material. Historical reports, validation files, and legacy Firestore configuration live under `artifacts/`; active runtime code remains in its normal location.

## Runbooks and reviews

- [`artifacts/reviews/SUPABASE_MIGRATION.md`](artifacts/reviews/SUPABASE_MIGRATION.md) — migration plan and operating notes.
- [`artifacts/reviews/MIGRATION_AUDIT.md`](artifacts/reviews/MIGRATION_AUDIT.md) — migration audit findings and checks.
- [`artifacts/reviews/MIGRATION_UNIT_TEST_REVIEW.md`](artifacts/reviews/MIGRATION_UNIT_TEST_REVIEW.md) — unit-test review for the migration.

## Migration tooling

- [`../../scripts/migration/README.md`](../../scripts/migration/README.md) — migration script usage.
- [`../../scripts/migration/firestore_to_ndjson.mjs`](../../scripts/migration/firestore_to_ndjson.mjs) — Firestore export conversion.
- [`../../scripts/migration/firestore_to_ndjson_prod.mjs`](../../scripts/migration/firestore_to_ndjson_prod.mjs) — production export conversion.
- [`../../scripts/migration/load_to_supabase.mjs`](../../scripts/migration/load_to_supabase.mjs) — initial Supabase load.
- [`../../scripts/migration/delta_to_supabase.mjs`](../../scripts/migration/delta_to_supabase.mjs) — delta migration.
- [`../../scripts/migration/backfill_auth_identifiers.mjs`](../../scripts/migration/backfill_auth_identifiers.mjs) — auth identifier backfill.
- [`../../scripts/migration/payment_crosscheck.mjs`](../../scripts/migration/payment_crosscheck.mjs) — payment-data cross-check.

## Database migrations

- [`../../supabase/migrations/`](../../supabase/migrations/) — schema, RLS, cleanup, and post-cutover migrations.
- [`../../.env.supabase.example`](../../.env.supabase.example) — non-secret environment template for migration tooling.

## Validation artifacts

- [`artifacts/validation/1cup-web_단위테스트 - Test Case.csv`](artifacts/validation/1cup-web_%EB%8B%A8%EC%9C%84%ED%85%8C%EC%8A%A4%ED%8A%B8%20-%20Test%20Case.csv)
- [`artifacts/validation/1cup-web_단위테스트 - Test Case (reviewed 2026-08-16).csv`](artifacts/validation/1cup-web_%EB%8B%A8%EC%9C%84%ED%85%8C%EC%8A%A4%ED%8A%B8%20-%20Test%20Case%20(reviewed%202026-08-16).csv)
- `artifacts/validation/1cup-web_단위테스트.xlsx`
- `artifacts/validation/1cup-web_단위테스트(리뷰).xlsx`
- `artifacts/data/training_data.csv`
- `artifacts/legacy-firebase/` — retained Firestore rules and index definitions; they are not active application configuration.

## Maintenance rule

New migration-only scripts, audit notes, or verification artifacts should be added to this index. Runtime application code and ordinary product migrations should remain in their normal locations.
