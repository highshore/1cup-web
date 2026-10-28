// 영어 한잔 Daily payments through Payple, mirroring the 1cup membership checkout
// (supabase/functions/checkout): the browser opens Payple in CERT mode, which registers
// the card and returns a billing key without charging; the server then charges that key
// for the amount stored on the order. Daily keeps its own products, orders and
// subscriptions; only the Payple merchant account is shared.
//
// Every money-moving step is idempotent through a database function (see the
// 20261026000000_daily_payments migration): an order is claimed once, settled once,
// and a renewal is created once per subscription period.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isTrack, kstDate } from "./delivery.ts";
import { notify, won } from "./notices.ts";

const PAYPLE_HOST = (Deno.env.get("PAYPLE_HOST") || "https://cpay.payple.kr").replace(/\/+$/, "");
const PAYPLE_AUTH_URL = Deno.env.get("PAYPLE_AUTH_URL") || `${PAYPLE_HOST}/php/auth.php`;
// The domain registered with Payple; sent as the referer on every server call.
const PAYPLE_HOSTNAME = Deno.env.get("PAYPLE_HOSTNAME") || "https://1cupenglish.com";
const SITE_URL = (Deno.env.get("DAILY_SITE_URL") || "https://1cupenglish.com").replace(/\/+$/, "");

// Bump together with DAILY_TERMS_VERSION in app/lib/features/daily/constants.ts.
export const PAYMENT_TERMS_VERSION = "2026-10-29.1";

export class PaymentError extends Error {
  constructor(message: string, readonly code: string, readonly status = 400) {
    super(message);
  }
}

export interface PaymentCustomer {
  id: string;
  phone: string;
  name: string | null;
  verified: boolean;
}

type ProductId = "sub_30d" | "pass_1m" | "pass_3m" | "pass_6m";

interface ProductRow {
  id: ProductId;
  name: string;
  amount: number;
  days: number;
  recurring: boolean;
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new PaymentError("결제 설정이 준비되지 않았어요.", "payments-not-configured", 503);
  return value;
}

function yyyymmdd(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replaceAll("-", "");
}

function randomDigits(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => (b % 10).toString()).join("");
}

// Payple wants a numeric payer number (≤ 18 digits); derived, not stored.
async function payerNo(source: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)));
  return Array.from(digest.slice(0, 12), (b) => (b % 10).toString()).join("");
}

async function paymentsOpen(db: SupabaseClient): Promise<boolean> {
  const { data } = await db.from("daily_config").select("payments_open").eq("id", "settings").maybeSingle();
  return data?.payments_open === true;
}

async function getProduct(db: SupabaseClient, id: unknown): Promise<ProductRow> {
  if (id !== "sub_30d" && id !== "pass_1m" && id !== "pass_3m" && id !== "pass_6m") {
    throw new PaymentError("상품을 골라 주세요.", "invalid-product");
  }
  const { data } = await db.from("daily_products").select("id, name, amount, days, recurring").eq("id", id).eq("active", true).maybeSingle();
  if (!data) throw new PaymentError("판매하지 않는 상품이에요.", "invalid-product");
  return data as ProductRow;
}

// ---------------------------------------------------------------------------
// Payple calls (same requests as supabase/functions/checkout)
// ---------------------------------------------------------------------------

async function paypleAuth(cancel = false) {
  const response = await fetch(PAYPLE_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", referer: PAYPLE_HOSTNAME },
    body: JSON.stringify({
      cst_id: env("PAYPLE_CST_ID"),
      custKey: env("PAYPLE_CUST_KEY"),
      PCD_PAY_TYPE: "card",
      PCD_SIMPLE_FLAG: "Y",
      PCD_PAY_WORK: "CERT",
      PCD_PAYCANCEL_FLAG: cancel ? "Y" : "N",
    }),
  });
  const data = await response.json();
  if (data?.result !== "success") {
    throw new PaymentError(data?.result_msg || "페이플 인증에 실패했어요.", "payple-auth-failed", 502);
  }
  return data as Record<string, string>;
}

interface ChargeResult {
  ok: boolean;
  data: Record<string, unknown>;
  message: string;
}

async function chargeBillingKey(args: {
  billingKey: string;
  amount: number;
  goods: string;
  chargeOrderNumber: string;
  customerId: string;
}): Promise<ChargeResult> {
  const auth = await paypleAuth();
  const now = new Date();
  const url = auth.PCD_PAY_HOST && auth.PCD_PAY_URL
    ? `${auth.PCD_PAY_HOST}${auth.PCD_PAY_URL}`
    : `${PAYPLE_HOST}/php/SimplePayCardAct.php?ACT_=PAYM`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", referer: PAYPLE_HOSTNAME },
    body: JSON.stringify({
      PCD_CST_ID: auth.cst_id,
      PCD_CUST_KEY: auth.custKey,
      PCD_AUTH_KEY: auth.AuthKey,
      PCD_PAY_TYPE: "card",
      PCD_PAYER_ID: args.billingKey,
      PCD_PAY_GOODS: args.goods.slice(0, 50),
      PCD_SIMPLE_FLAG: "Y",
      PCD_PAY_TOTAL: args.amount,
      PCD_PAY_OID: args.chargeOrderNumber,
      PCD_PAYER_NO: await payerNo(args.customerId),
      PCD_PAY_YEAR: now.getFullYear().toString(),
      PCD_PAY_MONTH: (now.getMonth() + 1).toString().padStart(2, "0"),
      PCD_PAY_ISTAX: "Y",
      PCD_PAY_TAXTOTAL: Math.floor(args.amount / 11).toString(),
    }),
  });
  const data = (await response.json()) as Record<string, unknown>;
  return {
    ok: data?.PCD_PAY_RST === "success",
    data,
    message: String(data?.PCD_PAY_MSG ?? "결제에 실패했어요."),
  };
}

/**
 * Cancels `amount` of a completed charge (a partial amount is a partial cancel), the
 * same request as the 1cup membership refund. The charge is identified by Payple's own
 * PCD_PAY_OID and the date in PCD_PAY_TIME from the stored payment result.
 */
export async function refundCharge(args: { paymentResult: Record<string, unknown>; fallbackOid: string; completedAt: string; amount: number }): Promise<ChargeResult> {
  const auth = await paypleAuth(true);
  const payTime = String(args.paymentResult?.PCD_PAY_TIME ?? "");
  const response = await fetch(`${PAYPLE_HOST}/php/account/api/cPayCAct.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", referer: PAYPLE_HOSTNAME },
    body: JSON.stringify({
      PCD_CST_ID: auth.cst_id,
      PCD_CUST_KEY: auth.custKey,
      PCD_AUTH_KEY: auth.AuthKey,
      PCD_REFUND_KEY: env("PAYPLE_REFUND_KEY"),
      PCD_PAYCANCEL_FLAG: "Y",
      PCD_PAY_OID: String(args.paymentResult?.PCD_PAY_OID || args.fallbackOid),
      PCD_PAY_DATE: payTime.length >= 8 ? payTime.slice(0, 8) : yyyymmdd(new Date(args.completedAt)),
      PCD_REFUND_TOTAL: args.amount.toString(),
    }),
  });
  const data = (await response.json()) as Record<string, unknown>;
  return {
    ok: data?.PCD_PAY_RST === "success",
    data,
    message: String(data?.PCD_PAY_MSG ?? "환불에 실패했어요."),
  };
}

// Invite rewards for a payment that just completed (terms 제5조의2). The database
// function applies each reward once; a failure here never fails the payment, and the
// next payment of the same customer picks up anything an inviter is still owed.
async function applyInvite(db: SupabaseClient, orderNumber: string) {
  const { error } = await db.rpc("daily_apply_invite", { p_order_number: orderNumber });
  if (error) console.error("daily invite reward failed:", orderNumber, error.message);
}

// The KakaoTalk notice for a paid order, a checkout or a renewal: what was paid and until
// when it runs. Sent once per order; paid_notice_at is claimed first, so a settle retried
// from another tab never sends it twice. A failure here never fails the payment.
async function notifyPaid(db: SupabaseClient, orderNumber: string) {
  const { data: order } = await db
    .from("daily_orders")
    .update({ paid_notice_at: new Date().toISOString() })
    .eq("order_number", orderNumber)
    .eq("status", "completed")
    .is("paid_notice_at", null)
    .select("kind, amount, product, customer_id, subscription_id")
    .maybeSingle();
  if (!order) return;
  const [{ data: customer }, { data: product }, { data: sub }] = await Promise.all([
    db.from("daily_customers").select("phone, name").eq("id", order.customer_id).maybeSingle(),
    db.from("daily_products").select("name, recurring").eq("id", order.product).maybeSingle(),
    db.from("daily_subscriptions").select("paid_until").eq("id", order.subscription_id).maybeSingle(),
  ]);
  if (!customer?.phone || !product) return;

  const paid = order.kind === "renewal"
    ? `${product.name} ${won(order.amount)}이 자동 결제됐어요.`
    : `${product.name} ${won(order.amount)} 결제를 마쳤어요.`;
  let until = "";
  if (sub?.paid_until) {
    const [y, m, d] = kstDate(new Date(sub.paid_until)).split("-").map(Number);
    until = product.recurring ? ` 다음 결제일은 ${y}년 ${m}월 ${d}일이에요.` : ` ${y}년 ${m}월 ${d}일까지 받아요.`;
  }
  await notify(db, [customer.phone], `[영어 한잔 Daily] ${paid}${until}`, customer.name || "고객", "/daily/account");
}

// The invite a first checkout arrived with: a live customer's code, not the payer's own.
async function validInviteCode(db: SupabaseClient, customerId: string, code: unknown): Promise<string | null> {
  if (typeof code !== "string" || !/^[A-Z2-9]{8}$/.test(code)) return null;
  const { data } = await db.from("daily_customers").select("id").eq("invite_code", code).is("deleted_at", null).maybeSingle();
  return data && data.id !== customerId ? code : null;
}

// ---------------------------------------------------------------------------
// Customer actions
// ---------------------------------------------------------------------------

export async function billingInfo(db: SupabaseClient, customer: PaymentCustomer) {
  const [{ data: subs }, { data: products }, open] = await Promise.all([
    db.from("daily_subscriptions")
      .select("id, track, status, plan, paid_until, auto_renew, delivery_time")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    db.from("daily_products").select("id, name, amount, days, recurring").eq("active", true),
    paymentsOpen(db),
  ]);
  return {
    paymentsOpen: open,
    verified: customer.verified,
    phone: `${customer.phone.slice(0, 3)}-****-${customer.phone.slice(-4)}`,
    subscriptions: (subs ?? []).map((s) => ({
      track: s.track,
      status: s.status,
      plan: s.plan,
      paidUntil: s.paid_until,
      autoRenew: s.auto_renew,
      deliveryTime: String(s.delivery_time).slice(0, 5),
    })),
    products: products ?? [],
  };
}

export async function createCheckoutWindow(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  if (!(await paymentsOpen(db))) throw new PaymentError("결제는 곧 열려요.", "payments-closed", 403);
  const product = await getProduct(db, body.product);
  const track = body.track;
  if (!isTrack(track)) throw new PaymentError("레벨을 골라 주세요.", "invalid-track");
  const time = typeof body.time === "string" ? body.time : "";
  if (!/^([01][0-9]|2[0-2]):00$/.test(time) || time < "06:00" || time > "22:00") {
    throw new PaymentError("받는 시간을 골라 주세요.", "invalid-time");
  }
  const agreements = (body.agreements ?? {}) as Record<string, unknown>;
  if (![agreements.terms, agreements.privacy, agreements.messages, agreements.refund].every((v) => v === true)) {
    throw new PaymentError("필수 항목에 모두 동의해 주세요.", "consent-required");
  }
  if (body.termsVersion !== PAYMENT_TERMS_VERSION) {
    throw new PaymentError("이용약관이 바뀌었어요. 새로고침 후 다시 동의해 주세요.", "terms-outdated", 409);
  }

  // A second auto-renewing subscription on the same track would bill twice a month.
  if (product.recurring) {
    const { data: live } = await db
      .from("daily_subscriptions")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("track", track)
      .eq("status", "active")
      .eq("auto_renew", true)
      .maybeSingle();
    if (live) throw new PaymentError("이미 이 레벨을 정기구독하고 있어요.", "already-subscribed", 409);
  }

  const orderNumber = `DLY${yyyymmdd()}${randomDigits(8)}`;
  const { error } = await db.from("daily_orders").insert({
    order_number: orderNumber,
    kind: "checkout",
    customer_id: customer.id,
    product: product.id,
    amount: product.amount,
    track,
    delivery_time: `${time}:00`,
    status: "pending_auth",
    terms_version: PAYMENT_TERMS_VERSION,
    marketing_consent: body.marketing === true,
    invite_code: await validInviteCode(db, customer.id, body.inviteCode),
  });
  if (error) throw new PaymentError("주문을 만들지 못했어요. 다시 시도해 주세요.", "order-create-failed", 500);

  const now = new Date();
  return {
    orderNumber,
    paymentParams: {
      clientKey: env("PAYPLE_CLIENT_KEY"),
      PCD_PAY_TYPE: "card",
      PCD_PAY_WORK: "CERT",
      PCD_CARD_VER: "01",
      PCD_PAY_GOODS: product.name.slice(0, 50),
      PCD_PAY_TOTAL: product.amount,
      PCD_REGULER_FLAG: product.recurring ? "Y" : "N",
      PCD_SIMPLE_FLAG: "Y",
      PCD_PAY_OID: orderNumber,
      PCD_PAY_YEAR: now.getFullYear().toString(),
      PCD_PAY_MONTH: (now.getMonth() + 1).toString().padStart(2, "0"),
      PCD_PAYER_NO: await payerNo(customer.id),
      PCD_PAYER_NAME: (customer.name || "고객").slice(0, 20),
      PCD_PAYER_HP: customer.phone,
      PCD_PAYER_AUTHTYPE: "sms",
      PCD_RST_URL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/daily/callback`,
      // Payple may leave PCD_PAY_OID out of some responses; the order number rides here too.
      PCD_USER_DEFINE2: JSON.stringify({ orderNumber }),
    },
  };
}

interface PayResult {
  PCD_PAY_RST?: unknown;
  PCD_PAY_CODE?: unknown;
  PCD_PAY_MSG?: unknown;
  PCD_PAYER_ID?: unknown;
}

async function subscriptionSummary(db: SupabaseClient, subscriptionId: string | null) {
  if (!subscriptionId) return null;
  const { data } = await db
    .from("daily_subscriptions")
    .select("track, plan, paid_until, auto_renew, delivery_time")
    .eq("id", subscriptionId)
    .maybeSingle();
  return data
    ? { track: data.track, plan: data.plan, paidUntil: data.paid_until, autoRenew: data.auto_renew, deliveryTime: String(data.delivery_time).slice(0, 5) }
    : null;
}

export async function verifyCheckout(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber : "";
  const result = (body.result ?? {}) as PayResult;
  const { data: order } = await db
    .from("daily_orders")
    .select("order_number, status, amount, product, billing_key, subscription_id, kind")
    .eq("order_number", orderNumber)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!order || order.kind !== "checkout") throw new PaymentError("주문을 찾을 수 없어요.", "order-missing", 404);

  if (order.status === "completed") {
    return { success: true, subscription: await subscriptionSummary(db, order.subscription_id) };
  }

  // Card registration was cancelled or refused in the Payple window: nothing was charged.
  if (result.PCD_PAY_RST !== "success" && order.status === "pending_auth" && !order.billing_key) {
    await db.from("daily_orders")
      .update({ status: "failed", error: String(result.PCD_PAY_MSG ?? "결제창에서 취소됐어요.").slice(0, 500), failed_at: new Date().toISOString() })
      .eq("order_number", orderNumber)
      .eq("status", "pending_auth");
    throw new PaymentError(String(result.PCD_PAY_MSG ?? "결제를 취소했어요."), "payment-cancelled");
  }

  const { data: claimRows, error: claimError } = await db.rpc("daily_claim_order", {
    p_order_number: orderNumber,
    p_customer_id: customer.id,
  });
  if (claimError) throw new PaymentError("결제를 시작하지 못했어요.", "claim-failed", 500);
  const claim = (Array.isArray(claimRows) ? claimRows[0] : claimRows) as
    | { state: string; charge_order_number: string | null; payment_result: Record<string, unknown> | null }
    | undefined;

  if (!claim || claim.state === "missing") throw new PaymentError("주문을 찾을 수 없어요.", "order-missing", 404);
  if (claim.state === "completed") {
    return { success: true, subscription: await subscriptionSummary(db, order.subscription_id) };
  }
  if (claim.state === "charging") {
    // Charged earlier but settlement did not finish: settle now, never charge again.
    if (claim.payment_result?.PCD_PAY_RST === "success") {
      const { data: subId, error } = await db.rpc("daily_complete_order", {
        p_order_number: orderNumber,
        p_payment_result: claim.payment_result,
        p_billing_key: order.billing_key,
      });
      if (error) throw new PaymentError("결제는 됐지만 구독을 열지 못했어요. 다시 결제하지 말고 문의해 주세요.", "settle-failed", 500);
      await applyInvite(db, orderNumber);
      await notifyPaid(db, orderNumber);
      return { success: true, subscription: await subscriptionSummary(db, subId as string) };
    }
    throw new PaymentError("결제를 처리하고 있어요. 잠시 후 새로고침해 주세요.", "payment-in-progress", 409);
  }
  if (claim.state !== "claimed" || !claim.charge_order_number) {
    throw new PaymentError("이 주문은 다시 결제할 수 없어요. 새로 시도해 주세요.", "order-closed", 409);
  }

  // The billing key from Payple's server callback, else from the browser callback.
  const billingKey = order.billing_key || (typeof result.PCD_PAYER_ID === "string" ? result.PCD_PAYER_ID : "");
  if (!billingKey) {
    await db.from("daily_orders").update({ status: "failed", error: "billing key missing", failed_at: new Date().toISOString() })
      .eq("order_number", orderNumber);
    throw new PaymentError("카드 등록 정보를 받지 못했어요. 다시 시도해 주세요.", "billing-key-missing");
  }
  const product = await getProduct(db, order.product);

  const charge = await chargeBillingKey({
    billingKey,
    amount: order.amount,
    goods: product.name,
    chargeOrderNumber: claim.charge_order_number,
    customerId: customer.id,
  });
  if (!charge.ok) {
    await db.from("daily_orders")
      .update({ status: "failed", billing_key: billingKey, payment_result: charge.data, error: charge.message.slice(0, 500), failed_at: new Date().toISOString() })
      .eq("order_number", orderNumber);
    throw new PaymentError(charge.message, "payple-charge-failed");
  }

  // Persist the successful charge before anything else, so a crash below can be
  // settled later without charging again.
  const { error: persistError } = await db.from("daily_orders")
    .update({ billing_key: billingKey, payment_result: charge.data })
    .eq("order_number", orderNumber);
  if (persistError) {
    throw new PaymentError("결제는 됐지만 결과를 저장하지 못했어요. 다시 결제하지 말고 문의해 주세요.", "persist-failed", 500);
  }
  const { data: subId, error: settleError } = await db.rpc("daily_complete_order", {
    p_order_number: orderNumber,
    p_payment_result: charge.data,
    p_billing_key: billingKey,
  });
  if (settleError) {
    throw new PaymentError("결제는 됐지만 구독을 열지 못했어요. 다시 결제하지 말고 새로고침해 주세요.", "settle-failed", 500);
  }
  await applyInvite(db, orderNumber);
  await notifyPaid(db, orderNumber);
  return { success: true, subscription: await subscriptionSummary(db, subId as string) };
}

export async function cancelRenewal(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  const track = body.track;
  if (!isTrack(track)) throw new PaymentError("레벨을 골라 주세요.", "invalid-track");
  const { error } = await db
    .from("daily_subscriptions")
    .update({ auto_renew: false, cancelled_at: new Date().toISOString() })
    .eq("customer_id", customer.id)
    .eq("track", track)
    .eq("status", "active");
  if (error) throw new PaymentError("해지하지 못했어요. 다시 시도해 주세요.", "cancel-failed", 500);

  // The survey answers from the 서비스 중단하기 sheet. Losing them must not undo the
  // cancellation, so a failed insert is only logged.
  const reasons = Array.isArray(body.reasons)
    ? body.reasons.filter((r): r is string => typeof r === "string").map((r) => r.slice(0, 120)).slice(0, 12)
    : [];
  const other = typeof body.other === "string" ? body.other.trim().slice(0, 500) : "";
  if (reasons.length > 0 || other) {
    const { error: feedbackError } = await db
      .from("daily_cancel_feedback")
      .insert({ customer_id: customer.id, track, reasons, other: other || null });
    if (feedbackError) console.error("daily cancel feedback:", feedbackError.message);
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Payple server callback: keeps the billing key on the order, redirects the browser
// ---------------------------------------------------------------------------

const CALLBACK_FIELDS = ["PCD_PAY_RST", "PCD_PAY_CODE", "PCD_PAY_MSG", "PCD_PAY_OID", "PCD_PAY_WORK", "PCD_USER_DEFINE2"];

export async function handleCallback(db: SupabaseClient, req: Request): Promise<Response> {
  const fields: Record<string, string> = {};
  try {
    if (req.method === "GET") {
      new URL(req.url).searchParams.forEach((value, key) => (fields[key] = value));
    } else if ((req.headers.get("content-type") || "").includes("application/json")) {
      Object.assign(fields, await req.json());
    } else {
      (await req.formData()).forEach((value, key) => (fields[key] = String(value)));
    }
  } catch {
    // Fall through with whatever was read; the result page reports a missing result.
  }

  let orderNumber = String(fields.PCD_PAY_OID ?? "");
  if (!orderNumber && fields.PCD_USER_DEFINE2) {
    try {
      orderNumber = JSON.parse(fields.PCD_USER_DEFINE2).orderNumber ?? "";
    } catch {
      // ignore
    }
  }
  // Store the billing key server-side rather than putting it in the browser's URL. It can
  // only be written once, onto an order still waiting for its card.
  if (orderNumber && fields.PCD_PAY_RST === "success" && typeof fields.PCD_PAYER_ID === "string") {
    await db.from("daily_orders")
      .update({ billing_key: fields.PCD_PAYER_ID })
      .eq("order_number", orderNumber)
      .eq("status", "pending_auth")
      .is("billing_key", null);
  }

  const target = new URL(`${SITE_URL}/daily/subscribe/result`);
  for (const key of CALLBACK_FIELDS) {
    const value = fields[key];
    if (typeof value === "string" && value) target.searchParams.set(key, value.slice(0, 512));
  }
  if (orderNumber) target.searchParams.set("order", orderNumber);
  return new Response(null, { status: 303, headers: { Location: target.toString() } });
}

// ---------------------------------------------------------------------------
// Renewals (pg_cron, daily 09:10 KST)
// ---------------------------------------------------------------------------

export interface BillingStats {
  due: number;
  charged: number;
  failed: number;
  skipped: number;
  ended: number;
}

export async function runBilling(db: SupabaseClient): Promise<BillingStats> {
  const stats: BillingStats = { due: 0, charged: 0, failed: 0, skipped: 0, ended: 0 };
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const graceStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await db
    .from("daily_subscriptions")
    .select("id, customer_id, plan")
    .eq("status", "active")
    .eq("auto_renew", true)
    .not("billing_key", "is", null)
    .lte("paid_until", horizon)
    .gte("paid_until", graceStart)
    .limit(500);
  if (error) throw new Error(`billing lookup failed: ${error.message}`);
  stats.due = due?.length ?? 0;

  for (const sub of due ?? []) {
    const orderNumber = `DLR${yyyymmdd(now)}${randomDigits(8)}`;
    const { data: claimed, error: claimError } = await db.rpc("daily_claim_renewal", {
      p_subscription_id: sub.id,
      p_order_number: orderNumber,
    });
    if (claimError || !claimed) {
      stats.skipped += 1;
      continue;
    }
    const { data: order } = await db
      .from("daily_orders")
      .select("amount, billing_key, product")
      .eq("order_number", orderNumber)
      .single();
    const product = await getProduct(db, order!.product);
    let charge: ChargeResult;
    try {
      charge = await chargeBillingKey({
        billingKey: order!.billing_key as string,
        amount: order!.amount,
        goods: product.name,
        chargeOrderNumber: orderNumber,
        customerId: sub.customer_id,
      });
    } catch (e) {
      charge = { ok: false, data: {}, message: e instanceof Error ? e.message : String(e) };
    }
    await db.rpc("daily_finish_renewal", {
      p_order_number: orderNumber,
      p_success: charge.ok,
      p_payment_result: charge.data,
      p_error: charge.ok ? null : charge.message,
    });
    if (charge.ok) {
      stats.charged += 1;
      await applyInvite(db, orderNumber);
      await notifyPaid(db, orderNumber);
    } else stats.failed += 1;
  }

  // Paid access that ran out and will not renew: stop deliveries for good.
  const { data: ended } = await db
    .from("daily_subscriptions")
    .update({ status: "cancelled", cancelled_at: now.toISOString(), next_send_at: null })
    .eq("status", "active")
    .lt("paid_until", now.toISOString())
    .or(`auto_renew.eq.false,paid_until.lt.${graceStart}`)
    .select("id");
  stats.ended = ended?.length ?? 0;
  return stats;
}
