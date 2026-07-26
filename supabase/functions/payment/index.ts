// Supabase Edge Function: payment  (Phase 1 — subscribe flow)
// Ports functions/src/payment.ts (Firebase) to Supabase, writing Postgres instead
// of Firestore. Dispatches by `action`. The client calls this via
// supabase.functions.invoke("payment", { body: { action, ... } }).
//
// Phase 1 actions: "window", "verify", "check-referral".
// (Phase 2: cancel/stop/generate-referral. Phase 3: paymentCallback webhook + recurring cron.)
//
// Required secrets (supabase secrets set ...):
//   PAYPLE_CST_ID, PAYPLE_CUST_KEY, PAYPLE_CLIENT_KEY, PAYPLE_REFUND_KEY,
//   PAYPLE_AUTH_URL (opt), PAYPLE_HOSTNAME (opt), PAYMENT_CALLBACK_URL (opt),
//   TOAST_APPKEY, TOAST_SECRET_KEY, TOAST_SENDER_KEY   (for the Kakao receipt)
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are auto-injected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYPLE_CST_ID = Deno.env.get("PAYPLE_CST_ID") ?? "";
const PAYPLE_CUST_KEY = Deno.env.get("PAYPLE_CUST_KEY") ?? "";
const PAYPLE_CLIENT_KEY = Deno.env.get("PAYPLE_CLIENT_KEY") ?? "";
const PAYPLE_AUTH_URL = Deno.env.get("PAYPLE_AUTH_URL") ?? "https://cpay.payple.kr/php/auth.php";
const PAYPLE_HOSTNAME = Deno.env.get("PAYPLE_HOSTNAME") ?? "https://1cupenglish.com";
const PAYMENT_CALLBACK_URL = Deno.env.get("PAYMENT_CALLBACK_URL") ??
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-callback`;
const SUBSCRIPTION_PRICE = 9900;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Korean phone normalizer used for Payple PCD_PAYER_HP + Kakao recipient.
function normPhone(raw: string): string {
  let p = (raw ?? "").replace(/^\+?82/, "0").replace(/\D/g, "");
  if (!p) return "";
  if (p.length >= 10) return p;
  return p.slice(-8).padStart(8, "0");
}

async function getPaypleAuthToken(isCancel = false) {
  const res = await fetch(PAYPLE_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", referer: PAYPLE_HOSTNAME },
    body: JSON.stringify({
      cst_id: PAYPLE_CST_ID, custKey: PAYPLE_CUST_KEY,
      PCD_PAY_TYPE: "card", PCD_SIMPLE_FLAG: "Y", PCD_PAY_WORK: "CERT",
      PCD_PAYCANCEL_FLAG: isCancel ? "Y" : "N",
    }),
  });
  const data = await res.json();
  if (data.result !== "success") throw new Error("Payple auth failed: " + JSON.stringify(data));
  return data;
}

// Non-fatal Kakao AlimTalk send (payment receipt). Reuses the Toast creds.
async function sendKakao(templateCode: string, recipientList: unknown[]): Promise<void> {
  const appkey = Deno.env.get("TOAST_APPKEY");
  const secret = Deno.env.get("TOAST_SECRET_KEY");
  const senderKey = Deno.env.get("TOAST_SENDER_KEY");
  if (!appkey || !secret || !senderKey) return;
  await fetch(`https://api-alimtalk.cloud.toast.com/alimtalk/v2.2/appkeys/${appkey}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8", "X-Secret-Key": secret },
    body: JSON.stringify({ senderKey, templateCode, recipientList }),
  });
}

// ---- action: check-referral --------------------------------------------------
async function handleCheckReferral(db: any, body: any) {
  const code = body.code;
  if (!code) return json({ valid: false, message: "코드를 입력해주세요." });
  const { data: ref } = await db.from("referral_codes").select("active, discount, type").eq("code", code).maybeSingle();
  if (!ref) return json({ valid: false, message: "유효하지 않은 코드입니다." });
  if (!ref.active) return json({ valid: false, message: "만료된 코드입니다." });
  return json({
    valid: true, discount: ref.discount, discountType: ref.type || "fixed_price",
    message: "할인 코드가 적용되었습니다.", originalPrice: 9700,
  });
}

// ---- action: window ----------------------------------------------------------
async function handleWindow(db: any, uid: string, userRow: any, body: any) {
  if (userRow?.has_active_subscription) {
    return json({ success: false, message: "User already has an active subscription" });
  }
  const email = (body.userEmail ?? "").trim();
  const displayName = body.userName || userRow?.display_name || "구독자";
  const payerPhone = normPhone(body.userPhone || userRow?.phone || "") || Date.now().toString().slice(-8);
  const finalAmount = body.pcd_amount ?? SUBSCRIPTION_PRICE;
  const selectedCategories = body.selected_categories || {};

  // validate referral (self-referral blocked)
  let appliedReferralCode: string | null = null;
  if (body.referralCode) {
    const { data: ref } = await db.from("referral_codes")
      .select("active, referrer").eq("code", body.referralCode).maybeSingle();
    if (ref?.active && ref.referrer !== uid) appliedReferralCode = body.referralCode;
  }

  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const orderNumber = `OCE${d.getFullYear()}${mm}${dd}${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;

  const paymentParams = {
    clientKey: PAYPLE_CLIENT_KEY,
    PCD_PAY_TYPE: "card", PCD_PAY_WORK: "CERT", PCD_CARD_VER: "01",
    PCD_PAY_GOODS: body.pcd_good_name || "영어 한잔 멤버십",
    PCD_PAY_TOTAL: finalAmount,
    PCD_REGULER_FLAG: "Y", PCD_SIMPLE_FLAG: "Y",
    PCD_PAY_OID: orderNumber,
    PCD_PAY_YEAR: String(d.getFullYear()), PCD_PAY_MONTH: mm,
    PCD_PAYER_NO: uid, PCD_PAYER_NAME: displayName, PCD_PAYER_EMAIL: email, PCD_PAYER_HP: payerPhone,
    PCD_RST_URL: PAYMENT_CALLBACK_URL,
    PCD_PAYER_AUTHTYPE: "sms",
    PCD_USER_DEFINE1: uid,
    PCD_SIMPLE_FNAME: "payment-result",
    PCD_USER_DEFINE2: JSON.stringify(selectedCategories),
  };

  const { error } = await db.from("payment_orders").insert({
    order_number: orderNumber, user_id: uid, amount: finalAmount, referral_code: appliedReferralCode,
    order_date: d.toISOString(), status: "pending_auth", type: "subscription_init",
    payple_params_attempted: paymentParams, selected_categories: selectedCategories, created_at: new Date().toISOString(),
  });
  if (error) return json({ success: false, message: "Failed to initialize payment" }, 500);

  return json({ success: true, paymentParams });
}

// ---- action: verify ----------------------------------------------------------
async function handleVerify(db: any, uid: string, body: any) {
  const paymentParams = body.paymentParams;
  if (!paymentParams?.PCD_PAY_RST) {
    return json({ success: false, message: "Payment result information is incomplete" });
  }
  if (paymentParams.PCD_PAY_RST !== "success") {
    const msg = paymentParams.PCD_PAY_MSG || "Unknown error";
    const code = paymentParams.PCD_PAY_CODE || "unknown";
    return json({ success: false, message: `Payment failed: ${msg} (Code: ${code})`, errorCode: code });
  }

  const billingKey = paymentParams.PCD_PAYER_ID || paymentParams.PCD_CARD_BILLKEY || "";
  if (!billingKey) return json({ success: false, message: "결제 정보에 빌링키가 없습니다. 다시 시도해주세요." });

  const paymentOrderId = paymentParams.PCD_PAY_OID || "";

  // fetch original order for dynamic amount / categories / referrer
  let originalAmount = SUBSCRIPTION_PRICE;
  let selectedCategories: Record<string, boolean> = {};
  let productName = "영어 한잔 멤버십 (정기결제)";
  let referrerUid: string | null = null;
  if (paymentOrderId) {
    const { data: order } = await db.from("payment_orders")
      .select("amount, selected_categories, referral_code").eq("order_number", paymentOrderId).maybeSingle();
    if (order) {
      if (order.amount && order.amount > 0) originalAmount = Number(order.amount);
      if (order.selected_categories) {
        selectedCategories = order.selected_categories;
        const parts: string[] = [];
        if (selectedCategories.tech) parts.push("테크");
        if (selectedCategories.business) parts.push("비즈니스");
        if (selectedCategories.meetup) parts.push("밋업");
        if (parts.length) productName = `영어 한잔 멤버십 (${parts.join(" + ")})`;
      }
      if (order.referral_code) {
        const { data: ref } = await db.from("referral_codes").select("referrer").eq("code", order.referral_code).maybeSingle();
        referrerUid = ref?.referrer ?? null;
      }
    }
  }

  // make the initial billing-key payment
  const auth = await getPaypleAuthToken();
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const orderNumber = `OCEPAY${d.getFullYear()}${mm}${dd}${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  const payURL = auth.PCD_PAY_HOST && auth.PCD_PAY_URL
    ? `${auth.PCD_PAY_HOST}${auth.PCD_PAY_URL}`
    : "https://cpay.payple.kr/php/SimplePayCardAct.php?ACT_=PAYM";

  const payReq = {
    PCD_CST_ID: auth.cst_id, PCD_CUST_KEY: auth.custKey, PCD_AUTH_KEY: auth.AuthKey,
    PCD_PAY_TYPE: "card", PCD_PAYER_ID: billingKey, PCD_PAY_GOODS: productName,
    PCD_SIMPLE_FLAG: "Y", PCD_PAY_TOTAL: originalAmount, PCD_PAY_OID: orderNumber,
    PCD_PAYER_NO: paymentParams.PCD_PAYER_NO || Date.now().toString().slice(-8),
    PCD_PAY_YEAR: String(d.getFullYear()), PCD_PAY_MONTH: mm,
    PCD_PAY_ISTAX: "Y", PCD_PAY_TAXTOTAL: String(Math.floor(originalAmount / 11)),
  };

  const payRes = await fetch(payURL, {
    method: "POST",
    headers: { "Content-Type": "application/json", referer: PAYPLE_HOSTNAME },
    body: JSON.stringify(payReq),
  });
  const pay = await payRes.json();

  if (pay.PCD_PAY_RST !== "success") {
    await db.from("payment_orders").insert({
      order_number: orderNumber, user_id: uid, amount: originalAmount, status: "failed",
      type: "subscription_initial_payment", error_code: pay.PCD_PAY_CODE || "unknown",
      error_message: pay.PCD_PAY_MSG || "알 수 없는 오류", payment_result: pay,
      billing_key_used: billingKey, failed_at: new Date().toISOString(),
      related_auth_order: paymentOrderId || null, created_at: new Date().toISOString(),
    });
    return json({ success: false, message: `결제 실패: ${pay.PCD_PAY_MSG || "알 수 없는 오류"} (코드: ${pay.PCD_PAY_CODE || "unknown"})` });
  }

  // success: log order + activate subscription
  await db.from("payment_orders").insert({
    order_number: orderNumber, user_id: uid, amount: pay.PCD_PAY_TOTAL || originalAmount,
    status: "completed", type: "subscription_initial_payment", payment_result: pay,
    billing_key_used: billingKey, payment_method: "card", completed_at: new Date().toISOString(),
    related_auth_order: paymentOrderId || null, created_at: new Date().toISOString(),
  });

  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  await db.from("users").update({
    has_active_subscription: true,
    subscription_start_date: start.toISOString(), subscription_end_date: end.toISOString(),
    billing_key: billingKey, payment_method: "card", billing_updated_at: new Date().toISOString(),
    plan_price: originalAmount,
    cat_tech: selectedCategories.tech ?? false, cat_business: selectedCategories.business ?? false,
  }).eq("uid", uid);

  // referral reward: referrer gets plan_price 4700 (only lower it)
  if (referrerUid) {
    const { data: refUser } = await db.from("users").select("plan_price").eq("uid", referrerUid).maybeSingle();
    const cur = Number(refUser?.plan_price || 0);
    if (!cur || cur > 4700) {
      await db.from("users").update({ plan_price: 4700, billing_updated_at: new Date().toISOString() }).eq("uid", referrerUid);
    }
  }

  // Kakao receipt (non-fatal)
  try {
    const { data: u } = await db.from("users").select("phone").eq("uid", uid).maybeSingle();
    const recipientNo = normPhone(u?.phone || "");
    if (recipientNo.startsWith("010") && recipientNo.length >= 10) {
      await sendKakao("order-received", [{
        recipientNo,
        templateParameter: { "customer-name": "고객", link: "https://1cupenglish.com/guide" },
      }]);
    }
  } catch (_) { /* ignore */ }

  return json({ success: true, message: "결제가 성공적으로 완료되었습니다.", data: pay });
}

// ---- entrypoint --------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, message: "Invalid request" }, 400); }
  const action = body?.action;

  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // check-referral needs no privileged identity beyond a valid session
  const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json({ success: false, message: "Authentication required" }, 401);

  const { data: userRow } = await db.from("users")
    .select("uid, has_active_subscription, phone, display_name, email").eq("auth_id", user.id).maybeSingle();
  const uid = userRow?.uid;
  if (!uid) return json({ success: false, message: "User not found" }, 404);

  try {
    switch (action) {
      case "check-referral": return await handleCheckReferral(db, body);
      case "window": return await handleWindow(db, uid, userRow, body);
      case "verify": return await handleVerify(db, uid, body);
      default: return json({ success: false, message: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("payment error:", action, e);
    return json({ success: false, message: e instanceof Error ? e.message : "Payment error" }, 500);
  }
});
