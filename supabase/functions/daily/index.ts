// daily — Supabase Edge Function (Deno) for 영어 한잔 Daily.
//
// Actions
//   tick       pg_cron, every 5 minutes. Sends due lessons, Saturday reviews and
//              trial-ended notices. Authorized by the Vault-held daily_scheduler_secret.
//   start-info   Signed-in Daily customer (x-daily-session, forwarded by the Next.js
//                /api/daily route from its httpOnly cookie; a session from a message
//                link may read but not start trials or pay, see NEEDS_KAKAO_LOGIN). What the signup page needs:
//                whether trials are open to them, the masked phone, and which tracks
//                they already used or hold.
//   start-trial  Signed-in Daily customer. Records consent, uses up the phone's free
//                trial on the track and sends the free lesson immediately.
//   billing      pg_cron, daily 09:10 KST. Charges renewals due within a day, once per
//                period, and ends paid access that ran out (see payments.ts).
//   billing-info / checkout-window / checkout-verify / cancel-renewal
//                Signed-in Daily customer: plans, starting a Payple checkout, settling
//                it (idempotent), and turning off auto-renew.
//   account-info / account-update / resume-renewal / refund-request / account-delete
//                Signed-in Daily customer: the account page (account.ts). Changing
//                anything needs a Kakao Login session; refunds are only requested here.
//   admin-refunds / admin-refund-decide
//                1cup staff admins: list refund requests, approve (Payple cancel) or
//                reject them.
//   POST /daily/callback  Payple's server callback (no auth): keeps the billing key on
//                the order and redirects the browser to /daily/subscribe/result.
//   resend-trial Server only (Vault scheduler secret). Sends a trial its free lesson
//                again when the first attempt failed; never sends a second lesson.
//   test-send    1cup staff admins only: an operations tool, not a customer path.
//                Sends one message of a given kind to a phone number using the latest
//                ready lesson, without touching subscriptions or deliveries.
//                For checking approved templates on a real phone before launch.
//
// Opening trials to everyone, and the numbers allowed to try the flow first, live in the
// daily_config row (trial_open, tester_phones), not in secrets.
//
// Template codes live in daily_config too (template_style, lesson_template,
// review_template, trial_ended_template); until all three resolve, nothing is sent.
//
// Secrets (supabase secrets set …)
//   DAILY_TEMPLATE_LESSON, DAILY_TEMPLATE_REVIEW, DAILY_TEMPLATE_TRIAL_ENDED
//       Fallback template codes when daily_config has none.
//   DAILY_SMS_FALLBACK   "true" to add an LMS fallback (default off; needs the Kakao
//                        channel's text-resend setting in NHN, or NHN rejects the send).
//   DAILY_SITE_URL       Base URL in fallback texts (default https://1cupenglish.com).
//   KAKAO_APPKEY, KAKAO_SECRET_KEY, KAKAO_SENDER_KEY  shared with messaging.

import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid, recordSchedulerHeartbeat } from "../_shared/db.ts";
import { krPhone, sendKakaoMessages } from "../_shared/kakao.ts";
import {
  accountInfo,
  adminDecideRefund,
  adminRefunds,
  deleteAccount,
  requestRefund,
  resumeRenewal,
  switchLevel,
  updateSettings,
} from "./account.ts";
import {
  billingInfo,
  cancelRenewal,
  createCheckoutWindow,
  handleCallback,
  PaymentError,
  runBilling,
  verifyCheckout,
} from "./payments.ts";
import {
  runTick,
  sendTrialLesson,
  templateCodes,
  trialLessonFor,
  type DeliveryKind,
  type Subscription,
  isTrack,
  TRACK_LABEL,
  type Track,
} from "./delivery.ts";

async function schedulerAuthorized(req: Request): Promise<boolean> {
  const presented = req.headers.get("x-daily-scheduler-secret");
  if (!presented) return false;
  const { data, error } = await admin().rpc("daily_scheduler_secret");
  if (error || typeof data !== "string" || data.length === 0) {
    console.error("daily scheduler secret unavailable:", error?.message);
    return false;
  }
  return presented === data;
}

async function callerIsAdmin(req: Request): Promise<boolean> {
  const uid = await callerUid(req);
  if (!uid) return false;
  const { data } = await admin().from("users").select("account_status").eq("uid", uid).maybeSingle();
  return data?.account_status === "admin";
}

// Bump together with DAILY_TERMS_VERSION in app/lib/features/daily/constants.ts.
const TERMS_VERSION = "2026-10-27.2";

// A Daily customer, signed in with Kakao Login. Daily customers are not 1cup
// members: this never reads public.users or Supabase Auth.
interface Customer {
  id: string;
  phone: string;
  name: string | null;
  // Signed in with Kakao Login, not from a message link (see the
  // 20261026010000_daily_link_sessions migration).
  verified: boolean;
}

// What a link session may not do: these record consent or move money, and a message
// link can be forwarded. The page asks for Kakao Login, then retries.
const NEEDS_KAKAO_LOGIN = new Set([
  "start-trial",
  "checkout-window",
  "cancel-renewal",
  "account-update",
  "resume-renewal",
  "switch-level",
  "refund-request",
  "account-delete",
]);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The Next.js server forwards the session token from its httpOnly cookie in this header.
async function loadCustomer(req: Request): Promise<Customer | null> {
  const token = req.headers.get("x-daily-session") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await admin()
    .from("daily_sessions")
    .select("expires_at, revoked_at, scope, customer:daily_customers(id, phone, name)")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  const customer = (data as unknown as { customer: Omit<Customer, "verified"> | null }).customer;
  return customer ? { ...customer, verified: data.scope === "phone" } : null;
}

async function trialsOpenFor(customer: Customer): Promise<boolean> {
  const { data } = await admin()
    .from("daily_config")
    .select("trial_open, tester_phones")
    .eq("id", "settings")
    .maybeSingle();
  if (!data) return false;
  return data.trial_open === true || (data.tester_phones ?? []).includes(customer.phone);
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`;
}

async function handleStartInfo(customer: Customer) {
  const db = admin();
  const [{ data: claims }, { data: live }, open] = await Promise.all([
    db.from("daily_trial_claims").select("track").eq("recipient_phone", customer.phone),
    db.from("daily_subscriptions").select("track").eq("customer_id", customer.id).in("status", ["trial", "active"]),
    trialsOpenFor(customer),
  ]);
  return {
    open: open && (await templateCodes(db)) !== null,
    phone: maskPhone(customer.phone),
    verified: customer.verified,
    name: customer.name,
    usedTrialTracks: (claims ?? []).map((c) => c.track),
    liveTracks: (live ?? []).map((s) => s.track),
  };
}

class StartError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
  }
}

async function handleStartTrial(
  customer: Customer,
  body: { track?: unknown; time?: unknown; name?: unknown; marketing?: unknown; agreements?: unknown; termsVersion?: unknown },
) {
  if (!(await trialsOpenFor(customer))) throw new StartError("not-open", 403);
  const codes = await templateCodes(admin());
  if (!codes) throw new StartError("not-open", 403);

  const track = body.track;
  if (!isTrack(track)) throw new StartError("invalid-track");
  const time = typeof body.time === "string" ? body.time : "";
  const match = /^([01][0-9]|2[0-2]):00$/.exec(time);
  if (!match || time < "06:00" || time > "22:00") throw new StartError("invalid-time");
  // What the lesson messages call them: the Kakao nickname saved at sign-in. A name in
  // the body (older clients) still overrides it; with neither, messages say "고객 님".
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 20) || null : null;

  // The three required agreements, checked here as well as in the dialog: the record
  // this writes is the proof of consent, so it must not depend on the client alone.
  const agreements = (body.agreements ?? {}) as Record<string, unknown>;
  if (agreements.terms !== true || agreements.privacy !== true || agreements.messages !== true) {
    throw new StartError("consent-required");
  }
  if (body.termsVersion !== TERMS_VERSION) throw new StartError("terms-outdated", 409);

  const db = admin();
  const lesson = await trialLessonFor(db, track);
  if (!lesson) throw new StartError("no-lesson", 503);

  const { data: sub, error } = await db.rpc("daily_start_trial", {
    p_customer_id: customer.id,
    p_track: track,
    p_name: name,
    p_delivery_time: `${time}:00`,
    p_marketing: body.marketing === true,
    p_terms_version: TERMS_VERSION,
  });
  if (error) {
    if (error.message.includes("trial-used")) throw new StartError("trial-used", 409);
    if (error.message.includes("already-subscribed")) throw new StartError("already-subscribed", 409);
    throw new Error(`start trial failed: ${error.message}`);
  }

  const subscription = sub as Subscription & { next_send_at: string };
  const sent = await sendTrialLesson(db, subscription, lesson, codes);
  return { subscriptionId: subscription.id, sent, nextSendAt: subscription.next_send_at };
}

async function handleResendTrial(body: { subscriptionId?: unknown }) {
  const db = admin();
  const { data: sub } = await db
    .from("daily_subscriptions")
    .select("id, customer_id, track, recipient_phone, recipient_name, delivery_time, status, next_send_at")
    .eq("id", typeof body.subscriptionId === "string" ? body.subscriptionId : "")
    .maybeSingle();
  if (!sub) throw new Error("subscription not found");
  if (sub.status !== "trial") throw new Error("not a trial");
  const { count } = await db
    .from("daily_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", sub.id)
    .eq("kind", "lesson")
    .eq("status", "sent");
  if ((count ?? 0) > 0) return { sent: false, reason: "already-sent" };
  const codes = await templateCodes(db);
  if (!codes) throw new Error("template codes are not configured");
  const lesson = await trialLessonFor(db, sub.track as Track);
  if (!lesson) throw new Error("no ready lesson");
  return { sent: await sendTrialLesson(db, sub as Subscription, lesson, codes) };
}

async function handleTestSend(body: { phone?: unknown; kind?: unknown; track?: unknown }) {
  const phone = krPhone(typeof body.phone === "string" ? body.phone : "");
  if (!/^01[0-9]{8,9}$/.test(phone)) throw new Error("phone must be a Korean mobile number");
  const kind = (body.kind ?? "lesson") as DeliveryKind;
  if (!["lesson", "review", "trial_ended"].includes(kind)) throw new Error("unknown kind");
  const track = (body.track ?? "basic") as Track;
  if (!isTrack(track)) throw new Error("unknown track");

  const codes = await templateCodes(admin());
  if (!codes) throw new Error("template codes are not configured");

  const { data: lesson } = await admin()
    .from("daily_lessons")
    .select("expression, meaning, examples")
    .eq("track", track)
    .eq("status", "ready")
    .order("publish_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  const expression = lesson?.expression ?? "circle back";
  const meaning = lesson?.meaning ?? "(논의를) 나중에 다시 이어가다";
  const example = lesson?.examples?.[0]?.en ?? "Let's circle back on pricing after the launch.";
  const trackLabel = TRACK_LABEL[track];

  const params: Record<DeliveryKind, Record<string, string>> =
    codes.style === "send-article"
      ? {
        lesson: { "korean-title": `[${trackLabel}] 오늘의 표현 ${expression}: ${meaning}`, "customer-name": "테스트", "article-link": "1cupenglish.com/daily" },
        review: { "korean-title": `[영어 한잔 Daily] 이번 주 복습: ${expression}`, "customer-name": "테스트", "article-link": "1cupenglish.com/daily" },
        trial_ended: { "korean-title": `[영어 한잔 Daily] ${trackLabel} 무료 체험이 끝났어요`, "customer-name": "테스트", "article-link": "1cupenglish.com/daily" },
      }
      : {
        lesson: { name: "테스트", track: trackLabel, expression, meaning, example, token: "test" },
        review: { name: "테스트", count: "1", expressions: `· ${expression}`, token: "test" },
        trial_ended: { name: "테스트", track: trackLabel, token: "test" },
      };
  const code = kind === "lesson" ? codes.lesson : kind === "review" ? codes.review : codes.trialEnded;
  return await sendKakaoMessages([{ recipientNo: phone, templateParameter: params[kind] }], code);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (new URL(req.url).pathname.endsWith("/callback")) {
    return await handleCallback(admin(), req);
  }
  if (req.method !== "POST") {
    return json(req, { success: false, error: "Method Not Allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(req, { success: false, error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string | undefined;
  try {
    switch (action) {
      case "tick": {
        if (!(await schedulerAuthorized(req))) {
          return json(req, { success: false, error: "permission-denied" }, 403);
        }
        const stats = await runTick(admin());
        await recordSchedulerHeartbeat("daily.tick", { stats }, "20 minutes");
        return json(req, { success: true, stats });
      }
      case "billing": {
        if (!(await schedulerAuthorized(req))) {
          return json(req, { success: false, error: "permission-denied" }, 403);
        }
        const billingStats = await runBilling(admin());
        await recordSchedulerHeartbeat("daily.billing", { stats: billingStats }, "26 hours");
        return json(req, { success: true, stats: billingStats });
      }
      case "resend-trial": {
        if (!(await schedulerAuthorized(req))) {
          return json(req, { success: false, error: "permission-denied" }, 403);
        }
        return json(req, { success: true, ...(await handleResendTrial(body)) });
      }
      case "billing-info":
      case "checkout-window":
      case "checkout-verify":
      case "cancel-renewal":
      case "account-info":
      case "account-update":
      case "resume-renewal":
      case "switch-level":
      case "refund-request":
      case "account-delete": {
        const customer = await loadCustomer(req);
        if (!customer) return json(req, { success: false, errorCode: "login-required" }, 401);
        if (NEEDS_KAKAO_LOGIN.has(action) && !customer.verified) {
          return json(req, { success: false, errorCode: "verify-required" }, 403);
        }
        const db = admin();
        try {
          const handlers: Record<string, () => Promise<Record<string, unknown>>> = {
            "billing-info": () => billingInfo(db, customer),
            "checkout-window": () => createCheckoutWindow(db, customer, body),
            "checkout-verify": () => verifyCheckout(db, customer, body),
            "cancel-renewal": () => cancelRenewal(db, customer, body),
            "account-info": () => accountInfo(db, customer),
            "account-update": () => updateSettings(db, customer, body),
            "resume-renewal": () => resumeRenewal(db, customer, body),
            "switch-level": () => switchLevel(db, customer, body),
            "refund-request": () => requestRefund(db, customer, body),
            "account-delete": () => deleteAccount(db, customer, body),
          };
          const result = await handlers[action]();
          return json(req, { success: true, ...result });
        } catch (e) {
          if (e instanceof PaymentError) {
            return json(req, { success: false, errorCode: e.code, message: e.message }, e.status);
          }
          throw e;
        }
      }
      case "start-info":
      case "start-trial": {
        const customer = await loadCustomer(req);
        if (!customer) return json(req, { success: false, errorCode: "login-required" }, 401);
        if (NEEDS_KAKAO_LOGIN.has(action) && !customer.verified) {
          return json(req, { success: false, errorCode: "verify-required" }, 403);
        }
        if (action === "start-info") return json(req, { success: true, ...(await handleStartInfo(customer)) });
        try {
          return json(req, { success: true, ...(await handleStartTrial(customer, body)) });
        } catch (e) {
          if (e instanceof StartError) {
            return json(req, { success: false, errorCode: e.code, message: e.code }, e.status);
          }
          throw e;
        }
      }
      case "admin-refunds":
      case "admin-refund-decide": {
        const uid = await callerUid(req);
        if (!uid || !(await callerIsAdmin(req))) {
          return json(req, { success: false, error: "Admin access is required" }, 403);
        }
        try {
          const result = action === "admin-refunds" ? await adminRefunds(admin()) : await adminDecideRefund(admin(), uid, body);
          return json(req, { success: true, ...result });
        } catch (e) {
          if (e instanceof PaymentError) {
            return json(req, { success: false, errorCode: e.code, message: e.message }, e.status);
          }
          throw e;
        }
      }
      case "test-send": {
        if (!(await callerIsAdmin(req))) {
          return json(req, { success: false, error: "Admin access is required" }, 403);
        }
        return json(req, { success: true, result: await handleTestSend(body) });
      }
      default:
        return json(req, { success: false, error: `Unknown or missing action: ${String(action)}` }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`daily action "${action}" failed:`, message);
    return json(req, { success: false, error: message }, 500);
  }
});
