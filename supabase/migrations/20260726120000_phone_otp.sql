-- Custom phone OTP verification (Free-plan alternative to the Pro-only Send SMS auth hook).
-- The web app verifies phone numbers itself and delivers codes via Kakao AlimTalk.
-- Only the service role touches this table; RLS denies every other role.

create table if not exists public.phone_otp (
  id           uuid primary key default gen_random_uuid(),
  phone        text        not null,           -- normalized 010… (matches public.users.phone)
  code_hash    text        not null,           -- HMAC-SHA256(phone:code) — never store the raw code
  expires_at   timestamptz not null,
  attempts     integer     not null default 0, -- verify attempts consumed
  consumed_at  timestamptz,                    -- set once used / invalidated
  created_at   timestamptz not null default now()
);

-- Rate-limit + latest-code lookups are by (phone, created_at desc).
create index if not exists phone_otp_phone_created_idx
  on public.phone_otp (phone, created_at desc);

-- Lock it down: enable RLS with NO policies → only the service role (which bypasses
-- RLS) can read/write. This table must never be reachable by anon/authenticated clients.
alter table public.phone_otp enable row level security;
