// The Daily account page (/daily/account) and refund approvals (/admin/daily-refunds).
//
// Customers change their own settings and refund their payments. A refund is priced from
// the terms and cancelled through Payple the moment it is asked for, as in the 1cup
// membership refund; deleting the account refunds what is left first. Pricing, the
// single-refund rule and what a refund does to the subscription all live in the
// 20261026020000_daily_account migration, so this file only validates input, calls those
// functions, talks to Payple and sends the notices.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendKakaoMessages } from "../_shared/kakao.ts";
import { isTrack, templateCodes, TRACK_LABEL } from "./delivery.ts";
import { PaymentError, refundCharge, type PaymentCustomer } from "./payments.ts";

const SITE_HOST = (Deno.env.get("DAILY_SITE_URL") || "https://1cupenglish.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const OPEN_REFUND = ["requested", "refunding"];

function won(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function assertTrack(track: unknown): asserts track is "basic" | "advanced" {
  if (!isTrack(track)) throw new PaymentError("레벨을 골라 주세요.", "invalid-track");
}

// Notices go out through the approved general-purpose template (template_style
// "send-article"): a title line, a name and a link. With the dedicated Daily templates
// there is no template for these notices, so they are skipped and logged.
async function notify(db: SupabaseClient, phones: string[], title: string, name: string, path: string) {
  if (phones.length === 0) return;
  try {
    const codes = await templateCodes(db);
    if (!codes || codes.style !== "send-article") {
      console.warn("daily notice skipped: no general-purpose template configured");
      return;
    }
    await sendKakaoMessages(
      phones.map((phone) => ({
        recipientNo: phone,
        templateParameter: { "korean-title": title, "customer-name": name, "article-link": `${SITE_HOST}${path}` },
      })),
      codes.lesson,
    );
  } catch (e) {
    // A notice is never the reason a request or refund fails.
    console.error("daily notice failed:", e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

interface OrderRow {
  order_number: string;
  kind: "checkout" | "renewal";
  product: string;
  amount: number;
  track: string;
  completed_at: string;
  subscription_id: string | null;
  product_row: { name: string; days: number; recurring: boolean } | null;
}

interface RefundRow {
  id: string;
  order_number: string;
  amount: number;
  status: string;
  full_refund: boolean;
  requested_at: string;
  refunded_at: string | null;
  note: string | null;
}

export async function accountInfo(db: SupabaseClient, customer: PaymentCustomer) {
  const [{ data: subs }, { data: orders }, { data: refunds }] = await Promise.all([
    db.from("daily_subscriptions")
      .select("id, track, status, plan, paid_until, auto_renew, delivery_time, next_send_at, billing_key, marketing_consent_at, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    db.from("daily_orders")
      .select("order_number, kind, product, amount, track, completed_at, subscription_id, product_row:daily_products(name, days, recurring)")
      .eq("customer_id", customer.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(50),
    db.from("daily_refunds")
      .select("id, order_number, amount, status, full_refund, requested_at, refunded_at, note")
      .eq("customer_id", customer.id)
      .order("requested_at", { ascending: false }),
  ]);

  // The latest request per order decides what the page shows for it.
  const refundByOrder = new Map<string, RefundRow>();
  for (const r of (refunds ?? []) as RefundRow[]) if (!refundByOrder.has(r.order_number)) refundByOrder.set(r.order_number, r);

  const payments = await Promise.all(((orders ?? []) as unknown as OrderRow[]).map(async (o) => {
    const refund = refundByOrder.get(o.order_number) ?? null;
    let quote = null;
    if (!refund || refund.status === "rejected") {
      const { data } = await db.rpc("daily_refund_quote", { p_order_number: o.order_number });
      const row = (Array.isArray(data) ? data[0] : data) as { amount: number; days_refunded: number; full_refund: boolean } | undefined;
      if (row && row.amount > 0) quote = { amount: row.amount, daysRefunded: row.days_refunded, fullRefund: row.full_refund };
    }
    return {
      orderNumber: o.order_number,
      kind: o.kind,
      product: o.product,
      productName: o.product_row?.name ?? o.product,
      recurring: o.product_row?.recurring ?? false,
      amount: o.amount,
      track: o.track,
      paidAt: o.completed_at,
      refund: refund
        ? { status: refund.status, amount: refund.amount, requestedAt: refund.requested_at, refundedAt: refund.refunded_at, note: refund.note }
        : null,
      quote,
    };
  }));

  const openRefundSubs = new Set(
    ((orders ?? []) as unknown as OrderRow[])
      .filter((o) => OPEN_REFUND.includes(refundByOrder.get(o.order_number)?.status ?? ""))
      .map((o) => o.subscription_id),
  );
  const now = Date.now();
  const { data: me } = await db.from("daily_customers").select("name, workplace, job_category").eq("id", customer.id).maybeSingle();

  return {
    phone: `${customer.phone.slice(0, 3)}-****-${customer.phone.slice(-4)}`,
    verified: customer.verified,
    name: me?.name ?? null,
    workplace: me?.workplace ?? null,
    jobCategory: me?.job_category ?? null,
    marketing: (subs ?? []).some((s) => s.marketing_consent_at),
    subscriptions: (subs ?? []).map((s) => ({
      track: s.track,
      status: s.status,
      plan: s.plan,
      paidUntil: s.paid_until,
      autoRenew: s.auto_renew,
      deliveryTime: String(s.delivery_time).slice(0, 5),
      nextSendAt: s.next_send_at,
      canResume: s.status === "active" && !s.auto_renew && Boolean(s.billing_key) && s.plan === "sub_30d" &&
        Boolean(s.paid_until) && new Date(s.paid_until).getTime() > now && !openRefundSubs.has(s.id),
    })),
    payments,
  };
}

export async function updateSettings(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  const time = body.time === undefined ? null : String(body.time);
  if (time !== null && (!/^([01][0-9]|2[0-2]):(00|30)$/.test(time) || time < "06:00" || time > "22:00")) {
    throw new PaymentError("받는 시간을 골라 주세요.", "invalid-time");
  }
  if (time !== null) assertTrack(body.track);
  const name = typeof body.name === "string" ? body.name : null;
  // The lesson messages need something to call them by.
  if (name !== null && name.trim() === "") throw new PaymentError("카톡에서 부를 이름을 적어 주세요.", "name-required");
  const marketing = typeof body.marketing === "boolean" ? body.marketing : null;

  // 소속 and 직종 (내 정보). An empty string clears one.
  const profile: Record<string, string | null> = {};
  if (typeof body.workplace === "string") profile.workplace = body.workplace.trim().slice(0, 60) || null;
  if (typeof body.jobCategory === "string") profile.job_category = body.jobCategory.trim().slice(0, 40) || null;
  if (Object.keys(profile).length > 0) {
    const { error } = await db.from("daily_customers").update(profile).eq("id", customer.id);
    if (error) throw new PaymentError("저장하지 못했어요. 다시 시도해 주세요.", "settings-failed", 500);
    if (time === null && name === null && marketing === null) return { success: true };
  }

  const { error } = await db.rpc("daily_update_settings", {
    p_customer_id: customer.id,
    p_track: typeof body.track === "string" ? body.track : null,
    p_time: time ? `${time}:00` : null,
    p_name: name,
    p_marketing: marketing,
  });
  if (error) throw new PaymentError("저장하지 못했어요. 다시 시도해 주세요.", "settings-failed", 500);
  return { success: true };
}

export async function resumeRenewal(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  assertTrack(body.track);
  const info = await accountInfo(db, customer);
  if (!info.subscriptions.some((s) => s.track === body.track && s.canResume)) {
    throw new PaymentError("자동 결제를 다시 켤 수 없어요.", "cannot-resume", 409);
  }
  const { error } = await db
    .from("daily_subscriptions")
    .update({ auto_renew: true, cancelled_at: null, renewal_failures: 0 })
    .eq("customer_id", customer.id)
    .eq("track", body.track)
    .eq("status", "active");
  if (error) throw new PaymentError("다시 켜지 못했어요. 다시 시도해 주세요.", "resume-failed", 500);
  return { success: true };
}

const REQUEST_ERRORS: Record<string, [string, number]> = {
  "order-missing": ["결제 내역을 찾을 수 없어요.", 404],
  "already-requested": ["이 결제는 이미 환불을 요청했어요.", 409],
  "nothing-to-refund": ["이 결제는 환불할 금액이 남아 있지 않아요.", 409],
};

type RefundOutcome = "refunded" | "failed" | "unknown";

async function customerOfRefund(db: SupabaseClient, refundId: string) {
  const { data } = await db.from("daily_refunds").select("customer:daily_customers(phone, name)").eq("id", refundId).maybeSingle();
  return (data as unknown as { customer: { phone: string | null; name: string | null } | null } | null)?.customer ?? null;
}

async function adminPhones(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("daily_config").select("admin_phones").eq("id", "settings").maybeSingle();
  return data?.admin_phones ?? [];
}

/**
 * Cancels a refund's amount through Payple right away, like the 1cup membership refund.
 * The request is claimed first (once), so a double click or a retry never refunds twice.
 *   refunded  Payple confirmed the cancel; the paid period shrinks (daily_finish_refund).
 *   failed    Payple refused it; it can be retried from /admin/daily-refunds.
 *   unknown   no answer from Payple; left "refunding" so it is never sent again until
 *             someone checks the Payple admin.
 */
async function processRefund(db: SupabaseClient, refundId: string, decidedBy: string): Promise<RefundOutcome> {
  const { data: claimed, error: claimError } = await db.rpc("daily_claim_refund", { p_refund_id: refundId, p_admin: decidedBy });
  if (claimError) throw new Error(`claim failed: ${claimError.message}`);
  const refund = claimed as { id: string | null; order_number: string; amount: number } | null;
  if (!refund?.id) throw new PaymentError("이미 처리 중이거나 처리된 환불이에요.", "not-open", 409);

  const { data: order } = await db
    .from("daily_orders")
    .select("order_number, charge_order_number, payment_result, completed_at, track, product_row:daily_products(name)")
    .eq("order_number", refund.order_number)
    .single();
  const productName = (order as unknown as { product_row: { name: string } | null } | null)?.product_row?.name ?? "";
  const label = `${isTrack(order?.track) ? TRACK_LABEL[order.track] : ""} ${productName} ${won(refund.amount)}`.replace(/\s+/g, " ").trim();

  let outcome: RefundOutcome;
  try {
    const result = await refundCharge({
      paymentResult: (order?.payment_result ?? {}) as Record<string, unknown>,
      fallbackOid: order?.charge_order_number || refund.order_number,
      completedAt: order?.completed_at,
      amount: refund.amount,
    });
    await db.rpc("daily_finish_refund", {
      p_refund_id: refund.id,
      p_success: result.ok,
      p_payment_result: result.data,
      p_error: result.ok ? null : result.message,
    });
    outcome = result.ok ? "refunded" : "failed";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("daily_refunds").update({ error: `no response from Payple: ${message}`.slice(0, 500) }).eq("id", refund.id);
    outcome = "unknown";
  }

  // The founder hears about every refund; the ones that did not go through need a look.
  const adminTitle = outcome === "refunded" ? `[Daily 환불 완료] ${label}` : `[Daily 환불 확인 필요] ${label}`;
  await notify(db, await adminPhones(db), adminTitle, "관리자", "/admin/daily-refunds");
  if (outcome === "refunded") {
    const customer = await customerOfRefund(db, refund.id);
    if (customer?.phone) {
      await notify(db, [customer.phone], `[영어 한잔 Daily] ${won(refund.amount)} 환불을 마쳤어요`, customer.name || "고객", "/daily/account");
    }
  }
  return outcome;
}

async function createRefund(db: SupabaseClient, customerId: string, orderNumber: string, reason: string) {
  const { data, error } = await db.rpc("daily_request_refund", {
    p_customer_id: customerId,
    p_order_number: orderNumber,
    p_reason: reason,
  });
  if (error) {
    const known = Object.keys(REQUEST_ERRORS).find((code) => error.message.includes(code));
    if (known) throw new PaymentError(REQUEST_ERRORS[known][0], known, REQUEST_ERRORS[known][1]);
    // The partial unique index: two requests for one order arrived together.
    if (error.code === "23505") throw new PaymentError(REQUEST_ERRORS["already-requested"][0], "already-requested", 409);
    throw new PaymentError("환불을 요청하지 못했어요. 다시 시도해 주세요.", "request-failed", 500);
  }
  return data as { id: string; amount: number; full_refund: boolean };
}

/** The customer's refund: priced from the terms and cancelled through Payple at once. */
export async function requestRefund(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber : "";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";
  const refund = await createRefund(db, customer.id, orderNumber, reason);
  const status = await processRefund(db, refund.id, "customer");
  return { success: true, refund: { amount: refund.amount, fullRefund: refund.full_refund, status } };
}

// The phrase typed to confirm, as on 1cup's own account deletion.
const DELETE_PHRASE = "계정 삭제";

const DELETE_ERRORS: Record<string, [string, number]> = {
  "refund-open": ["진행 중인 환불이 끝난 뒤에 삭제할 수 있어요.", 409],
  "billing-stop-required": ["계정을 삭제하기 전에 자동 결제를 해지해 주세요.", 409],
};

/**
 * Deletes the account after refunding what the terms still allow on every payment, the
 * way cancelling a 1cup membership refunds it. If any refund does not go through, the
 * account stays, so nobody loses the money by deleting.
 */
export async function deleteAccount(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  if (body.confirmation !== DELETE_PHRASE) {
    throw new PaymentError(`계속하려면 '${DELETE_PHRASE}'를 정확히 입력해 주세요.`, "confirmation-required");
  }
  // Refuse before refunding anything, so a refused deletion leaves payments as they were.
  const { data: renewing } = await db
    .from("daily_subscriptions")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("status", "active")
    .eq("auto_renew", true)
    .limit(1);
  if (renewing && renewing.length > 0) throw new PaymentError(DELETE_ERRORS["billing-stop-required"][0], "billing-stop-required", 409);

  const info = await accountInfo(db, customer);
  let refunded = 0;
  for (const payment of info.payments) {
    if (!payment.quote) continue;
    const refund = await createRefund(db, customer.id, payment.orderNumber, "계정 삭제");
    const outcome = await processRefund(db, refund.id, "customer");
    if (outcome !== "refunded") {
      throw new PaymentError(
        "환불을 마치지 못해서 계정을 삭제하지 않았어요. 확인한 뒤 다시 처리해 드릴게요.",
        "refund-before-delete-failed",
        502,
      );
    }
    refunded += refund.amount;
  }

  const { data, error } = await db.rpc("daily_delete_account", { p_customer_id: customer.id });
  if (error) {
    const known = Object.keys(DELETE_ERRORS).find((code) => error.message.includes(code));
    if (known) throw new PaymentError(DELETE_ERRORS[known][0], known, DELETE_ERRORS[known][1]);
    throw new PaymentError("계정을 삭제하지 못했어요. 다시 시도해 주세요.", "delete-failed", 500);
  }
  return { success: true, result: data as string, refunded };
}

// ---------------------------------------------------------------------------
// Admin (1cup staff)
// ---------------------------------------------------------------------------

export async function adminRefunds(db: SupabaseClient) {
  const { data, error } = await db
    .from("daily_refunds")
    .select(
      "id, amount, days_refunded, full_refund, reason, status, requested_at, decided_at, note, error, refunded_at, " +
        "order:daily_orders(order_number, kind, amount, track, completed_at, product_row:daily_products(name)), " +
        "customer:daily_customers(phone, name)",
    )
    .order("requested_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`refund list failed: ${error.message}`);
  return { refunds: data ?? [] };
}

/**
 * Refunds normally go out the moment they are requested. This is for the rest: retrying
 * one Payple refused ("failed"), or turning down a request that has not gone out.
 */
export async function adminDecideRefund(db: SupabaseClient, adminUid: string, body: Record<string, unknown>) {
  const id = typeof body.id === "string" ? body.id : "";
  const note = typeof body.note === "string" ? body.note : "";

  if (body.decision === "reject") {
    const { data: rejected, error } = await db.rpc("daily_reject_refund", { p_refund_id: id, p_admin: adminUid, p_note: note });
    if (error) throw new Error(`reject failed: ${error.message}`);
    if (!rejected) throw new PaymentError("이미 처리된 요청이에요.", "not-open", 409);
    const customer = await customerOfRefund(db, id);
    if (customer?.phone) {
      await notify(db, [customer.phone], "[영어 한잔 Daily] 환불 요청 결과를 확인해 주세요", customer.name || "고객", "/daily/account");
    }
    return { success: true, status: "rejected" };
  }
  if (body.decision !== "approve") throw new PaymentError("approve 또는 reject를 골라 주세요.", "invalid-decision");

  const outcome = await processRefund(db, id, adminUid);
  if (outcome === "unknown") {
    throw new PaymentError("페이플 응답을 받지 못했어요. 페이플 관리자에서 취소 여부를 확인해 주세요.", "refund-unknown", 502);
  }
  if (outcome === "failed") throw new PaymentError("페이플이 환불을 거절했어요. 사유를 확인한 뒤 다시 시도해 주세요.", "refund-failed", 502);
  return { success: true, status: "refunded" };
}
