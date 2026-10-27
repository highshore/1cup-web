// Daily's own sign-in. Server-only: uses the service-role client.
//
// Daily customers are not 1cup members. A Daily customer is the verified phone number
// Kakao Login returns (lessons go to it by Alimtalk), stored in daily_customers; nobody
// types a number. The session is a random token in an httpOnly cookie on
// 1cupenglish.com, with only its SHA-256 in daily_sessions. Nothing here touches
// public.users, phone_otp or Supabase Auth.
//
// Two kinds of session share the cookie:
//   phone  from Kakao Login. Everything, including payments. (The name predates Kakao
//          being the only way in; the scope column still says "phone".)
//   link   from opening a Kakao message's button link (signInFromLink). The link can be
//          forwarded, so it only covers what touches the reader's own learning; actions
//          that record consent or move money ask for Kakao Login first.
import crypto from "crypto";
import { admin } from "../../../supabase/server";

export const DAILY_SESSION_COOKIE = "daily_session";
export const DAILY_SESSION_DAYS = 30;
// A message's button signs in for this long after it was sent; after that it still
// opens the lesson, only without signing anyone in.
const LINK_SIGNIN_DAYS = 14;

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

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function createSession(
  customerId: string,
  scope: "phone" | "link",
  deliveryId: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const now = new Date();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + DAILY_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { error } = await admin().from("daily_sessions").insert({
    customer_id: customerId,
    token_hash: sha256(token),
    expires_at: expiresAt.toISOString(),
    last_seen_at: now.toISOString(),
    scope,
    delivery_id: deliveryId,
  });
  if (error) throw new DailyAuthError("로그인하지 못했어요.", 500);
  return { token, expiresAt };
}

/**
 * Signs in the verified phone number Kakao Login returned, creating its Daily customer
 * on first use. The session is a full one. A Kakao nickname fills in an empty name only.
 */
export async function signInVerifiedPhone(rawPhone: string, name: string | null): Promise<{ token: string; expiresAt: Date }> {
  const phone = normalizePhone(rawPhone);
  if (!isKoreanMobile(phone)) throw new DailyAuthError("카카오계정의 휴대폰 번호로는 알림톡을 받을 수 없어요. 국내 휴대폰 번호가 등록된 카카오계정으로 시작해 주세요.");
  const db = admin();
  const now = new Date().toISOString();
  const { data: customer, error } = await db
    .from("daily_customers")
    .upsert({ phone, last_login_at: now }, { onConflict: "phone" })
    .select("id, name")
    .single();
  if (error || !customer) throw new DailyAuthError("로그인하지 못했어요.", 500);
  const nickname = (name ?? "").trim().slice(0, 20);
  if (!customer.name && nickname) {
    await db.from("daily_customers").update({ name: nickname }).eq("id", customer.id);
  }
  return await createSession(customer.id, "phone", null);
}

/**
 * Signs the browser in from a Kakao message's button link (the delivery's access token),
 * with a link-scoped session. Returns null when the link is unknown, was never sent, or
 * is older than LINK_SIGNIN_DAYS.
 */
export async function signInFromLink(accessToken: string): Promise<{ token: string; expiresAt: Date } | null> {
  if (!/^[0-9a-f]{36}$/.test(accessToken ?? "")) return null;
  const { data } = await admin()
    .from("daily_deliveries")
    .select("id, status, sent_at, subscription:daily_subscriptions(customer_id)")
    .eq("access_token", accessToken)
    .maybeSingle();
  const customerId = (data as unknown as { subscription: { customer_id: string | null } | null } | null)?.subscription
    ?.customer_id;
  if (!data || !customerId || data.status !== "sent" || !data.sent_at) return null;
  if (Date.now() - new Date(data.sent_at).getTime() > LINK_SIGNIN_DAYS * 24 * 60 * 60 * 1000) return null;
  return await createSession(customerId, "link", data.id);
}

export async function revokeDailySession(token: string | undefined): Promise<void> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return;
  await admin()
    .from("daily_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", sha256(token))
    .is("revoked_at", null);
}

export interface DailySessionCustomer {
  id: string;
  phone: string;
  name: string | null;
  /** Signed in with Kakao Login rather than from a message link. */
  verified: boolean;
}

/** The Daily customer behind a session cookie, or null when it is missing, revoked or expired. */
export async function customerForSession(token: string | undefined): Promise<DailySessionCustomer | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await admin()
    .from("daily_sessions")
    .select("expires_at, revoked_at, scope, customer:daily_customers(id, phone, name)")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  const customer = (data as unknown as { customer: Omit<DailySessionCustomer, "verified"> | null }).customer;
  return customer ? { ...customer, verified: data.scope === "phone" } : null;
}
