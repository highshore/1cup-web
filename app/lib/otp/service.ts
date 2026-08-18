// Custom phone-OTP verification + Supabase session minting.
// Free-plan replacement for the Pro-only "Send SMS" auth hook: WE own the OTP
// lifecycle (generate → deliver via AlimTalk → verify), then mint a real Supabase
// session for the phone user so app/lib/contexts/auth_context.tsx works unchanged.
//
// Server-only (uses the service-role client). Never import into a client component.
//
// Required env (beyond the AlimTalk ones in ./alimtalk.ts):
//   OTP_HMAC_SECRET               server secret; peppers the code hash AND derives the
//                                 per-user password used for signInWithPassword. Keep secret.
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { admin } from "../supabase/server";
import { sendOtpViaAlimtalk, alimtalkConfigured } from "./alimtalk";

const CODE_TTL_MS = 5 * 60 * 1000;       // code valid for 5 minutes
const MAX_ATTEMPTS = 5;                   // verify attempts per code
const RESEND_MIN_INTERVAL_MS = 30 * 1000; // min gap between sends to one number
const MAX_SENDS_PER_HOUR = 5;             // sends per number per hour

const HMAC_SECRET = process.env.OTP_HMAC_SECRET ?? "";

// Testing only: when OTP_DEV_ECHO=true, log the code to the server console and do
// NOT fail the request if AlimTalk delivery fails (e.g. template pending approval).
// NEVER set this in real production — it writes OTP codes to the function logs.
const DEV_ECHO = process.env.OTP_DEV_ECHO === "true";

// Error whose .status maps to the HTTP response. Messages here are user-facing (Korean).
export class OtpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---- phone helpers ---------------------------------------------------------
// Normalize any input to the Korean domestic form (01012345678) — the format
// stored in public.users.phone, so account lookups line up.
export function toLocal010(input: string): string {
  const d = (input ?? "").replace(/\D/g, "");
  if (d.startsWith("82")) return "0" + d.slice(2);
  return d;
}
// Country-code digits, no "+": 01012345678 -> 821012345678. Used for Supabase Auth.
function toE164Digits(local: string): string {
  return "82" + local.slice(1);
}
function isValidKoreanMobile(local: string): boolean {
  return /^01[016789]\d{7,8}$/.test(local);
}

// ---- crypto ----------------------------------------------------------------
function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
function hashCode(code: string, local: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(`${local}:${code}`).digest("hex");
}
// Deterministic, server-only password for the phone user. The user never sees or
// uses it; it exists purely so we can signInWithPassword to mint a session.
function derivePassword(e164digits: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(`pw:${e164digits}`).digest("hex");
}

function assertConfigured() {
  if (!HMAC_SECRET || !alimtalkConfigured()) {
    throw new OtpError("OTP service is not configured", 500);
  }
}

// ---- send ------------------------------------------------------------------
export async function createAndSendCode(rawPhone: string): Promise<void> {
  assertConfigured();
  const local = toLocal010(rawPhone);
  if (!isValidKoreanMobile(local)) throw new OtpError("올바른 휴대폰 번호를 입력해주세요.", 400);
  const db = admin();

  // Rate limit per phone number.
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent, error: rErr } = await db
    .from("phone_otp")
    .select("created_at")
    .eq("phone", local)
    .gte("created_at", sinceHour)
    .order("created_at", { ascending: false });
  if (rErr) throw new OtpError("인증번호 전송에 실패했습니다.", 500);
  if (recent && recent.length >= MAX_SENDS_PER_HOUR) {
    throw new OtpError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  }
  if (recent && recent.length > 0) {
    const last = new Date(recent[0].created_at as string).getTime();
    if (Date.now() - last < RESEND_MIN_INTERVAL_MS) {
      throw new OtpError("잠시 후 다시 요청해주세요.", 429);
    }
  }

  const code = generateCode();
  const { error: iErr } = await db.from("phone_otp").insert({
    phone: local,
    code_hash: hashCode(code, local),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (iErr) throw new OtpError("인증번호 전송에 실패했습니다.", 500);

  if (DEV_ECHO) {
    // Read the code from the server/Vercel logs while the AlimTalk template is pending.
    console.warn(`[OTP_DEV_ECHO] phone=${local} code=${code}`);
    try {
      await sendOtpViaAlimtalk(local, code);
    } catch (e) {
      console.warn("[OTP_DEV_ECHO] delivery failed (ignored for testing):", e);
    }
    return;
  }

  // Deliver last; if this throws the row simply expires unused.
  await sendOtpViaAlimtalk(local, code);
}

// ---- verify + mint session -------------------------------------------------
export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

export async function verifyCodeAndMintSession(
  rawPhone: string,
  code: string,
): Promise<SessionTokens> {
  assertConfigured();
  const local = toLocal010(rawPhone);
  if (!isValidKoreanMobile(local)) throw new OtpError("올바른 휴대폰 번호를 입력해주세요.", 400);
  if (!/^\d{6}$/.test(code ?? "")) throw new OtpError("인증번호가 올바르지 않습니다.", 400);
  const db = admin();

  // Newest un-consumed code for this number.
  const { data: rows, error } = await db
    .from("phone_otp")
    .select("id, code_hash, expires_at, attempts")
    .eq("phone", local)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new OtpError("인증에 실패했습니다.", 500);
  const row = rows?.[0];
  if (!row) throw new OtpError("코드가 만료되었거나 존재하지 않습니다.", 400);
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    throw new OtpError("코드가 만료되었습니다. 다시 요청해주세요.", 400);
  }
  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    await db.from("phone_otp").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    throw new OtpError("시도 횟수를 초과했습니다. 다시 요청해주세요.", 429);
  }

  // Constant-time compare; both sides are 64-char sha256 hex.
  const ok = crypto.timingSafeEqual(
    Buffer.from(row.code_hash as string),
    Buffer.from(hashCode(code, local)),
  );
  if (!ok) {
    await db.from("phone_otp").update({ attempts: (row.attempts as number) + 1 }).eq("id", row.id);
    throw new OtpError("인증번호가 올바르지 않습니다.", 400);
  }
  await db.from("phone_otp").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

  // ---- mint a Supabase session for this phone user ----
  const e164 = toE164Digits(local);
  const password = derivePassword(e164);

  // Reuse the existing account if this phone already maps to one — do NOT create a
  // duplicate for migrated phone users. public.users.phone is the normalized 010 form.
  const { data: existing } = await db
    .from("users")
    .select("uid, auth_id")
    .eq("phone", local)
    .limit(1);
  const existingUid = existing?.[0]?.uid as string | undefined;
  const existingAuthId = existing?.[0]?.auth_id as string | undefined;

  // signInWithPassword({ phone }) authenticates whichever auth user OWNS this number,
  // which is not necessarily users.auth_id: after a Kakao login the profile can point
  // at the Kakao auth user while the phone still belongs to the original one. Set the
  // password on the phone's actual owner, otherwise we update one account and sign in
  // as another. auth.users is not reachable over PostgREST, hence the RPC.
  const { data: phoneOwner } = await db.rpc("auth_user_id_by_phone", { p_phone: e164 });
  const targetAuthId = (phoneOwner as string | null) ?? existingAuthId ?? null;

  let authId: string;
  if (targetAuthId) {
    const { error: uErr } = await db.auth.admin.updateUserById(targetAuthId, {
      password,
      phone: e164,
      phone_confirm: true,
    });
    if (uErr) {
      // The number may already be confirmed on this account; password-only is enough.
      await db.auth.admin.updateUserById(targetAuthId, { password });
    }
    authId = targetAuthId;
  } else {
    const { data: created, error: cErr } = await db.auth.admin.createUser({
      phone: e164,
      phone_confirm: true,
      password,
    });
    if (cErr || !created?.user) throw new OtpError("계정 생성에 실패했습니다.", 500);
    authId = created.user.id;
    // Defensive: ensure a public.users row exists even if the handle_new_user trigger didn't.
    const { data: linked } = await db
      .from("user_auth_identities")
      .select("uid")
      .eq("auth_id", authId)
      .maybeSingle();
    if (!linked) {
      await db.from("users").insert({ uid: authId, auth_id: authId, phone: local });
    }
  }

  // Make sure this auth user resolves to a profile. Without the link row, current_uid()
  // returns null for the session and RLS hides the user's own data.
  //
  // ignoreDuplicates is load-bearing: if this auth user is ALREADY linked, that link
  // wins. Overwriting it is what stranded a paying member — a Kakao login had created a
  // second profile carrying her number, so the users.phone lookup above resolved to the
  // new empty profile and the upsert moved her original phone identity onto it.
  await db
    .from("user_auth_identities")
    .upsert(
      { auth_id: authId, uid: existingUid ?? authId },
      { onConflict: "auth_id", ignoreDuplicates: true },
    );

  // Sign in server-side with a throwaway anon client to obtain real tokens
  // (proper access + refresh, unlike a hand-signed JWT).
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({
    phone: e164,
    password,
  });
  if (sErr || !sess?.session) throw new OtpError("로그인에 실패했습니다.", 500);

  return {
    access_token: sess.session.access_token,
    refresh_token: sess.session.refresh_token,
  };
}
