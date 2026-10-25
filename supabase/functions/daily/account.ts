// The Daily account page (/daily/account) and refund approvals (/admin/daily-refunds).
//
// Customers change their own settings and ask for refunds; nothing moves money until a
// 1cup staff admin approves the request. Pricing, the single-request rule and what a
// refund does to the subscription all live in the 20261026020000_daily_account
// migration, so this file only validates input, calls those functions, talks to Payple
// and sends the notices.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendKakaoMessages } from "../_shared/kakao.ts";
import { templateCodes } from "./delivery.ts";
import { PaymentError, refundCharge, type PaymentCustomer } from "./payments.ts";

const SITE_HOST = (Deno.env.get("DAILY_SITE_URL") || "https://1cupenglish.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const TRACK_LABEL: Record<string, string> = { business: "비즈니스 영어", tech: "테크 영어" };
const OPEN_REFUND = ["requested", "refunding"];

function won(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function assertTrack(track: unknown): asserts track is "business" | "tech" {
  if (track !== "business" && track !== "tech") throw new PaymentError("트랙을 골라 주세요.", "invalid-track");
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
  const { data: me } = await db.from("daily_customers").select("name").eq("id", customer.id).maybeSingle();

  return {
    phone: `${customer.phone.slice(0, 3)}-****-${customer.phone.slice(-4)}`,
    verified: customer.verified,
    name: me?.name ?? null,
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
  const marketing = typeof body.marketing === "boolean" ? body.marketing : null;
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

export async function requestRefund(db: SupabaseClient, customer: PaymentCustomer, body: Record<string, unknown>) {
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber : "";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";
  const { data, error } = await db.rpc("daily_request_refund", {
    p_customer_id: customer.id,
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
  const refund = data as { id: string; amount: number; full_refund: boolean };

  const [{ data: order }, { data: config }] = await Promise.all([
    db.from("daily_orders").select("track, product_row:daily_products(name)").eq("order_number", orderNumber).maybeSingle(),
    db.from("daily_config").select("admin_phones").eq("id", "settings").maybeSingle(),
  ]);
  const productName = (order as unknown as { product_row: { name: string } | null } | null)?.product_row?.name ?? "";
  await notify(
    db,
    config?.admin_phones ?? [],
    `[Daily 환불 요청] ${TRACK_LABEL[order?.track ?? ""] ?? ""} ${productName} ${won(refund.amount)}`.replace(/\s+/g, " "),
    "관리자",
    "/admin/daily-refunds",
  );
  return { success: true, refund: { amount: refund.amount, fullRefund: refund.full_refund } };
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

export async function adminDecideRefund(db: SupabaseClient, adminUid: string, body: Record<string, unknown>) {
  const id = typeof body.id === "string" ? body.id : "";
  const note = typeof body.note === "string" ? body.note : "";

  const customerPhoneFor = async (refundId: string) => {
    const { data } = await db.from("daily_refunds").select("customer:daily_customers(phone, name)").eq("id", refundId).maybeSingle();
    return (data as unknown as { customer: { phone: string; name: string | null } | null } | null)?.customer ?? null;
  };

  if (body.decision === "reject") {
    const { data: rejected, error } = await db.rpc("daily_reject_refund", { p_refund_id: id, p_admin: adminUid, p_note: note });
    if (error) throw new Error(`reject failed: ${error.message}`);
    if (!rejected) throw new PaymentError("이미 처리된 요청이에요.", "not-open", 409);
    const customer = await customerPhoneFor(id);
    if (customer) {
      await notify(db, [customer.phone], "[영어 한잔 Daily] 환불 요청 결과를 확인해 주세요", customer.name || "고객", "/daily/account");
    }
    return { success: true, status: "rejected" };
  }
  if (body.decision !== "approve") throw new PaymentError("approve 또는 reject를 골라 주세요.", "invalid-decision");

  const { data: claimed, error: claimError } = await db.rpc("daily_claim_refund", { p_refund_id: id, p_admin: adminUid });
  if (claimError) throw new Error(`claim failed: ${claimError.message}`);
  const refund = claimed as { id: string | null; order_number: string; amount: number } | null;
  if (!refund?.id) throw new PaymentError("이미 처리 중이거나 처리된 요청이에요.", "not-open", 409);

  const { data: order } = await db
    .from("daily_orders")
    .select("order_number, charge_order_number, payment_result, completed_at")
    .eq("order_number", refund.order_number)
    .single();

  let result;
  try {
    result = await refundCharge({
      paymentResult: (order?.payment_result ?? {}) as Record<string, unknown>,
      fallbackOid: order?.charge_order_number || refund.order_number,
      completedAt: order?.completed_at,
      amount: refund.amount,
    });
  } catch (e) {
    // No answer from Payple: the cancel may or may not have happened. Leave the request
    // in "refunding" so it cannot be sent again, and say so; check the Payple admin.
    const message = e instanceof Error ? e.message : String(e);
    await db.from("daily_refunds").update({ error: `no response from Payple: ${message}`.slice(0, 500) }).eq("id", refund.id);
    throw new PaymentError("페이플 응답을 받지 못했어요. 페이플 관리자에서 취소 여부를 확인해 주세요.", "refund-unknown", 502);
  }

  await db.rpc("daily_finish_refund", {
    p_refund_id: refund.id,
    p_success: result.ok,
    p_payment_result: result.data,
    p_error: result.ok ? null : result.message,
  });
  if (!result.ok) throw new PaymentError(`환불하지 못했어요: ${result.message}`, "refund-failed", 502);

  const customer = await customerPhoneFor(refund.id);
  if (customer) {
    await notify(db, [customer.phone], `[영어 한잔 Daily] ${won(refund.amount)} 환불을 마쳤어요`, customer.name || "고객", "/daily/account");
  }
  return { success: true, status: "refunded" };
}
