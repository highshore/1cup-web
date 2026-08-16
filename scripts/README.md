# Scripts

## English

This folder contains local operational scripts that are not part of the runtime app.
They all talk to Supabase through `_supabase.mjs`, which builds a **service-role** client
from `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Service role
bypasses RLS, so run these locally only.

- `export-articles-to-csv.mjs`: reads the `articles` table (plus `article_keywords`) and
  writes `articles_export.csv` at the repository root.
- `seed-celebrations.mjs`: seeds the leaderboard celebration wall. Idempotent on
  (member_name, headline).
- `upload-sample-articles.mjs`: uploads 1cup_article pipeline samples into `articles` and
  the `assets` storage bucket. Idempotent (fixed ids, upsert).

Run scripts from the repository root so relative output paths are predictable.

## 한국어

이 폴더는 런타임 앱에 포함되지 않는 로컬 운영 스크립트를 담습니다. 모든 스크립트는
`_supabase.mjs` 를 통해 Supabase 에 접속하며, 이 모듈은 `.env.local` 의
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 로 **service-role** 클라이언트를
만듭니다. service-role 은 RLS 를 우회하므로 로컬에서만 실행하세요.

- `export-articles-to-csv.mjs`: `articles` 테이블(및 `article_keywords`)을 읽어 저장소
  루트의 `articles_export.csv` 로 저장합니다.
- `seed-celebrations.mjs`: 리더보드 멤버 성취 목록을 시드합니다. (member_name, headline)
  기준 멱등입니다.
- `upload-sample-articles.mjs`: 1cup_article 파이프라인 샘플을 `articles` 테이블과
  `assets` 스토리지 버킷에 업로드합니다. 고정 id + upsert 로 멱등입니다.

상대 출력 경로가 예측 가능하도록 저장소 루트에서 스크립트를 실행하세요.
