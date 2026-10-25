// Daily's own phone-code sign-in. Server-only: uses the service-role client.
//
// Daily customers are not 1cup members. A Daily customer is a phone number verified with
// a code, stored in daily_customers; the session is a random token in an httpOnly cookie
// on 1cupenglish.com, with only its SHA-256 in daily_sessions. Nothing here touches
// public.users, phone_otp or Supabase Auth. The only shared piece is the delivery
// channel: codes go out through the same NHN Alimtalk sender and OTP template as 1cup.
import crypto from "crypto";
import { admin } from "../../../supabase/server";
import { alimtalkConfigured, sendOtpViaAlimtalk } from "../../../otp/alimtalk";

export const DAILY_SESSION_COOKIE = "daily_session";
export const DAILY_SESSION_DAYS = 30;

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_MIN_INTERVAL_MS = 30 * 1000;
const MAX_SENDS_PER_PHONE_PER_HOUR = 5;
// Every send can fall back to a paid SMS, so one client cannot fan out across numbers.
const MAX_SENDS_PER_IP_PER_HOUR = 10;

// Shared with 1cup's OTP service as a server secret; every Daily use is prefixed with
// "daily:" so a hash from one service is never valid in the other.
const HMAC_SECRET = process.env.OTP_HMAC_SECRET ?? "";

// Same guard as 1cup's OTP service: log codes only outside production.
const DEV_ECHO = process.env.OTP_DEV_ECHO === "true" && process.env.VERCEL_ENV !== "production";

export class DailyAuthError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function normalizePhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  return digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
}

function isKoreanMobile(phone: string): boolean {
  return /^01[016789]\d{7,8}$/.test(phone);
}

function hmac(value: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(`daily:${value}`).digest("hex");
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertConfigured() {
  if (!HMAC_SECRET || (!alimtalkConfigured() && !DEV_ECHO)) {
    throw new DailyAuthError("인증번호를 보낼 수 없어요. 잠시 후 다시 시도해 주세요.", 500);
  }
}

export async function sendDailyCode(rawPhone: string, clientIp: string | null): Promise<void> {
  assertConfigured();
  const phone = normalizePhone(rawPhone);
  if (!isKoreanMobile(phone)) throw new DailyAuthError("휴대폰 번호를 다시 확인해 주세요.");
  const db = admin();
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ipHash = clientIp ? hmac(`ip:${clientIp}`) : null;

  const [{ data: byPhone, error: phoneError }, ipCount] = await Promise.all([
    db.from("daily_otp_codes").select("created_at").eq("phone", phone).gte("created_at", sinceHour)
      .order("created_at", { ascending: false }),
    ipHash
      ? db.from("daily_otp_codes").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash)
        .gte("created_at", sinceHour)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (phoneError || ipCount.error) throw new DailyAuthError("인증번호를 보내지 못했어요.", 500);
  if ((byPhone?.length ?? 0) >= MAX_SENDS_PER_PHONE_PER_HOUR || (ipCount.count ?? 0) >= MAX_SENDS_PER_IP_PER_HOUR) {
    throw new DailyAuthError("요청이 너무 많아요. 잠시 후 다시 시도해 주세요.", 429);
  }
  const last = byPhone?.[0]?.created_at;
  if (last && Date.now() - new Date(last).getTime() < RESEND_MIN_INTERVAL_MS) {
    throw new DailyAuthError("30초 뒤에 다시 요청해 주세요.", 429);
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await db.from("daily_otp_codes").insert({
    phone,
    code_hash: hmac(`${phone}:${code}`),
    ip_hash: ipHash,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw new DailyAuthError("인증번호를 보내지 못했어요.", 500);

  if (DEV_ECHO) {
    console.warn(`[OTP_DEV_ECHO daily] phone=${phone} code=${code}`);
    if (!alimtalkConfigured()) return;
  }
  // Last: if delivery throws, the row simply expires unused.
  await sendOtpViaAlimtalk(phone, code);
}

/** Checks the code, then signs the number in, creating its Daily customer on first use. */
export async function verifyDailyCode(rawPhone: string, code: string): Promise<{ token: string; expiresAt: Date }> {
  assertConfigured();
  const phone = normalizePhone(rawPhone);
  if (!isKoreanMobile(phone)) throw new DailyAuthError("휴대폰 번호를 다시 확인해 주세요.");
  if (!/^\d{6}$/.test(code ?? "")) throw new DailyAuthError("인증번호 6자리를 입력해 주세요.");
  const db = admin();

  const { data: rows, error } = await db
    .from("daily_otp_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new DailyAuthError("인증하지 못했어요.", 500);
  const row = rows?.[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new DailyAuthError("인증번호가 만료됐어요. 다시 받아 주세요.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.from("daily_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    throw new DailyAuthError("시도 횟수를 넘었어요. 인증번호를 다시 받아 주세요.", 429);
  }
  const matches = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hmac(`${phone}:${code}`)));
  if (!matches) {
    await db.from("daily_otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    throw new DailyAuthError("인증번호가 맞지 않아요.");
  }
  const now = new Date();
  await db.from("daily_otp_codes").update({ consumed_at: now.toISOString() }).eq("id", row.id);

  const { data: customer, error: customerError } = await db
    .from("daily_customers")
    .upsert({ phone, last_login_at: now.toISOString() }, { onConflict: "phone" })
    .select("id")
    .single();
  if (customerError || !customer) throw new DailyAuthError("로그인하지 못했어요.", 500);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + DAILY_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { error: sessionError } = await db.from("daily_sessions").insert({
    customer_id: customer.id,
    token_hash: sha256(token),
    expires_at: expiresAt.toISOString(),
    last_seen_at: now.toISOString(),
  });
  if (sessionError) throw new DailyAuthError("로그인하지 못했어요.", 500);
  return { token, expiresAt };
}

export async function revokeDailySession(token: string | undefined): Promise<void> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return;
  await admin()
    .from("daily_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", sha256(token))
    .is("revoked_at", null);
}
