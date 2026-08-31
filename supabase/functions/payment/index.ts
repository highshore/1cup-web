// Payment Edge Function — port of Firebase Cloud Functions functions/src/payment.ts
// (Payple payment gateway + Kakao Alimtalk) to a single Supabase Edge Function (Deno).
//
// Original Cloud Function  ->  action / route
// -------------------------------------------------------------------
//   getPaymentWindow        ->  POST { action: "window" }
//   verifyPaymentResult     ->  POST { action: "verify" }
//   cancelSubscription      ->  POST { action: "cancel" }
//   stopNextBilling         ->  POST { action: "stop" }
//   checkReferralCode       ->  POST { action: "check-referral" }
//   generateReferralCode    ->  POST { action: "generate-referral" }
//   processRecurringPayments->  POST { action: "process-recurring" }  (was onSchedule 0 20 * * * KST)
//   paymentCallback         ->  POST/GET  <url>/callback  (public Payple webhook; redirects to frontend)
//   logCredentials          ->  POST { action: "log-credentials" }  (debug only)
//
// Firestore -> Postgres (public.*) via admin() service-role client. Firestore keys were
// camelCase; DB columns are snake_case and are mapped explicitly below. auth().getUser(uid)
// phone/displayName reads are replaced with public.users.phone / public.users.display_name.

import { preflight, json } from "../_shared/cors.ts";
import {
  admin,
  callerUid,
  hasServiceRoleAuthorization,
  recordSchedulerHeartbeat,
} from "../_shared/db.ts";
import { sendKakaoMessages, krPhone } from "../_shared/kakao.ts";

// -------------------------------------------------------------------
// Payple configuration — credentials come from Edge Function secrets ONLY.
// (`supabase secrets set PAYPLE_CST_ID=… PAYPLE_CUST_KEY=… PAYPLE_CLIENT_KEY=…
//   PAYPLE_REFUND_KEY=…`). Never inline them here: this file is committed.
// -------------------------------------------------------------------
function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required Edge Function secret: ${name}`);
  return v;
}

const PAYPLE_CST_ID = requiredEnv("PAYPLE_CST_ID");
const PAYPLE_CUST_KEY = requiredEnv("PAYPLE_CUST_KEY");
const PAYPLE_CLIENT_KEY = requiredEnv("PAYPLE_CLIENT_KEY");
// Payple environment. Live is cpay.payple.kr; the sandbox is democpay.payple.kr
// (cst_id=test / custKey=abcd1234567890 — see docs.payple.kr/preparation/domestic-payment).
// Every Payple endpoint is derived from this one value so the sandbox can never be
// half-configured: auth on demo but the cancel API still hitting live.
const PAYPLE_HOST = (
  Deno.env.get("PAYPLE_HOST") || "https://cpay.payple.kr"
).replace(/\/+$/, "");
const PAYPLE_AUTH_URL =
  Deno.env.get("PAYPLE_AUTH_URL") || `${PAYPLE_HOST}/php/auth.php`;
const PAYPLE_HOSTNAME =
  Deno.env.get("PAYPLE_HOSTNAME") || "https://1cupenglish.com";
const PAYPLE_REMOTE_HOSTNAME =
  Deno.env.get("PAYPLE_REMOTE_HOSTNAME") || "https://1cupenglish.com";
// Where the Payple webhook sends the browser after a payment. Separate from
// PAYPLE_HOSTNAME (which is the referer Payple validates) so a sandbox run can land
// on a Vercel preview while the referer stays the registered domain.
const PAYPLE_FRONTEND_URL = (
  Deno.env.get("PAYPLE_FRONTEND_URL") || PAYPLE_HOSTNAME
).replace(/\/+$/, "");
const PAYPLE_REFUND_KEY = requiredEnv("PAYPLE_REFUND_KEY");

// Subscription price in KRW. Only a fallback: the real amount comes from
// payment_orders.amount. Must match BASE_PRICE in app/payment/PaymentClient.tsx
// (it was 9900 here vs 9700 there, so an order-lookup miss overcharged by 200).
const SUBSCRIPTION_PRICE = 9700;
type MembershipLocation = "yeouido" | "anam";

// How far back a renewal will reach. The window used to be a single calendar day, so a
// run that was blocked — as it was on 24 and 25 August — left those members behind
// permanently: the next day looked at the next day only, and they were never seen again.
// Reaching back means an outage is caught up automatically on the next successful run.
// Bounded rather than unlimited so that a data problem surfaces as an unbilled member a
// human notices, not as a surprise charge on a year-old record.
const RENEWAL_LOOKBACK_DAYS = 14;

// A card that fails should not end a membership the same day. Two attempts a day for
// three days is six chances before service stops. Members who asked to stop billing are
// not given the grace — no charge is expected for them, so their membership simply ends
// when the period does.
const RENEWAL_GRACE_DAYS = 3;

// -------------------------------------------------------------------
// Small helpers
// -------------------------------------------------------------------
function logInfo(msg: string, extra?: unknown) {
  if (extra !== undefined) console.log(msg, JSON.stringify(extra));
  else console.log(msg);
}
function logWarn(msg: string, extra?: unknown) {
  if (extra !== undefined) console.warn(msg, JSON.stringify(extra));
  else console.warn(msg);
}
function logError(msg: string, extra?: unknown) {
  if (extra !== undefined) console.error(msg, extra);
  else console.error(msg);
}

function getSelectedLocation(value: unknown): MembershipLocation {
  if (!value || typeof value !== "object") {
    throw new ApiError("A membership location is required", 400, "invalid-argument");
  }

  const location = (value as Record<string, unknown>).region;
  if (location === "yeouido" || location === "anam") return location;

  throw new ApiError("Choose either Yeouido or Anam", 400, "invalid-argument");
}

// A thrown error carrying an HTTP-ish status + client message (mirrors HttpsError).
class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "internal") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Generate a stable numeric-only payer number from a string source (e.g. userId).
// Payple requires PCD_PAYER_NO to be numeric-only. Uses SHA-256 -> byte mod 10 digits.
async function generateNumericPayerNo(
  source: string,
  desiredLength = 12,
): Promise<string> {
  try {
    const data = new TextEncoder().encode(source);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    let digits = "";
    for (let i = 0; i < digest.length && digits.length < desiredLength; i++) {
      digits += (digest[i] % 10).toString();
    }
    if (digits.length < desiredLength) {
      const fallback = Date.now().toString();
      digits += fallback
        .slice(-(desiredLength - digits.length))
        .padStart(desiredLength - digits.length, "0");
    }
    return digits;
  } catch (_e) {
    return Date.now().toString().slice(-desiredLength);
  }
}

// Payple's documented caps on the fields we fill. Exceeding one is rejected in the
// payment window, where we have no server-side visibility, so check before sending and
// say so in the log rather than waiting for a member to report the error code.
const PAYPLE_FIELD_LIMITS: Record<string, number> = {
  PCD_PAYER_NO: 18,
  PCD_PAYER_NAME: 20,
  PCD_PAYER_EMAIL: 50,
  PCD_PAYER_HP: 20,
  PCD_PAY_GOODS: 50,
  PCD_PAY_OID: 30,
};

// Logs the shape of what we are about to send — lengths, never the values, since this
// object carries a member's name, email and phone. Returns the violations so the caller
// can persist them alongside the order.
function auditPaypleParams(params: Record<string, unknown>): string[] {
  const violations: string[] = [];
  const shape: Record<string, number> = {};
  for (const [key, limit] of Object.entries(PAYPLE_FIELD_LIMITS)) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    const length = String(value).length;
    shape[key] = length;
    if (length > limit) violations.push(`${key}=${length}>${limit}`);
  }
  if (violations.length > 0) {
    logError("Payple field limit exceeded before send:", { violations, shape });
  } else {
    logInfo("Payple outbound param lengths:", shape);
  }
  return violations;
}

// Writes a window/verify-stage failure onto the order so it is queryable. Every failure
// before this went to the function log and nowhere else, which left `pending_auth` rows
// that could equally mean "abandoned", "card declined" or "rejected by Payple".
async function recordOrderFailure(
  orderNumber: string | undefined,
  userId: string,
  errorCode: string,
  errorMessage: string,
  response?: Record<string, unknown>,
): Promise<void> {
  logError("Payment failure recorded:", {
    orderNumber,
    userId,
    errorCode,
    errorMessage,
  });
  if (!orderNumber) return;
  try {
    const a = admin();
    await a
      .from("payment_orders")
      .update({
        status: "failed",
        error_code: errorCode,
        error_message: errorMessage,
        payple_response: response ?? null,
        failed_at: new Date().toISOString(),
      })
      .eq("order_number", orderNumber);
  } catch (e) {
    // Never let bookkeeping mask the original failure.
    logError("Could not persist payment failure:", e);
  }
}

// date-fns `format` replacement for the two patterns actually used.
function formatYyyyMMdd(d: Date): string {
  const y = d.getFullYear().toString();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}${m}${day}`;
}
function formatKoreanDate(d: Date): string {
  const y = d.getFullYear().toString();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}년 ${m}월 ${day}일`;
}

// -------------------------------------------------------------------
// Payple Auth Token
// -------------------------------------------------------------------
interface PaypleAuthResponse {
  result: string;
  auth_data?: unknown;
  PCD_PAY_HOST?: string;
  PCD_PAY_URL?: string;
  cst_id?: string;
  custKey?: string;
  AuthKey?: string;
  return_url?: string;
  result_msg?: string;
}

async function getPaypleAuthToken(isCancel = false): Promise<PaypleAuthResponse> {
  const requestData = {
    cst_id: PAYPLE_CST_ID,
    custKey: PAYPLE_CUST_KEY,
    PCD_PAY_TYPE: "card",
    PCD_SIMPLE_FLAG: "Y",
    PCD_PAY_WORK: "CERT",
    PCD_PAYCANCEL_FLAG: isCancel ? "Y" : "N",
  };

  logInfo("Payple auth request details:", {
    url: PAYPLE_AUTH_URL,
    referer: PAYPLE_HOSTNAME,
    cst_id: PAYPLE_CST_ID,
    cst_id_length: PAYPLE_CST_ID?.length || 0,
    custKey_length: PAYPLE_CUST_KEY?.length || 0,
  });

  const res = await fetch(PAYPLE_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      referer: PAYPLE_HOSTNAME,
    },
    body: JSON.stringify(requestData),
  });

  const data = (await res.json()) as PaypleAuthResponse;
  logInfo("Payple auth response:", data);

  if (!data.PCD_PAY_URL) {
    logWarn("Payple auth response missing PCD_PAY_URL - using default URL");
  } else {
    logInfo("Payment URL from auth response:", data.PCD_PAY_URL);
  }

  if (data.result !== "success") {
    logError("Payple auth failed with error:", {
      result: data.result,
      message: data.result_msg || "No error message provided",
      data: JSON.stringify(data),
    });
    throw new Error("Payple authentication failed: " + JSON.stringify(data));
  }

  return data;
}

// Build the Payple simple-pay URL from an auth response, with fallback.
function buildPaymentUrl(authResponse: PaypleAuthResponse): string {
  if (authResponse.PCD_PAY_HOST && authResponse.PCD_PAY_URL) {
    const url = `${authResponse.PCD_PAY_HOST}${authResponse.PCD_PAY_URL}`;
    logInfo(`Using payment URL from auth response: ${url}`);
    return url;
  }
  const fallback = `${PAYPLE_HOST}/php/SimplePayCardAct.php?ACT_=PAYM`;
  logInfo(`Using default payment URL: ${fallback}`);
  return fallback;
}

// -------------------------------------------------------------------
// DB helpers (public.users read replacing admin.auth().getUser)
// -------------------------------------------------------------------
async function getUserRow(uid: string) {
  const a = admin();
  const { data, error } = await a.from("users").select("*").eq("uid", uid).maybeSingle();
  if (error) throw new ApiError(error.message, 500, "internal");
  return data as Record<string, unknown> | null;
}

// -------------------------------------------------------------------
// getPaymentWindow  ->  action "window"
// -------------------------------------------------------------------
async function getPaymentWindow(uid: string, body: Record<string, unknown>) {
  logInfo("getPaymentWindow called with data:", body);

  const userId = (body.userId as string) || uid;
  const userEmail = (body.userEmail as string) || "";
  const userName = (body.userName as string) || "";
  const userPhone = (body.userPhone as string) || "";
  const pcd_amount = body.pcd_amount as number;
  const pcd_good_name = (body.pcd_good_name as string) || "";
  const selected_categories = body.selected_categories ?? {};
  const location = getSelectedLocation(selected_categories);
  const referralCode = body.referralCode as string | undefined;

  if (!userId) throw new ApiError("User ID is required", 400, "invalid-argument");

  let email = "";
  if (userEmail && userEmail.trim() !== "") email = userEmail.trim();

  if (userId !== uid) {
    logWarn(`userId mismatch: data=${userId}, auth=${uid}. Using auth uid.`);
  }

  const userData = await getUserRow(uid);
  if (!userData) throw new ApiError("User not found", 404, "not-found");

  if (userData.has_active_subscription) {
    throw new ApiError(
      "User already has an active subscription",
      409,
      "already-exists",
    );
  }

  // Resolve phone/displayName. Original preferred request data, then Auth, then Firestore.
  // Here Auth is replaced by public.users.phone / public.users.display_name.
  // The DB number is authoritative: the client used to send only the last 8 digits, and
  // every branch below then truncated to 8 as well, so PCD_PAYER_HP was never a number
  // the SMS step could reach. Take the first candidate that is a whole KR mobile.
  const dbName = ((userData.display_name as string) || "").trim();
  const displayName = userName.trim() || dbName || "구독자";

  const isKrMobile = (v: string) => /^01\d{8,9}$/.test(v);
  const payerPhoneNumber =
    [krPhone((userData.phone as string) || ""), userPhone.replace(/\D/g, "")].find(
      isKrMobile,
    ) ?? "";

  if (!payerPhoneNumber) {
    // Kakao does not always release a phone number, so some members genuinely have none.
    // Send nothing and let Payple collect it — the timestamp this used to invent was a
    // number that could never receive the auth SMS.
    logWarn(`No usable phone for user ${uid}; leaving PCD_PAYER_HP empty.`);
  }

  // Validate referral code (amount comes from the frontend-calculated price).
  const finalAmount = pcd_amount;
  let appliedReferralCode: string | null = null;

  if (referralCode) {
    try {
      const a = admin();
      const { data: refData } = await a
        .from("referral_codes")
        .select("discount, type, active, referrer")
        .eq("code", referralCode)
        .maybeSingle();
      if (refData) {
        if (refData.active) {
          if (refData.referrer && refData.referrer === uid) {
            logWarn(
              `Self-referral detected for user ${uid}. Ignoring referral code ${referralCode}.`,
            );
          } else {
            appliedReferralCode = referralCode;
            logInfo(
              `Referral code ${referralCode} validated. Using client-calculated amount: ${finalAmount}`,
            );
          }
        } else {
          logWarn(`Referral code ${referralCode} exists but is inactive.`);
        }
      } else {
        logWarn(`Referral code ${referralCode} not found.`);
      }
    } catch (e) {
      logError("Error checking referral code", e);
    }
  }

  const orderDate = new Date();
  const orderMonth = (orderDate.getMonth() + 1).toString().padStart(2, "0");
  const orderDay = orderDate.getDate().toString().padStart(2, "0");
  const orderNumber = `OCE${orderDate.getFullYear()}${orderMonth}${orderDay}${Math.floor(
    Math.random() * 1000000,
  )
    .toString()
    .padStart(6, "0")}`;

  const paymentParams = {
    clientKey: PAYPLE_CLIENT_KEY,
    PCD_PAY_TYPE: "card",
    PCD_PAY_WORK: "CERT",
    PCD_CARD_VER: "01",
    PCD_PAY_GOODS: pcd_good_name || "영어 한잔 멤버십",
    PCD_PAY_TOTAL: finalAmount,
    PCD_REGULER_FLAG: "Y",
    PCD_SIMPLE_FLAG: "Y",
    PCD_PAY_OID: orderNumber,
    PCD_PAY_YEAR: orderDate.getFullYear().toString(),
    PCD_PAY_MONTH: orderMonth,
    // Payple caps PCD_PAYER_NO at 18 numeric characters (error cpc0034). uid is a
    // 28-char Firebase id for migrated members and a 36-char UUID for everyone who
    // signed up on Supabase, so this used to ship the raw id and blow the limit. Same
    // derivation the recurring charge already uses, so both agree on the member number.
    PCD_PAYER_NO: await generateNumericPayerNo(uid),
    PCD_PAYER_NAME: displayName,
    PCD_PAYER_EMAIL: email,
    PCD_PAYER_HP: payerPhoneNumber,
    // Server-side callback endpoint (this Edge Function's /callback route).
    PCD_RST_URL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment/callback`,
    PCD_PAYER_AUTHTYPE: "sms",
    PCD_USER_DEFINE1: uid,
    PCD_SIMPLE_FNAME: "payment-result",
    PCD_USER_DEFINE2: JSON.stringify({ ...(selected_categories as Record<string, unknown>), region: location }),
  };

  const limitViolations = auditPaypleParams(paymentParams);

  // Store the order (status pending_auth). Firestore->Postgres field mapping applied.
  const a = admin();
  const { error: insErr } = await a.from("payment_orders").insert({
    order_number: orderNumber,
    user_id: uid,
    amount: finalAmount,
    referral_code: appliedReferralCode,
    order_date: orderDate.toISOString(),
    status: "pending_auth",
    type: "subscription_init",
    payple_params_attempted: paymentParams,
    selected_categories: { ...(selected_categories as Record<string, unknown>), region: location },
    // Recorded even though the window has not opened yet: if Payple rejects the
    // parameters there is no callback, so this is the only trace that would exist.
    error_code: limitViolations.length > 0 ? "param_limit_exceeded" : null,
    error_message:
      limitViolations.length > 0 ? limitViolations.join(", ") : null,
  });
  if (insErr) throw new ApiError(insErr.message, 500, "internal");

  logInfo(`Payment window parameters prepared for user ${uid}`);
  return { success: true, paymentParams };
}

// -------------------------------------------------------------------
// reportPaymentFailure  ->  action "report-failure"
// -------------------------------------------------------------------
// Payple validates the parameters before the window opens, and that rejection never
// reaches PaypleCpayCallback — which is why nine failed attempts left no reason behind
// anywhere. The browser calls this so the order carries what the member actually saw.
async function reportPaymentFailure(uid: string, body: Record<string, unknown>) {
  const orderNumber = body.orderNumber as string | undefined;
  const stage = (body.stage as string) || "unknown";
  const errorCode = (body.errorCode as string) || "client_reported";
  const errorMessage = (body.errorMessage as string) || "결제창에서 오류가 발생했습니다.";
  const response = (body.response as Record<string, unknown>) ?? undefined;

  await recordOrderFailure(
    orderNumber,
    uid,
    errorCode,
    `[${stage}] ${errorMessage}`,
    response,
  );
  return { success: true };
}

// -------------------------------------------------------------------
// verifyPaymentResult  ->  action "verify"
// -------------------------------------------------------------------
async function verifyPaymentResult(uid: string, body: Record<string, unknown>) {
  try {
    const userId = (body.userId as string) || uid;
    const paymentParams = body.paymentParams as Record<string, any> | undefined;

    if (!userId || !paymentParams) {
      throw new ApiError(
        "Invalid payment verification request",
        400,
        "invalid-argument",
      );
    }

    logInfo("Payment verification params:", paymentParams);

    if (!paymentParams.PCD_PAY_RST) {
      throw new ApiError(
        "Payment result information is incomplete",
        400,
        "invalid-argument",
      );
    }

    const isBillingKeyResponse =
      paymentParams.PCD_PAY_WORK === "CERT" ||
      (paymentParams.PCD_PAY_TYPE === "card" &&
        paymentParams.PCD_CARD_VER === "01" &&
        !paymentParams.PCD_PAY_GOODS);
    logInfo("Verification request type:", {
      isBillingKeyResponse,
      PCD_PAY_WORK: paymentParams.PCD_PAY_WORK,
      PCD_PAY_TYPE: paymentParams.PCD_PAY_TYPE,
      PCD_CARD_VER: paymentParams.PCD_CARD_VER,
    });

    if (paymentParams.PCD_PAY_RST !== "success") {
      const errorCode = paymentParams.PCD_PAY_CODE || "unknown";
      const errorMsg = paymentParams.PCD_PAY_MSG || "Unknown error";
      // Used to log and throw, so the order stayed `pending_auth` and the reason lived
      // only in the function log. Put it on the row.
      await recordOrderFailure(
        paymentParams.PCD_PAY_OID as string | undefined,
        userId,
        errorCode,
        errorMsg,
        paymentParams,
      );
      throw new ApiError(
        `Payment failed: ${errorMsg} (Code: ${errorCode})`,
        400,
        "aborted",
      );
    }

    const billingKey =
      paymentParams.PCD_PAYER_ID || paymentParams.PCD_CARD_BILLKEY || "";
    if (!billingKey) {
      throw new ApiError(
        "결제 정보에 빌링키가 없습니다. 다시 시도해주세요.",
        500,
        "internal",
      );
    }

    const paymentOrderId = paymentParams.PCD_PAY_OID || "";
    logInfo("Payment details from Payple:", {
      billingKey,
      paymentOrderId,
      payerName: paymentParams.PCD_PAYER_NAME || "",
      payerEmail: paymentParams.PCD_PAYER_EMAIL || "",
      paymentTotal: paymentParams.PCD_PAY_TOTAL || "",
      paymentCardName: paymentParams.PCD_PAY_CARDNAME || "",
      paymentTime: paymentParams.PCD_PAY_TIME || "",
    });

    // --- Fetch original order for dynamic amount/categories/referrer ---
    let originalAmount = SUBSCRIPTION_PRICE;
    let selectedCategories: { [key: string]: boolean } = {};
    let location: MembershipLocation | null = null;
    let productName = "영어 한잔 멤버십 (정기결제)";
    let referrerUid: string | null = null;

    const a = admin();
    if (paymentOrderId) {
      try {
        const { data: orderData } = await a
          .from("payment_orders")
          .select("amount, selected_categories, referral_code")
          .eq("order_number", paymentOrderId)
          .maybeSingle();

        if (!orderData) {
          logError(
            `Original payment order ${paymentOrderId} not found! Falling back to default amount/name.`,
          );
        } else {
          if (orderData.amount && Number(orderData.amount) > 0) {
            originalAmount = Number(orderData.amount);
          } else {
            logWarn(
              `Original order ${paymentOrderId} has invalid amount: ${orderData.amount}. Falling back to default.`,
            );
          }
          if (orderData.selected_categories) {
            selectedCategories = orderData.selected_categories as {
              [key: string]: boolean;
            };
            location = getSelectedLocation(orderData.selected_categories);
            const nameParts: string[] = [];
            if (selectedCategories.tech) nameParts.push("테크");
            if (selectedCategories.business) nameParts.push("비즈니스");
            if (selectedCategories.meetup) nameParts.push("밋업");
            if (nameParts.length > 0) {
              productName = `영어 한잔 멤버십 (${nameParts.join(" + ")})`;
            }
          } else {
            logWarn(`Original order ${paymentOrderId} missing selectedCategories.`);
          }
          if (orderData.referral_code) {
            const { data: refRow } = await a
              .from("referral_codes")
              .select("referrer")
              .eq("code", orderData.referral_code)
              .maybeSingle();
            if (refRow?.referrer) referrerUid = refRow.referrer as string;
          }
        }
      } catch (fetchError) {
        logError(`Error fetching original order ${paymentOrderId}:`, fetchError);
      }
    }

    if (!location) {
      throw new ApiError(
        "The payment order does not include a membership location",
        400,
        "invalid-argument",
      );
    }

    // --- Make the actual first payment using the billing key ---
    try {
      const authResponse = await getPaypleAuthToken();

      const orderDate = new Date();
      const orderMonth = (orderDate.getMonth() + 1).toString().padStart(2, "0");
      const orderDay = orderDate.getDate().toString().padStart(2, "0");
      const orderNumber = `OCEPAY${orderDate.getFullYear()}${orderMonth}${orderDay}${Math.floor(
        Math.random() * 1000000,
      )
        .toString()
        .padStart(6, "0")}`;

      const paymentRequest = {
        PCD_CST_ID: authResponse.cst_id,
        PCD_CUST_KEY: authResponse.custKey,
        PCD_AUTH_KEY: authResponse.AuthKey,
        PCD_PAY_TYPE: "card",
        PCD_PAYER_ID: billingKey,
        PCD_PAY_GOODS: productName,
        PCD_SIMPLE_FLAG: "Y",
        PCD_PAY_TOTAL: originalAmount,
        PCD_PAY_OID: orderNumber,
        // Derived, not echoed: whatever comes back in the callback is only as valid as
        // what we sent, and a timestamp fallback would not match the CERT registration.
        PCD_PAYER_NO: await generateNumericPayerNo(uid),
        PCD_PAY_YEAR: new Date().getFullYear().toString(),
        PCD_PAY_MONTH: (new Date().getMonth() + 1).toString().padStart(2, "0"),
        PCD_PAY_ISTAX: "Y",
        PCD_PAY_TAXTOTAL: Math.floor(originalAmount / 11).toString(),
      };

      logInfo("Making initial payment with billing key:", {
        billingKey,
        orderNumber,
        amount: originalAmount,
      });

      const paymentURL = buildPaymentUrl(authResponse);
      logInfo("Making payment request to URL:", paymentURL);

      const payRes = await fetch(paymentURL, {
        method: "POST",
        headers: { "Content-Type": "application/json", referer: PAYPLE_HOSTNAME },
        body: JSON.stringify(paymentRequest),
      });
      const payData = await payRes.json();
      logInfo("Initial payment response:", payData);

      if (payData.PCD_PAY_RST === "success") {
        // Log successful initial payment.
        await a.from("payment_orders").insert({
          order_number: orderNumber,
          user_id: userId,
          amount: payData.PCD_PAY_TOTAL || originalAmount,
          status: "completed",
          type: "subscription_initial_payment",
          payment_result: payData,
          payple_response: payData,
          billing_key_used: billingKey,
          payment_method: "card",
          completed_at: new Date().toISOString(),
          related_auth_order: paymentOrderId || null,
        });

        // Update user subscription status.
        const subscriptionStartDate = new Date();
        const subscriptionEndDate = new Date(subscriptionStartDate);
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

        await a
          .from("users")
          .update({
            has_active_subscription: true,
            subscription_start_date: subscriptionStartDate.toISOString(),
            subscription_end_date: subscriptionEndDate.toISOString(),
            billing_key: billingKey,
            payment_method: "card",
            plan_price: originalAmount,
            cat_tech: selectedCategories.tech ?? false,
            cat_business: selectedCategories.business ?? false,
            location,
          })
          .eq("uid", userId);

        // Referral reward: set referrer plan_price to 4700 (only if unset/higher).
        if (referrerUid) {
          try {
            const { data: refUser } = await a
              .from("users")
              .select("plan_price")
              .eq("uid", referrerUid)
              .maybeSingle();
            if (refUser) {
              const currentPlanPrice = Number(refUser.plan_price || 0);
              const TARGET_PRICE = 4700;
              if (!currentPlanPrice || currentPlanPrice > TARGET_PRICE) {
                await a
                  .from("users")
                  .update({ plan_price: TARGET_PRICE })
                  .eq("uid", referrerUid);
                logInfo(
                  `Applied referral reward to referrer ${referrerUid} (plan_price set to ${TARGET_PRICE})`,
                );
              } else {
                logInfo(
                  `Referrer ${referrerUid} already at plan_price ${currentPlanPrice}, no change.`,
                );
              }
            }
          } catch (refRewardError) {
            logError(
              `Failed to apply referral reward to referrer ${referrerUid}:`,
              refRewardError,
            );
          }
        }

        logInfo("User subscription activated:", { userId });

        // Kakao 'order-received' notification (phone and name from public.users).
        try {
          const userRow = await getUserRow(userId);
          const recipientNo = krPhone(userRow?.phone as string | undefined);
          // The approved template reads "#{customer-name} 님", and this passed the
          // literal "고객" — so every member who ever paid was greeted as "고객 님", with
          // the gap in the middle looking like a substitution that had failed. It had
          // not: the variable was being filled, just with a constant. The name is on the
          // row already, and the same value is what send-article has always used.
          //
          // The bare name goes in, not "이름님": the 님 belongs to the template, and
          // Kakao would have to re-approve it to change that. 129 of 134 members have a
          // name, the longest is 10 characters, so nothing here risks the field limit.
          const customerName =
            ((userRow?.display_name as string) ?? "").trim() || "고객";
          if (recipientNo.startsWith("010") && recipientNo.length >= 10) {
            await sendKakaoMessages(
              [
                {
                  recipientNo,
                  templateParameter: {
                    "customer-name": customerName,
                    link: "https://1cupenglish.com/guide",
                  },
                },
              ],
              "order-received",
            );
            logInfo(`Kakao message 'order-received' sent to user ${userId} at ${recipientNo}`);
          } else {
            logWarn(
              `User ${userId} has an invalid phone number for Kakao: ${recipientNo}. Skipping Kakao message.`,
            );
          }
        } catch (kakaoError) {
          logError(`Failed to send Kakao message to user ${userId}:`, kakaoError);
        }

        return {
          success: true,
          message: "결제가 성공적으로 완료되었습니다.",
          data: payData,
        };
      } else {
        // Log failed initial payment.
        await a.from("payment_orders").insert({
          order_number: orderNumber,
          user_id: userId,
          amount: originalAmount,
          status: "failed",
          type: "subscription_initial_payment",
          error_code: payData.PCD_PAY_CODE || "unknown",
          error_message: payData.PCD_PAY_MSG || "알 수 없는 오류",
          payment_result: payData,
          payple_response: payData,
          billing_key_used: billingKey,
          failed_at: new Date().toISOString(),
          related_auth_order: paymentOrderId || null,
        });

        throw new ApiError(
          `결제 실패: ${payData.PCD_PAY_MSG || "알 수 없는 오류"} (코드: ${
            payData.PCD_PAY_CODE || "unknown"
          })`,
          400,
          "aborted",
        );
      }
    } catch (paymentError) {
      if (paymentError instanceof ApiError) throw paymentError;
      logError("Error making initial payment with billing key:", paymentError);
      throw new ApiError(
        "빌링키 결제 중 오류가 발생했습니다: " +
          (paymentError instanceof Error
            ? paymentError.message
            : String(paymentError)),
        500,
        "internal",
      );
    }
  } catch (error) {
    // Original returned a soft failure object (not thrown) at the top level.
    logError("Error verifying payment:", error);
    const err = error as ApiError;
    return {
      success: false,
      message: err.message || "Payment verification failed",
      errorCode: err.code || "unknown_error",
    };
  }
}

// -------------------------------------------------------------------
// processRecurringPayments  ->  action "process-recurring"  (was onSchedule)
// -------------------------------------------------------------------
async function processRecurringPayments() {
  const a = admin();
  const nowUtc = new Date();
  logInfo(`Running recurring payments job (UTC now): ${nowUtc.toISOString()}`);

  // KST (UTC+9) day window computed robustly from UTC.
  //
  // kstNow is a shifted instant, useful only for reading off KST calendar parts with
  // getUTC*. It is nine hours in the future and must never be compared against a stored
  // timestamp: doing so is what ended two memberships early. Compare against
  // kstStartOfDay or kstEndOfDay, which are real instants.
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(nowUtc.getTime() + KST_OFFSET_MS);
  const kstYear = kstNow.getUTCFullYear();
  const kstMonth = kstNow.getUTCMonth();
  const kstDate = kstNow.getUTCDate();
  const startOfKstDayUtcMs =
    Date.UTC(kstYear, kstMonth, kstDate, 0, 0, 0, 0) - KST_OFFSET_MS;
  const kstStartOfDay = new Date(startOfKstDayUtcMs);
  const kstEndOfDay = new Date(startOfKstDayUtcMs + 24 * 60 * 60 * 1000 - 1);

  logInfo(
    `KST day window computed: start=${kstStartOfDay.toISOString()}, end=${kstEndOfDay.toISOString()}`,
  );

  try {
    // Due today, or overdue and still inside the lookback. Anyone missed by a failed run
    // is picked up here rather than being stranded by a window that only ever looked at
    // the current day.
    const lookbackStart = new Date(
      kstStartOfDay.getTime() - RENEWAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    const { data: usersToRenew, error: selErr } = await a
      .from("users")
      .select("*")
      .eq("has_active_subscription", true)
      .gte("subscription_end_date", lookbackStart.toISOString())
      .lte("subscription_end_date", kstEndOfDay.toISOString());
    if (selErr) throw new Error(selErr.message);

    // A charge and the subscription_end_date that retires it are two writes. If the card
    // is charged and the second write does not land, the member still matches the query
    // above and a later run bills them again. Membership of today's completed recurring
    // orders is the record that survives that gap, so consult it before charging.
    //
    // This is what makes a second attempt on the same day safe, and the reason billing
    // can now retry at all.
    const { data: chargedToday, error: chargedErr } = await a
      .from("payment_orders")
      .select("user_id")
      .eq("type", "subscription_recurring")
      .eq("status", "completed")
      .gte("completed_at", kstStartOfDay.toISOString())
      .lte("completed_at", kstEndOfDay.toISOString());
    if (chargedErr) throw new Error(chargedErr.message);
    const alreadyCharged = new Set(
      (chargedToday ?? []).map((o) => o.user_id as string),
    );

    const all = usersToRenew ?? [];
    const list = all.filter((u) => !alreadyCharged.has(u.uid as string));
    if (all.length !== list.length) {
      logInfo(
        `Skipping ${all.length - list.length} member(s) already charged today`,
      );
    }
    logInfo(`Found ${list.length} subscriptions to renew`);

    for (const userData of list) {
      const userId = userData.uid as string;

      // Renewal gating:
      //  - account_status === 'admin' => always bill
      //  - account_status === 'leader' OR gdg_member === true => skip
      //  - else => bill
      const accountStatus = userData.account_status as string | undefined;
      const isGdgMember = Boolean(userData.gdg_member);

      if (accountStatus === "admin") {
        logInfo(`User ${userId} is admin - proceeding with renewal billing.`);
      } else if (accountStatus === "leader" || isGdgMember === true) {
        logInfo(
          `Skipping renewal for user ${userId} - account_status='${
            accountStatus || "undefined"
          }', gdg_member=${isGdgMember}`,
        );
        continue;
      } else {
        logInfo(
          `User ${userId} meets renewal criteria (account_status='${
            accountStatus || "undefined"
          }', gdg_member=${isGdgMember}). Proceeding.`,
        );
      }

      if (!userData.billing_key) {
        logWarn(`User ${userId} has no billing key. Skipping renewal attempt.`);
        continue;
      }
      if (userData.billing_cancelled) {
        logWarn(
          `User ${userId} has billingCancelled=true. Skipping renewal attempt.`,
        );
        continue;
      }

      try {
        const authResponse = await getPaypleAuthToken();

        const orderDate = new Date();
        const orderMonth = (orderDate.getMonth() + 1).toString().padStart(2, "0");
        const orderDay = orderDate.getDate().toString().padStart(2, "0");
        const orderNumber = `OCEREC${orderDate.getFullYear()}${orderMonth}${orderDay}${Math.floor(
          Math.random() * 1000000,
        )
          .toString()
          .padStart(6, "0")}`;

        // Price and product name (plan-based). plan_price default 4700 when unset/<=0.
        const planName = "Standard";
        const planPriceRaw = Number(userData.plan_price);
        const userSpecificPrice =
          Number.isFinite(planPriceRaw) && planPriceRaw > 0 ? planPriceRaw : 4700;
        const productName = `One Cup English (${planName}) 멤버십 (정기결제)`;
        logInfo(
          `Renewal (plan-based) for user ${userId}: Plan='${planName}', Price=${userSpecificPrice}`,
        );

        const paymentRequest = {
          PCD_CST_ID: authResponse.cst_id,
          PCD_CUST_KEY: authResponse.custKey,
          PCD_AUTH_KEY: authResponse.AuthKey,
          PCD_PAY_TYPE: "card",
          PCD_PAYER_ID: userData.billing_key,
          PCD_PAY_GOODS: productName,
          PCD_SIMPLE_FLAG: "Y",
          PCD_PAY_TOTAL: userSpecificPrice,
          PCD_PAY_OID: orderNumber,
          PCD_PAYER_NO: await generateNumericPayerNo(userId),
          PCD_PAY_YEAR: new Date().getFullYear().toString(),
          PCD_PAY_MONTH: (new Date().getMonth() + 1).toString().padStart(2, "0"),
          PCD_PAY_ISTAX: "Y",
          PCD_PAY_TAXTOTAL: Math.floor(userSpecificPrice / 11).toString(),
        };

        const paymentURL = buildPaymentUrl(authResponse);
        logInfo("Making recurring payment request to URL:", paymentURL);

        const payRes = await fetch(paymentURL, {
          method: "POST",
          headers: { "Content-Type": "application/json", referer: PAYPLE_HOSTNAME },
          body: JSON.stringify(paymentRequest),
        });
        const payData = await payRes.json();

        if (payData.PCD_PAY_RST === "success") {
          const newStartDate = new Date();
          const newEndDate = new Date(
            new Date().setMonth(new Date().getMonth() + 1),
          );

          await a.from("payment_orders").insert({
            order_number: orderNumber,
            user_id: userId,
            amount: payData.PCD_PAY_TOTAL || userSpecificPrice,
            order_date: orderDate.toISOString(),
            status: "completed",
            type: "subscription_recurring",
            payment_result: payData,
            payple_response: payData,
            billing_key_used: userData.billing_key,
            payment_method: "card",
            completed_at: new Date().toISOString(),
          });

          await a
            .from("users")
            .update({
              subscription_start_date: newStartDate.toISOString(),
              subscription_end_date: newEndDate.toISOString(),
            })
            .eq("uid", userId);

          logInfo(`Successfully renewed subscription for user ${userId}`);

          // Kakao 'recurring-payment' notification.
          try {
            const recipientNo = krPhone(userData.phone as string | undefined);
            if (recipientNo.startsWith("010") && recipientNo.length >= 10) {
              await sendKakaoMessages([{ recipientNo }], "recurring-payment");
              logInfo(
                `Kakao message 'recurring-payment' sent to user ${userId} at ${recipientNo}`,
              );
            } else {
              logWarn(
                `User ${userId} has an invalid phone number for Kakao: ${recipientNo}. Skipping Kakao message.`,
              );
            }
          } catch (kakaoError) {
            logError(
              `Failed to send 'recurring-payment' Kakao message to user ${userId}:`,
              kakaoError,
            );
          }
        } else {
          const errorCode = payData.PCD_PAY_CODE || "unknown";
          const errorMsg = payData.PCD_PAY_MSG || "알 수 없는 오류";
          logError(`Failed to process recurring payment for user ${userId}:`, {
            code: errorCode,
            message: errorMsg,
          });

          await a.from("payment_orders").insert({
            order_number: orderNumber,
            user_id: userId,
            amount: userSpecificPrice,
            order_date: orderDate.toISOString(),
            status: "failed",
            type: "subscription_recurring",
            payment_result: payData,
            payple_response: payData,
            billing_key_used: userData.billing_key,
            error_code: errorCode,
            error_message: errorMsg,
            failed_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        logError(`Error processing recurring payment for user ${userId}:`, err);
      }
    }

    // End memberships that are genuinely over — but not the ones we simply failed to
    // charge. This sweep used to deactivate anything past its end date in the same run
    // that tried to renew it, so on 26 August it cancelled two members whose renewal the
    // previous day's outage had never even attempted. They lost their membership without
    // ever being asked for money.
    //
    // Two different endings, because they mean different things:
    //   - asked to stop billing: the period ends, so does the membership. Nothing is owed
    //     and nothing is being retried, so there is nothing to wait for.
    //   - still billing: only after the grace period, by which point six attempts have
    //     failed and the card really is the problem.
    try {
      // Only periods that ended on an earlier day. A membership therefore lasts the whole
      // of its final day, which is the promise made to anyone who stops billing and is
      // told they can keep coming until the period runs out.
      //
      // The old comparison used kstNow — nine hours ahead of the real time — so the 14:00
      // run treated anything ending before 23:00 as already over. Members were cut off up
      // to nine hours early, and with meetups at 18:30, 19:00 and 23:15 that is the
      // difference between attending a session they had paid for and being turned away.
      const graceCutoff = new Date(
        kstStartOfDay.getTime() - RENEWAL_GRACE_DAYS * 24 * 60 * 60 * 1000,
      );

      const { data: endedByChoice, error: choiceErr } = await a
        .from("users")
        .select("uid")
        .eq("has_active_subscription", true)
        .eq("billing_cancelled", true)
        .lt("subscription_end_date", kstStartOfDay.toISOString());
      if (choiceErr) throw new Error(choiceErr.message);

      const { data: endedByFailure, error: failErr } = await a
        .from("users")
        .select("uid")
        .eq("has_active_subscription", true)
        .not("billing_cancelled", "is", true)
        .lt("subscription_end_date", graceCutoff.toISOString());
      if (failErr) throw new Error(failErr.message);

      const ids = [
        ...(endedByChoice ?? []).map((r: { uid: string }) => r.uid),
        ...(endedByFailure ?? []).map((r: { uid: string }) => r.uid),
      ];

      if (ids.length > 0) {
        // Named, not counted: a membership ending is worth being able to look up later.
        logInfo(
          `Deactivating ${ids.length} membership(s) — ` +
            `${(endedByChoice ?? []).length} after a requested stop, ` +
            `${(endedByFailure ?? []).length} after ${RENEWAL_GRACE_DAYS} days of failed renewal: ` +
            ids.join(", "),
        );
        await a
          .from("users")
          .update({ has_active_subscription: false })
          .in("uid", ids);
      } else {
        logInfo("No memberships to end at this run");
      }
    } catch (deactivateError) {
      logError("Error deactivating expired subscriptions:", deactivateError);
    }

    logInfo(`Completed subscription renewal process for ${list.length} users`);
    return { success: true, processed: list.length };
  } catch (error) {
    logError("Error in processRecurringPayments:", error);
    return { success: false, message: (error as Error).message };
  }
}

// -------------------------------------------------------------------
// cancelSubscription  ->  action "cancel"
// -------------------------------------------------------------------
async function cancelSubscription(uid: string, body: Record<string, unknown>) {
  const a = admin();
  const userId = uid;
  const cancellationReason = (body.reason as string) || "User requested";

  const userData = await getUserRow(userId);
  if (!userData) throw new ApiError("User not found", 404, "not-found");
  if (!userData.has_active_subscription) {
    throw new ApiError(
      "No active subscription to cancel",
      412,
      "failed-precondition",
    );
  }

  // Find the last successful payment to refund.
  const { data: lastPayments } = await a
    .from("payment_orders")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1);

  if (!lastPayments || lastPayments.length === 0) {
    logError(`No successful payment found for user ${userId} to refund.`);
    throw new ApiError("취소할 결제 내역을 찾을 수 없습니다.", 404, "not-found");
  }

  const lastPaymentData = lastPayments[0];
  const originalOrderId = lastPaymentData.order_number as string;
  const originalPaymentAmount = Number(lastPaymentData.amount);

  if (!originalOrderId || !originalPaymentAmount) {
    logError(
      `Missing critical data from last payment order ${lastPaymentData.order_number} for user ${userId}.`,
    );
    throw new ApiError(
      "마지막 결제 정보가 불완전하여 환불을 진행할 수 없습니다.",
      500,
      "internal",
    );
  }
  logInfo(
    `Found last payment for refund: OrderID=${originalOrderId}, Amount=${originalPaymentAmount}`,
  );

  // Calculate refund amount (full < 7 days, prorated over 30-day month otherwise, 0 floor).
  const completedAt = new Date(lastPaymentData.completed_at as string);
  const today = new Date();
  const timeDiff = today.getTime() - completedAt.getTime();
  const daysPassed = Math.ceil(timeDiff / (1000 * 3600 * 24));

  let refundAmount = 0;
  if (daysPassed < 7) {
    refundAmount = originalPaymentAmount;
    logInfo(
      `User ${userId}: ${daysPassed} days passed. Processing full refund: ${refundAmount}`,
    );
  } else {
    const proratedAmount = Math.round(
      (originalPaymentAmount * (30 - daysPassed)) / 30,
    );
    refundAmount = Math.max(0, proratedAmount);
    logInfo(
      `User ${userId}: ${daysPassed} days passed. Processing prorated refund: ${refundAmount}`,
    );
  }

  if (refundAmount > 0) {
    try {
      const authResponse = await getPaypleAuthToken(true);
      logInfo(`Auth token obtained for cancellation for user ${userId}`);

      // Extract YYYYMMDD from PCD_PAY_TIME in payment_result, fallback to completed_at.
      let payDateFromPaypleTime = "";
      const payplePaymentResult = lastPaymentData.payment_result as
        | Record<string, unknown>
        | null;
      const pcdPayTime = payplePaymentResult?.PCD_PAY_TIME as string | undefined;

      if (pcdPayTime && typeof pcdPayTime === "string" && pcdPayTime.length >= 8) {
        payDateFromPaypleTime = pcdPayTime.substring(0, 8);
        logInfo(
          `Extracted date ${payDateFromPaypleTime} from PCD_PAY_TIME (${pcdPayTime}) for Order ID ${originalOrderId}`,
        );
      } else {
        logError(
          `Could not extract YYYYMMDD date from PCD_PAY_TIME for Order ID: ${originalOrderId}. Falling back to completedAt date.`,
        );
        payDateFromPaypleTime = formatYyyyMMdd(completedAt);
      }

      const refundApiUrl = `${PAYPLE_HOST}/php/account/api/cPayCAct.php`;
      const cancellationRequest = {
        PCD_CST_ID: authResponse.cst_id,
        PCD_CUST_KEY: authResponse.custKey,
        PCD_AUTH_KEY: authResponse.AuthKey,
        PCD_REFUND_KEY: PAYPLE_REFUND_KEY,
        PCD_PAYCANCEL_FLAG: "Y",
        PCD_PAY_OID: originalOrderId,
        PCD_PAY_DATE: payDateFromPaypleTime,
        PCD_REFUND_TOTAL: refundAmount.toString(),
      };

      logInfo(
        `Sending Payple cancellation request with: OID=${cancellationRequest.PCD_PAY_OID}, Date=${cancellationRequest.PCD_PAY_DATE}, Amount=${cancellationRequest.PCD_REFUND_TOTAL}`,
      );

      const cancelRes = await fetch(refundApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          referer: PAYPLE_HOSTNAME,
        },
        body: JSON.stringify(cancellationRequest),
      });
      const cancelData = await cancelRes.json();
      logInfo(`Payple refund response for user ${userId}:`, cancelData);

      if (cancelData?.PCD_PAY_RST !== "success") {
        const errorCode = cancelData?.PCD_PAY_CODE || "unknown";
        const errorMsg =
          cancelData?.PCD_PAY_MSG || "환불 처리 중 페이플 오류 발생";
        logError(
          `Payple refund failed for user ${userId}, OrderID: ${originalOrderId}: ${errorMsg} (Code: ${errorCode})`,
        );
        await a.from("payment_cancellations").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          original_order_id: originalOrderId,
          requested_at: new Date().toISOString(),
          status: "failed",
          refund_amount_attempted: refundAmount,
          reason: cancellationReason,
          payple_error_code: errorCode,
          payple_error_message: errorMsg,
          payple_response: cancelData,
        });
        throw new ApiError(
          `환불 실패: ${errorMsg} (코드: ${errorCode})`,
          400,
          "aborted",
        );
      }

      await a.from("payment_cancellations").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        original_order_id: originalOrderId,
        requested_at: new Date().toISOString(),
        status: "completed",
        refund_amount_processed: refundAmount,
        reason: cancellationReason,
        payple_response: cancelData,
      });
      logInfo(
        `Successfully processed Payple refund for user ${userId}, OrderID: ${originalOrderId}, Amount: ${refundAmount}`,
      );
    } catch (refundError) {
      if (refundError instanceof ApiError) throw refundError;
      logError(`Error during Payple refund process for user ${userId}:`, refundError);
      throw new ApiError(
        "페이플 환불 요청 중 오류 발생: " +
          (refundError instanceof Error ? refundError.message : String(refundError)),
        500,
        "internal",
      );
    }
  } else {
    logInfo(`User ${userId}: Refund amount is 0. Skipping Payple refund call.`);
    try {
      await a.from("payment_cancellations").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        original_order_id: originalOrderId,
        requested_at: new Date().toISOString(),
        status: "completed_no_refund",
        refund_amount_processed: 0,
        reason: cancellationReason,
      });
      logInfo(
        `Successfully logged 'completed_no_refund' to payment_cancellations for order ${originalOrderId}`,
      );
    } catch (logError2) {
      logError(
        `!!! Failed to log 'completed_no_refund' to payment_cancellations for order ${originalOrderId}`,
        logError2,
      );
    }
  }

  // Update user subscription status (only after successful refund or when refund is 0).
  await a
    .from("users")
    .update({
      has_active_subscription: false,
      subscription_end_date: new Date().toISOString(),
      billing_key: null,
      payment_method: null,
      cat_tech: false,
      cat_business: false,
      cancellation_timestamp: new Date().toISOString(),
    })
    .eq("uid", userId);

  logInfo("Subscription cancelled and user updated for user:", userId);

  // Kakao 'membership-cancelled' notification.
  try {
    const recipientNo = krPhone(userData.phone as string | undefined);
    if (recipientNo.startsWith("010") && recipientNo.length >= 10) {
      await sendKakaoMessages(
        [{ recipientNo, templateParameter: {} }],
        "membership-cancelled",
      );
      logInfo(
        `Kakao message 'membership-cancelled' sent to user ${userId} at ${recipientNo}`,
      );
    } else {
      logWarn(
        `User ${userId} has an invalid phone number for Kakao (cancel): ${recipientNo}. Skipping Kakao message.`,
      );
    }
  } catch (kakaoError) {
    logError(
      `Failed to send 'membership-cancelled' Kakao message to user ${userId}:`,
      kakaoError,
    );
  }

  return {
    success: true,
    message: `구독이 성공적으로 취소되었습니다. ${
      refundAmount > 0
        ? `환불 처리된 금액: ${refundAmount.toLocaleString()}원.`
        : "환불 대상 금액이 없습니다."
    }`,
    refundAmount,
  };
}

// -------------------------------------------------------------------
// stopNextBilling  ->  action "stop"
// -------------------------------------------------------------------
async function stopNextBilling(uid: string, body: Record<string, unknown>) {
  const a = admin();
  const userId = uid;
  const cancellationReason =
    (body.reason as string) || "User requested stop billing";

  const userData = await getUserRow(userId);
  if (!userData) throw new ApiError("User not found", 404, "not-found");
  if (!userData.has_active_subscription) {
    throw new ApiError(
      "No active subscription to stop",
      412,
      "failed-precondition",
    );
  }

  const nextBillingDate = userData.subscription_end_date
    ? new Date(userData.subscription_end_date as string)
    : new Date();

  // Keep billing_key intact so the user can easily reactivate; keep subscription_end_date.
  await a
    .from("users")
    .update({
      cancellation_timestamp: new Date().toISOString(),
      cancellation_type: "stop_billing",
      cancellation_reason: cancellationReason,
      billing_cancelled: true,
    })
    .eq("uid", userId);

  await a.from("billing_stops").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    requested_at: new Date().toISOString(),
    original_end_date: nextBillingDate.toISOString(),
    reason: cancellationReason,
    status: "completed",
  });

  logInfo(
    `Billing stopped for user ${userId}. Service will continue until ${nextBillingDate.toISOString()}`,
  );

  // Kakao 'billing-stopped' notification.
  try {
    const recipientNo = krPhone(userData.phone as string | undefined);
    if (recipientNo.startsWith("010") && recipientNo.length >= 10) {
      await sendKakaoMessages(
        [
          {
            recipientNo,
            templateParameter: { endDate: formatKoreanDate(nextBillingDate) },
          },
        ],
        "billing-stopped",
      );
      logInfo(`Kakao message 'billing-stopped' sent to user ${userId} at ${recipientNo}`);
    } else {
      logWarn(
        `User ${userId} has an invalid phone number for Kakao: ${recipientNo}. Skipping Kakao message.`,
      );
    }
  } catch (kakaoError) {
    logError(
      `Failed to send 'billing-stopped' Kakao message to user ${userId}:`,
      kakaoError,
    );
  }

  return {
    success: true,
    message:
      "다음 결제가 성공적으로 중단되었습니다. 현재 구독 기간까지는 서비스를 계속 이용하실 수 있습니다.",
    subscriptionEndDate: nextBillingDate.toISOString(),
  };
}

// -------------------------------------------------------------------
// checkReferralCode  ->  action "check-referral"
// -------------------------------------------------------------------
async function checkReferralCode(body: Record<string, unknown>) {
  const code = body.code as string | undefined;
  if (!code) return { valid: false, message: "코드를 입력해주세요." };

  try {
    const a = admin();
    const { data } = await a
      .from("referral_codes")
      .select("active, discount, type")
      .eq("code", code)
      .maybeSingle();

    if (!data) return { valid: false, message: "유효하지 않은 코드입니다." };
    if (!data.active) return { valid: false, message: "만료된 코드입니다." };

    return {
      valid: true,
      discount: data.discount,
      discountType: data.type || "fixed_price",
      message: "할인 코드가 적용되었습니다.",
      originalPrice: 9700,
    };
  } catch (error) {
    logError("Error checking referral code:", error);
    throw new ApiError("코드 확인 중 오류가 발생했습니다.", 500, "internal");
  }
}

// -------------------------------------------------------------------
// generateReferralCode  ->  action "generate-referral"
// -------------------------------------------------------------------
async function generateReferralCode(uid: string) {
  const a = admin();

  // Return existing code if the user already has one.
  const userRow = await getUserRow(uid);
  if (userRow?.referral_code) {
    return { referralCode: userRow.referral_code };
  }

  const genCode = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  let newCode = "";
  for (let i = 0; i < 10; i++) {
    const candidate = genCode();
    const { data: existing } = await a
      .from("referral_codes")
      .select("code")
      .eq("code", candidate)
      .maybeSingle();
    if (!existing) {
      newCode = candidate;
      break;
    }
  }

  if (!newCode) {
    throw new ApiError("Failed to generate unique referral code", 500, "internal");
  }

  const { error: codeErr } = await a.from("referral_codes").insert({
    code: newCode,
    active: true,
    discount: 33,
    type: "percent",
    referrer: uid,
  });
  if (codeErr) throw new ApiError(codeErr.message, 500, "internal");

  const { error: userErr } = await a
    .from("users")
    .update({
      referral_code: newCode,
      referral_generated_at: new Date().toISOString(),
    })
    .eq("uid", uid);
  if (userErr) throw new ApiError(userErr.message, 500, "internal");

  return { referralCode: newCode };
}

// -------------------------------------------------------------------
// logCredentials  ->  action "log-credentials"  (debug only)
// -------------------------------------------------------------------
function logCredentials() {
  return {
    success: true,
    cst_id_exists: !!PAYPLE_CST_ID,
    cst_id_length: PAYPLE_CST_ID?.length || 0,
    cust_key_exists: !!PAYPLE_CUST_KEY,
    cust_key_length: PAYPLE_CUST_KEY?.length || 0,
    client_key_exists: !!PAYPLE_CLIENT_KEY,
    client_key_length: PAYPLE_CLIENT_KEY?.length || 0,
  };
}

// -------------------------------------------------------------------
// paymentCallback  ->  <url>/callback  (public Payple webhook -> redirect)
// -------------------------------------------------------------------
async function paymentCallback(req: Request): Promise<Response> {
  logInfo("Received payment callback", { method: req.method, url: req.url });

  try {
    // Extract payment data from POST body (form or JSON) or query params.
    let paymentData: Record<string, string> = {};
    const url = new URL(req.url);

    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        paymentData = (await req.json()) as Record<string, string>;
      } else {
        // Payple posts application/x-www-form-urlencoded.
        const form = await req.formData();
        for (const [k, v] of form.entries()) paymentData[k] = String(v);
      }
    } else {
      for (const [k, v] of url.searchParams.entries()) paymentData[k] = v;
    }

    if (!paymentData || Object.keys(paymentData).length === 0) {
      logError("No payment data received in callback");
      return new Response("No payment data received", { status: 400 });
    }

    logInfo("Payment data received:", paymentData);

    const userId = paymentData.PCD_USER_DEFINE1 || "unknown_user";
    const paymentId = paymentData.PCD_PAY_OID || `payment_${Date.now()}`;

    if (paymentData.PCD_PAY_RST === "success") {
      try {
        const billingKey = paymentData.PCD_PAYER_ID;
        if (billingKey && userId !== "unknown_user") {
          const a = admin();
          await a
            .from("users")
            .update({ billing_key: billingKey, payment_method: "card" })
            .eq("uid", userId);
          logInfo(`Updated user ${userId} with billing key ${billingKey}`);

          if (paymentData.PCD_PAY_WORK === "CERT") {
            // Matches original: initial payment is completed by verifyPaymentResult.
            logInfo(
              `Would make initial payment for user ${userId} with billing key ${billingKey}`,
            );
          }
        }
      } catch (processError) {
        logError("Error processing payment:", processError);
      }
    }

    // Redirect to frontend result page with all callback params as query string.
    const redirectParams = new URLSearchParams();
    for (const key of Object.keys(paymentData)) {
      redirectParams.append(key, String(paymentData[key]));
    }
    redirectParams.append("payment_id", paymentId);

    const frontendUrl = `${PAYPLE_FRONTEND_URL}/payment/result?${redirectParams.toString()}`;
    logInfo(`Redirecting to: ${frontendUrl}`);
    return new Response(null, { status: 303, headers: { Location: frontendUrl } });
  } catch (error) {
    logError("Error processing payment callback:", error);
    return new Response("Error processing payment callback", { status: 500 });
  }
}

// -------------------------------------------------------------------
// HTTP entrypoint
// -------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  const url = new URL(req.url);

  // Public Payple webhook — no auth, responds with a redirect.
  if (url.pathname.endsWith("/callback")) {
    return await paymentCallback(req);
  }

  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") {
      const text = await req.text();
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    }
  } catch (_e) {
    return json(req, { success: false, message: "Invalid JSON body" }, 400);
  }

  const action = body.action as string | undefined;

  try {
    switch (action) {
      case "check-referral":
        return json(req, await checkReferralCode(body));

      case "log-credentials": {
        if (!hasServiceRoleAuthorization(req)) {
          return json(req, { success: false, message: "Internal scheduler authorization required" }, 403);
        }
        return json(req, logCredentials());
      }

      case "process-recurring": {
        // Scheduled billing is internal. This function remains public only for
        // Payple's callback route above.
        if (!hasServiceRoleAuthorization(req)) {
          return json(req, { success: false, message: "Internal scheduler authorization required" }, 403);
        }
        const recurringResult = await processRecurringPayments();
        // After the run, not before: a heartbeat written on entry would keep looking
        // healthy while the billing itself threw.
        await recordSchedulerHeartbeat("payment.process-recurring", {
          result: recurringResult,
        });
        return json(req, recurringResult);
      }

      case "window":
      case "verify":
      case "report-failure":
      case "cancel":
      case "stop":
      case "generate-referral": {
        const uid = await callerUid(req);
        if (!uid) {
          return json(
            req,
            { success: false, message: "Authentication required" },
            401,
          );
        }
        switch (action) {
          case "window":
            return json(req, await getPaymentWindow(uid, body));
          case "verify":
            return json(req, await verifyPaymentResult(uid, body));
          case "report-failure":
            return json(req, await reportPaymentFailure(uid, body));
          case "cancel":
            return json(req, await cancelSubscription(uid, body));
          case "stop":
            return json(req, await stopNextBilling(uid, body));
          case "generate-referral":
            return json(req, await generateReferralCode(uid));
        }
        break;
      }

      default:
        return json(req, { success: false, message: `Unknown action: ${action}` }, 400);
    }
    // Unreachable, satisfies the type checker.
    return json(req, { success: false, message: "Unhandled request" }, 400);
  } catch (error) {
    const err = error as ApiError;
    const status = typeof err.status === "number" ? err.status : 500;
    logError(`Error handling action '${action}':`, error);
    return json(
      req,
      { success: false, message: err.message || "Internal error", errorCode: err.code || "internal" },
      status,
    );
  }
});
