import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid } from "../_shared/db.ts";
import { krPhone, sendKakaoMessages } from "../_shared/kakao.ts";

type Region = "anam" | "yeouido";
type ProductId = "membership_30d" | "participation_pack_5";

type ProductRow = {
  product_id: ProductId;
  region: Region;
  display_name: string;
  list_amount: number | string;
  referral_discount_amount: number | string;
  recurring: boolean;
  credit_quantity: number | null;
  validity_days: number | null;
  active: boolean;
};

class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "internal") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required Edge Function secret: ${name}`);
  return value;
}

const PAYPLE_CST_ID = requiredEnv("PAYPLE_CST_ID");
const PAYPLE_CUST_KEY = requiredEnv("PAYPLE_CUST_KEY");
const PAYPLE_CLIENT_KEY = requiredEnv("PAYPLE_CLIENT_KEY");
const PAYPLE_REFUND_KEY = requiredEnv("PAYPLE_REFUND_KEY");
const PAYPLE_HOST = (Deno.env.get("PAYPLE_HOST") || "https://cpay.payple.kr").replace(/\/+$/, "");
const PAYPLE_AUTH_URL = Deno.env.get("PAYPLE_AUTH_URL") || `${PAYPLE_HOST}/php/auth.php`;
const PAYPLE_HOSTNAME = Deno.env.get("PAYPLE_HOSTNAME") || "https://1cupenglish.com";
const PAYPLE_FRONTEND_URL = (Deno.env.get("PAYPLE_FRONTEND_URL") || PAYPLE_HOSTNAME).replace(/\/+$/, "");
const DAY_MS = 24 * 60 * 60 * 1000;

function asRegion(value: unknown): Region {
  if (value === "anam" || value === "yeouido") return value;
  throw new ApiError("지역을 선택해주세요.", 400, "invalid-region");
}

function asProductId(value: unknown): ProductId {
  if (value === "membership_30d" || value === "participation_pack_5") return value;
  throw new ApiError("상품을 선택해주세요.", 400, "invalid-product");
}

function formatYyyyMMdd(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

async function generateNumericPayerNo(source: string, desiredLength = 12): Promise<string> {
  const bytes = new TextEncoder().encode(source);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  let digits = "";
  for (let i = 0; i < digest.length && digits.length < desiredLength; i++) {
    digits += (digest[i] % 10).toString();
  }
  return digits.padEnd(desiredLength, "0").slice(0, desiredLength);
}

async function getProduct(productId: ProductId, region: Region): Promise<ProductRow> {
  const { data, error } = await admin()
    .from("payment_products")
    .select("product_id, region, display_name, list_amount, referral_discount_amount, recurring, credit_quantity, validity_days, active")
    .eq("product_id", productId)
    .eq("region", region)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500, "product-query-failed");
  if (!data) throw new ApiError("판매 중인 상품을 찾을 수 없습니다.", 404, "product-not-found");
  return data as ProductRow;
}

async function userHasPaidBefore(uid: string): Promise<boolean> {
  const { data, error } = await admin()
    .from("payment_orders")
    .select("order_number")
    .eq("user_id", uid)
    .eq("status", "completed")
    .in("type", ["subscription_initial_payment", "subscription_recurring", "participation_pack_purchase"])
    .limit(1);
  if (error) throw new ApiError(error.message, 500, "payment-history-failed");
  return (data?.length ?? 0) > 0;
}

async function quoteReferral(uid: string, code: string, product: ProductRow) {
  const normalized = code.trim();
  if (!normalized) {
    return { valid: false, discountAmount: 0, finalAmount: Number(product.list_amount), message: "추천 코드를 입력해주세요." };
  }
  const a = admin();
  const { data: referral, error } = await a
    .from("referral_codes")
    .select("code, active, referrer, discount, type")
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw new ApiError(error.message, 500, "referral-query-failed");
  if (!referral || !referral.active) {
    return { valid: false, discountAmount: 0, finalAmount: Number(product.list_amount), message: "유효하지 않거나 만료된 추천 코드입니다." };
  }
  if (referral.referrer && referral.referrer === uid) {
    return { valid: false, discountAmount: 0, finalAmount: Number(product.list_amount), message: "본인의 추천 코드는 사용할 수 없습니다." };
  }
  if (await userHasPaidBefore(uid)) {
    return { valid: false, discountAmount: 0, finalAmount: Number(product.list_amount), message: "추천 코드는 첫 유료 구매에만 사용할 수 있습니다." };
  }

  const { data: generatedOwner, error: generatedOwnerError } = await a
    .from("users")
    .select("uid")
    .eq("referral_code", referral.code)
    .limit(1)
    .maybeSingle();
  if (generatedOwnerError) {
    throw new ApiError(generatedOwnerError.message, 500, "referral-owner-query-failed");
  }

  const listAmount = Number(product.list_amount);
  let discountAmount: number;
  let message: string;
  if (generatedOwner) {
    discountAmount = Math.min(Number(product.referral_discount_amount || 0), listAmount);
    message = "첫 구매 추천 할인이 적용되었습니다.";
  } else {
    const configuredDiscount = Math.max(0, Number(referral.discount || 0));
    const rawDiscount =
      referral.type === "percent"
        ? Math.floor(listAmount * (configuredDiscount / 100))
        : configuredDiscount;
    discountAmount = Math.min(rawDiscount, listAmount);
    message = "운영 할인 코드가 적용되었습니다.";
  }

  return {
    valid: true,
    discountAmount,
    finalAmount: listAmount - discountAmount,
    message,
  };
}

async function quoteManagedDiscount(
  uid: string,
  code: string,
  productId: ProductId,
  region: Region,
  product: ProductRow,
) {
  const { data, error } = await admin().rpc("quote_checkout_discount_code", {
    p_user_id: uid,
    p_code: code,
    p_product_id: productId,
    p_region: region,
    p_list_amount: Number(product.list_amount),
  });
  if (error) throw new ApiError(error.message, 500, "discount-code-query-failed");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code_found) return null;
  return {
    valid: Boolean(row.valid),
    discountAmount: Number(row.discount_amount || 0),
    finalAmount: Number(row.final_amount ?? product.list_amount),
    message: String(row.message || "할인 코드를 사용할 수 없습니다."),
    kind: "discount" as const,
    code: String(row.code || code).trim(),
  };
}

async function quoteCheckoutCode(
  uid: string,
  code: string,
  productId: ProductId,
  region: Region,
  product: ProductRow,
) {
  const managed = await quoteManagedDiscount(uid, code, productId, region, product);
  if (managed) return managed;

  const referral = await quoteReferral(uid, code, product);
  return {
    ...referral,
    kind: "referral" as const,
    code: code.trim(),
  };
}

async function getPaypleAuthToken(isCancel = false) {
  const response = await fetch(PAYPLE_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      referer: PAYPLE_HOSTNAME,
    },
    body: JSON.stringify({
      cst_id: PAYPLE_CST_ID,
      custKey: PAYPLE_CUST_KEY,
      PCD_PAY_TYPE: "card",
      PCD_SIMPLE_FLAG: "Y",
      PCD_PAY_WORK: "CERT",
      PCD_PAYCANCEL_FLAG: isCancel ? "Y" : "N",
    }),
  });
  const data = await response.json();
  if (data?.result !== "success") {
    throw new ApiError(data?.result_msg || "페이플 인증에 실패했습니다.", 502, "payple-auth-failed");
  }
  return data;
}

function payplePaymentUrl(auth: Record<string, any>): string {
  if (auth.PCD_PAY_HOST && auth.PCD_PAY_URL) return `${auth.PCD_PAY_HOST}${auth.PCD_PAY_URL}`;
  return `${PAYPLE_HOST}/php/SimplePayCardAct.php?ACT_=PAYM`;
}

async function listProducts() {
  const { data, error } = await admin()
    .from("payment_products")
    .select("product_id, region, display_name, list_amount, referral_discount_amount, recurring, credit_quantity, validity_days")
    .eq("active", true)
    .order("region")
    .order("product_id");
  if (error) throw new ApiError(error.message, 500, "product-query-failed");
  return {
    success: true,
    products: (data ?? []).map((row: any) => ({
      id: row.product_id,
      region: row.region,
      displayName: row.display_name,
      price: Number(row.list_amount),
      referralPrice: Math.max(0, Number(row.list_amount) - Number(row.referral_discount_amount || 0)),
      referralDiscountAmount: Number(row.referral_discount_amount || 0),
      recurring: Boolean(row.recurring),
      credits: row.credit_quantity == null ? undefined : Number(row.credit_quantity),
      validityDays: row.validity_days == null ? undefined : Number(row.validity_days),
    })),
  };
}

async function quote(uid: string, body: Record<string, unknown>) {
  const productId = asProductId(body.productId);
  const region = asRegion(body.region);
  const product = await getProduct(productId, region);
  const code = typeof body.referralCode === "string" ? body.referralCode.trim() : "";
  if (!code) {
    return {
      success: true,
      validReferral: false,
      listAmount: Number(product.list_amount),
      discountAmount: 0,
      finalAmount: Number(product.list_amount),
      message: "일반 가격입니다.",
    };
  }
  const codeQuote = await quoteCheckoutCode(uid, code, productId, region, product);
  return {
    success: true,
    validReferral: codeQuote.valid,
    listAmount: Number(product.list_amount),
    discountAmount: codeQuote.discountAmount,
    finalAmount: codeQuote.finalAmount,
    message: codeQuote.message,
  };
}

async function recoverPendingParticipationPack(uid: string, region: Region) {
  const a = admin();
  const { data: orders, error } = await a
    .from("payment_orders")
    .select("*")
    .eq("user_id", uid)
    .eq("type", "checkout_auth")
    .eq("product_id", "participation_pack_5")
    .eq("region", region)
    .eq("status", "charging")
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) throw new ApiError(error.message, 500, "recoverable-order-query-failed");

  for (const order of orders ?? []) {
    const payData = order.payment_result as Record<string, any> | null;
    if (payData?.PCD_PAY_RST !== "success" || !order.fulfillment_order_number) continue;

    const { data: cancellation, error: cancellationError } = await a
      .from("payment_cancellations")
      .select("id")
      .eq("user_id", uid)
      .eq("original_order_id", order.fulfillment_order_number)
      .in("status", ["completed", "completed_pending_credit_reversal"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cancellationError) throw new ApiError(cancellationError.message, 500, "cancellation-query-failed");
    if (cancellation) continue;

    const result = await settleSuccessfulCharge(
      uid,
      order,
      payData,
      String(order.billing_key_used || ""),
    );
    return { orderNumber: String(order.order_number), result };
  }
  return null;
}

async function createPaymentWindow(uid: string, body: Record<string, unknown>) {
  const productId = asProductId(body.productId);
  const region = asRegion(body.region);
  const product = await getProduct(productId, region);
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  const userName = typeof body.userName === "string" ? body.userName.trim() : "";
  const referralCode = typeof body.referralCode === "string" ? body.referralCode.trim() : "";
  const a = admin();

  const { data: user, error: userError } = await a
    .from("users")
    .select("uid, display_name, phone, has_active_subscription")
    .eq("uid", uid)
    .maybeSingle();
  if (userError) throw new ApiError(userError.message, 500, "user-query-failed");
  if (!user) throw new ApiError("회원 정보를 찾을 수 없습니다.", 404, "user-not-found");
  if (product.recurring && user.has_active_subscription) {
    throw new ApiError("이미 30일 이용권을 사용 중입니다.", 409, "already-subscribed");
  }

  if (productId === "participation_pack_5") {
    const recovered = await recoverPendingParticipationPack(uid, region);
    if (recovered) {
      return {
        success: true,
        recovered: true,
        orderNumber: recovered.orderNumber,
        result: recovered.result,
        product: {
          id: productId,
          region,
          price: Number(product.list_amount),
          listAmount: Number(product.list_amount),
          discountAmount: 0,
          credits: product.credit_quantity ?? undefined,
          validityDays: product.validity_days ?? undefined,
        },
      };
    }
  }

  let discountAmount = 0;
  let finalAmount = Number(product.list_amount);
  let appliedReferralCode: string | null = null;
  let appliedDiscountCode: string | null = null;
  if (referralCode) {
    const codeQuote = await quoteCheckoutCode(uid, referralCode, productId, region, product);
    if (!codeQuote.valid) throw new ApiError(codeQuote.message, 400, "invalid-discount-code");
    discountAmount = codeQuote.discountAmount;
    finalAmount = codeQuote.finalAmount;
    if (codeQuote.kind === "discount") {
      appliedDiscountCode = codeQuote.code;
    } else {
      appliedReferralCode = codeQuote.code;
    }
  }

  const now = new Date();
  const ymd = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
  const orderNumber = `OCEV2${ymd}${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
  const phone = krPhone((user.phone as string | null) || "");
  const validPhone = /^01\d{8,9}$/.test(phone) ? phone : "";
  const displayName = userName || String(user.display_name || "구독자");
  const regionLabel = region === "yeouido" ? "여의도" : "안암";
  const paymentParams = {
    clientKey: PAYPLE_CLIENT_KEY,
    PCD_PAY_TYPE: "card",
    PCD_PAY_WORK: "CERT",
    PCD_CARD_VER: "01",
    PCD_PAY_GOODS: `${product.display_name} (${regionLabel})`,
    PCD_PAY_TOTAL: finalAmount,
    PCD_REGULER_FLAG: product.recurring ? "Y" : "N",
    PCD_SIMPLE_FLAG: "Y",
    PCD_PAY_OID: orderNumber,
    PCD_PAY_YEAR: now.getFullYear().toString(),
    PCD_PAY_MONTH: (now.getMonth() + 1).toString().padStart(2, "0"),
    PCD_PAYER_NO: await generateNumericPayerNo(uid),
    PCD_PAYER_NAME: displayName,
    PCD_PAYER_EMAIL: userEmail,
    PCD_PAYER_HP: validPhone,
    PCD_RST_URL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/checkout/callback`,
    PCD_PAYER_AUTHTYPE: "sms",
    PCD_USER_DEFINE1: uid,
    PCD_USER_DEFINE2: JSON.stringify({ product_id: productId, region }),
    PCD_SIMPLE_FNAME: "payment-result",
  };

  const creditValidUntil = productId === "participation_pack_5"
    ? new Date(now.getTime() + Number(product.validity_days || 180) * DAY_MS).toISOString()
    : null;

  const { error: insertError } = await a.from("payment_orders").insert({
    order_number: orderNumber,
    user_id: uid,
    amount: finalAmount,
    list_amount: Number(product.list_amount),
    discount_amount: discountAmount,
    status: "pending_auth",
    type: "checkout_auth",
    product_id: productId,
    region,
    pricing_version: "regional_v2",
    referral_code: appliedReferralCode,
    discount_code: appliedDiscountCode,
    order_date: now.toISOString(),
    credit_quantity: productId === "participation_pack_5" ? Number(product.credit_quantity || 5) : null,
    credit_valid_until: creditValidUntil,
    selected_categories: { product_id: productId, region },
  });
  if (insertError) throw new ApiError(insertError.message, 500, "order-create-failed");

  return {
    success: true,
    paymentParams,
    orderNumber,
    product: {
      id: productId,
      region,
      price: finalAmount,
      listAmount: Number(product.list_amount),
      discountAmount,
      credits: product.credit_quantity ?? undefined,
      validityDays: product.validity_days ?? undefined,
    },
  };
}


type BillingStatusResult = {
  success: true;
  hasActiveSubscription: boolean;
  billingCancelled: boolean;
  subscriptionEndDate: string | null;
  hasBillingKey: boolean;
  needsAttention: boolean;
  consecutiveFailures: number;
  lastFailure: {
    code: string | null;
    message: string | null;
    failedAt: string | null;
  } | null;
  cardName: string | null;
  retryPending: boolean;
  lastCardUpdateAt: string | null;
};

async function billingStatus(uid: string): Promise<BillingStatusResult> {
  const a = admin();
  const { data: user, error: userError } = await a
    .from("users")
    .select("has_active_subscription, billing_cancelled, subscription_end_date, billing_key")
    .eq("uid", uid)
    .maybeSingle();
  if (userError) throw new ApiError(userError.message, 500, "user-query-failed");
  if (!user) throw new ApiError("회원 정보를 찾을 수 없습니다.", 404, "user-not-found");

  const { data: orders, error: orderError } = await a
    .from("payment_orders")
    .select("status, type, error_code, error_message, failed_at, completed_at, payment_result, created_at")
    .eq("user_id", uid)
    .in("type", ["subscription_recurring", "subscription_initial_payment", "billing_method_update"])
    .order("created_at", { ascending: false })
    .limit(30);
  if (orderError) throw new ApiError(orderError.message, 500, "billing-status-query-failed");

  const rows = orders ?? [];
  const latestRecurring = rows.find((row: any) => row.type === "subscription_recurring") as any | undefined;
  const latestCompletedCardUpdate = rows.find(
    (row: any) => row.type === "billing_method_update" && row.status === "completed",
  ) as any | undefined;

  const latestRecurringFailureAt =
    latestRecurring?.status === "failed"
      ? new Date(latestRecurring.failed_at || latestRecurring.created_at || 0).getTime()
      : 0;
  const latestCardUpdateAt = latestCompletedCardUpdate
    ? new Date(latestCompletedCardUpdate.completed_at || latestCompletedCardUpdate.created_at || 0).getTime()
    : 0;

  // A successful card update after the last failed renewal resolves the old-card problem.
  // The charge itself has not succeeded yet, so we show "retry pending" rather than
  // continuing to alarm the member about a failure they already fixed.
  const unresolvedFailure =
    latestRecurring?.status === "failed" &&
    !(latestCardUpdateAt > latestRecurringFailureAt);

  let consecutiveFailures = 0;
  if (unresolvedFailure) {
    for (const row of rows) {
      if (row.type !== "subscription_recurring") continue;
      if (row.status === "failed") {
        consecutiveFailures += 1;
        continue;
      }
      if (row.status === "completed") break;
    }
  }

  const latestSuccessfulPayment = rows.find(
    (row: any) =>
      row.status === "completed" &&
      (row.type === "subscription_recurring" || row.type === "subscription_initial_payment"),
  ) as any | undefined;
  const cardSource = latestCompletedCardUpdate || latestSuccessfulPayment;
  const cardName =
    typeof cardSource?.payment_result?.PCD_PAY_CARDNAME === "string"
      ? cardSource.payment_result.PCD_PAY_CARDNAME
      : null;

  const hasBillingKey = typeof user.billing_key === "string" && user.billing_key.length > 0;
  const subscriptionEndAt = user.subscription_end_date
    ? new Date(user.subscription_end_date as string).getTime()
    : 0;
  const retryPending =
    user.has_active_subscription === true &&
    user.billing_cancelled !== true &&
    hasBillingKey &&
    !unresolvedFailure &&
    subscriptionEndAt > 0 &&
    subscriptionEndAt <= Date.now();

  return {
    success: true,
    hasActiveSubscription: user.has_active_subscription === true,
    billingCancelled: user.billing_cancelled === true,
    subscriptionEndDate: user.subscription_end_date ?? null,
    hasBillingKey,
    needsAttention:
      user.has_active_subscription === true &&
      user.billing_cancelled !== true &&
      (!hasBillingKey || unresolvedFailure),
    consecutiveFailures,
    lastFailure: unresolvedFailure
      ? {
          code: latestRecurring.error_code ?? null,
          message: latestRecurring.error_message ?? null,
          failedAt: latestRecurring.failed_at ?? null,
        }
      : null,
    cardName,
    retryPending,
    lastCardUpdateAt: latestCompletedCardUpdate?.completed_at ?? null,
  };
}

async function createBillingMethodUpdateWindow(uid: string, body: Record<string, unknown>) {
  const a = admin();
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  const userName = typeof body.userName === "string" ? body.userName.trim() : "";
  const { data: user, error: userError } = await a
    .from("users")
    .select("uid, display_name, phone, has_active_subscription, billing_cancelled, plan_price, pricing_version, location")
    .eq("uid", uid)
    .maybeSingle();
  if (userError) throw new ApiError(userError.message, 500, "user-query-failed");
  if (!user) throw new ApiError("회원 정보를 찾을 수 없습니다.", 404, "user-not-found");
  if (!user.has_active_subscription) {
    throw new ApiError(
      "활성 멤버십이 없습니다. 멤버십을 다시 시작하면서 새 카드를 등록해주세요.",
      409,
      "no-active-membership",
    );
  }

  const now = new Date();
  const ymd = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
  const orderNumber = `OCECARD${ymd}${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
  const phone = krPhone((user.phone as string | null) || "");
  const validPhone = /^01\d{8,9}$/.test(phone) ? phone : "";
  const displayName = userName || String(user.display_name || "구독자");
  const planPriceRaw = Number(user.plan_price);
  const planPrice = Number.isFinite(planPriceRaw) && planPriceRaw > 0 ? planPriceRaw : 4700;
  const region = user.location === "anam" || user.location === "yeouido" ? user.location : null;

  // Payple documents AUTH as the card-registration-only flow. It returns a new billing
  // key without approving a charge. The actual recurring charge remains the scheduler's
  // responsibility, so updating a card never extends the paid period or double-charges.
  const paymentParams = {
    clientKey: PAYPLE_CLIENT_KEY,
    PCD_PAY_TYPE: "card",
    PCD_PAY_WORK: "AUTH",
    PCD_CARD_VER: "01",
    PCD_PAY_GOODS: "One Cup English 정기결제 카드 변경",
    PCD_PAY_TOTAL: planPrice,
    PCD_SIMPLE_FLAG: "Y",
    PCD_PAY_OID: orderNumber,
    PCD_PAYER_NO: await generateNumericPayerNo(uid),
    PCD_PAYER_NAME: displayName,
    PCD_PAYER_EMAIL: userEmail,
    PCD_PAYER_HP: validPhone,
    PCD_RST_URL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/checkout/callback`,
    PCD_PAYER_AUTHTYPE: "sms",
    PCD_USER_DEFINE1: uid,
    // AUTH registration responses do not reliably echo PCD_PAY_OID. Keep the
    // server-created order number in Payple's round-tripped user metadata so the
    // callback can be reconciled even after a full-page redirect on mobile Safari.
    PCD_USER_DEFINE2: JSON.stringify({
      purpose: "billing_method_update",
      orderNumber,
    }),
    PCD_SIMPLE_FNAME: "payment-result",
  };

  const { error: insertError } = await a.from("payment_orders").insert({
    order_number: orderNumber,
    user_id: uid,
    amount: planPrice,
    list_amount: planPrice,
    discount_amount: 0,
    status: "pending_auth",
    type: "billing_method_update",
    product_id: "membership_30d",
    region,
    pricing_version: user.pricing_version || "billing_method_update_v1",
    order_date: now.toISOString(),
    selected_categories: { purpose: "billing_method_update", orderNumber },
  });
  if (insertError) throw new ApiError(insertError.message, 500, "order-create-failed");

  return {
    success: true,
    paymentParams,
    orderNumber,
    billingCancelled: user.billing_cancelled === true,
  };
}

async function settleSuccessfulCharge(uid: string, order: any, payData: Record<string, any>, billingKey: string) {
  const a = admin();
  if (order.product_id === "participation_pack_5") {
    const { data, error } = await a.rpc("complete_participation_pack_payment", {
      p_authorization_order_id: order.order_number,
      p_user_id: uid,
      p_payment_result: payData,
      p_payment_method: "card",
    });
    if (error) throw new ApiError(error.message, 500, "pack-settlement-failed");
    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: true,
      message: "5회 이용권 구매가 완료되었습니다.",
      productType: "participation_pack_purchase",
      creditBalance: Number(row?.credit_balance ?? 0),
      creditsGranted: Number(row?.credit_quantity ?? 5),
      creditExpiresAt: row?.expires_at ?? null,
      data: payData,
    };
  }

  const { data, error } = await a.rpc("complete_membership_checkout_payment", {
    p_authorization_order_id: order.order_number,
    p_user_id: uid,
    p_payment_result: payData,
    p_billing_key: billingKey,
    p_payment_method: "card",
  });
  if (error) throw new ApiError(error.message, 500, "membership-settlement-failed");

  try {
    const { data: user } = await a.from("users").select("phone, display_name").eq("uid", uid).maybeSingle();
    const phone = krPhone(user?.phone || "");
    if (/^01\d{8,9}$/.test(phone)) {
      await sendKakaoMessages([
        {
          recipientNo: phone,
          templateParameter: {
            "customer-name": String(user?.display_name || "고객").trim() || "고객",
            link: "https://1cupenglish.com/guide",
          },
        },
      ], "order-received");
    }
  } catch (error) {
    console.error("checkout confirmation message failed", error);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: true,
    message: "30일 이용권 결제가 완료되었습니다.",
    productType: "subscription_initial_payment",
    subscriptionEndDate: row?.subscription_end_date ?? null,
    data: payData,
  };
}

function parsePaymentMetadata(paymentParams: Record<string, any>): Record<string, unknown> {
  const raw = paymentParams.PCD_USER_DEFINE2;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function verifyPayment(uid: string, body: Record<string, unknown>) {
  const paymentParams = body.paymentParams as Record<string, any> | undefined;
  if (!paymentParams) throw new ApiError("결제 결과가 없습니다.", 400, "missing-payment-result");

  const paymentMetadata = parsePaymentMetadata(paymentParams);
  const metadataOrderNumber =
    typeof paymentMetadata.orderNumber === "string"
      ? paymentMetadata.orderNumber.trim()
      : "";
  const sessionOrderNumber =
    typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";

  // CERT returns PCD_PAY_OID, while Payple AUTH card-registration responses may omit it.
  // For AUTH, recover the server-created order from round-tripped metadata; the browser
  // session value is only a final fallback. The DB query below still binds the order to
  // the authenticated uid, so a caller cannot select another member's order.
  const authorizationOrderNumber = String(
    paymentParams.PCD_PAY_OID || metadataOrderNumber || sessionOrderNumber || "",
  ).trim();
  if (!authorizationOrderNumber) {
    throw new ApiError(
      "카드 등록 결과의 주문번호를 확인할 수 없습니다. 다시 시도해주세요.",
      400,
      "missing-order",
    );
  }
  if (paymentParams.PCD_PAY_RST !== "success") {
    await admin().from("payment_orders").update({
      status: "failed",
      error_code: paymentParams.PCD_PAY_CODE || "unknown",
      error_message: paymentParams.PCD_PAY_MSG || "결제 인증 실패",
      payple_response: paymentParams,
      failed_at: new Date().toISOString(),
    }).eq("order_number", authorizationOrderNumber).eq("user_id", uid);
    throw new ApiError(paymentParams.PCD_PAY_MSG || "결제 인증에 실패했습니다.", 400, "payple-cert-failed");
  }

  const a = admin();
  const { data: order, error: orderError } = await a
    .from("payment_orders")
    .select("*")
    .eq("order_number", authorizationOrderNumber)
    .eq("user_id", uid)
    .maybeSingle();
  if (orderError) throw new ApiError(orderError.message, 500, "order-query-failed");
  if (!order) throw new ApiError("결제 주문을 찾을 수 없습니다.", 404, "order-not-found");
  if (order.type !== "checkout_auth" && order.type !== "billing_method_update") {
    throw new ApiError("지원하지 않는 결제 주문입니다.", 409, "invalid-order-type");
  }

  if (order.type === "billing_method_update") {
    const purpose =
      typeof paymentMetadata.purpose === "string" ? paymentMetadata.purpose : "";
    if (purpose && purpose !== "billing_method_update") {
      throw new ApiError("카드 변경 요청 정보가 일치하지 않습니다.", 409, "billing-update-metadata-mismatch");
    }
  }

  const billingKey = String(paymentParams.PCD_PAYER_ID || paymentParams.PCD_CARD_BILLKEY || order.billing_key_used || "");
  if (!billingKey) throw new ApiError("결제용 빌링키를 확인할 수 없습니다.", 500, "missing-billing-key");

  if (order.type === "billing_method_update") {
    if (order.status === "completed") {
      return {
        success: true,
        message: "결제수단이 변경되었습니다.",
        productType: "billing_method_update",
        data: order.payment_result || paymentParams,
      };
    }
    if (order.status !== "pending_auth") {
      throw new ApiError("이 카드 변경 요청은 더 이상 사용할 수 없습니다.", 409, "invalid-order-state");
    }

    const { error: userUpdateError } = await a
      .from("users")
      .update({
        billing_key: billingKey,
        payment_method: "card",
      })
      .eq("uid", uid);
    if (userUpdateError) throw new ApiError(userUpdateError.message, 500, "billing-key-update-failed");

    const { error: orderUpdateError } = await a
      .from("payment_orders")
      .update({
        status: "completed",
        billing_key_used: billingKey,
        payment_method: "card",
        payment_result: paymentParams,
        payple_response: paymentParams,
        error_code: null,
        error_message: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("order_number", order.order_number)
      .eq("user_id", uid);
    if (orderUpdateError) throw new ApiError(orderUpdateError.message, 500, "billing-update-order-failed");

    return {
      success: true,
      message: "결제수단이 변경되었습니다. 다음 자동결제부터 새 카드가 사용됩니다.",
      productType: "billing_method_update",
      data: paymentParams,
    };
  }

  if (order.status === "completed") {
    if (order.product_id === "participation_pack_5") {
      const { data: balance } = await a.from("participation_credit_balances").select("balance").eq("user_id", uid).maybeSingle();
      return { success: true, productType: "participation_pack_purchase", creditBalance: Number(balance?.balance ?? 0), data: order.payment_result || paymentParams };
    }
    return { success: true, productType: "subscription_initial_payment", data: order.payment_result || paymentParams };
  }

  if (order.status === "charging" && order.payment_result?.PCD_PAY_RST === "success") {
    return await settleSuccessfulCharge(uid, order, order.payment_result, String(order.billing_key_used || billingKey));
  }
  if (order.status === "charging") {
    throw new ApiError("결제가 이미 처리 중입니다. 잠시 후 결제 내역을 확인해주세요.", 409, "payment-processing");
  }
  if (order.status !== "pending_auth") {
    throw new ApiError("이 주문은 더 이상 결제할 수 없습니다.", 409, "invalid-order-state");
  }

  if (order.discount_code) {
    const { error: discountClaimError } = await a.rpc("claim_checkout_discount_code", {
      p_user_id: uid,
      p_code: order.discount_code,
      p_authorization_order_number: order.order_number,
      p_product_id: order.product_id,
      p_region: order.region,
      p_list_amount: Number(order.list_amount || order.amount || 0),
      p_discount_amount: Number(order.discount_amount || 0),
    });
    if (discountClaimError) throw new ApiError(discountClaimError.message, 409, "discount-code-claim-failed");
  } else if (order.referral_code) {
    const { error: referralClaimError } = await a.rpc("claim_checkout_referral", {
      p_user_id: uid,
      p_referral_code: order.referral_code,
      p_authorization_order_number: order.order_number,
      p_product_id: order.product_id,
      p_region: order.region,
      p_discount_amount: Number(order.discount_amount || 0),
    });
    if (referralClaimError) throw new ApiError(referralClaimError.message, 409, "referral-claim-failed");
  }

  let claim: any;
  if (order.product_id === "participation_pack_5") {
    const { data, error } = await a.rpc("claim_participation_pack_payment", {
      p_authorization_order_id: order.order_number,
      p_user_id: uid,
    });
    if (error) throw new ApiError(error.message, 409, "payment-claim-failed");
    claim = Array.isArray(data) ? data[0] : data;
  } else {
    const { data, error } = await a.rpc("claim_membership_checkout_payment", {
      p_authorization_order_id: order.order_number,
      p_user_id: uid,
    });
    if (error) throw new ApiError(error.message, 409, "payment-claim-failed");
    claim = Array.isArray(data) ? data[0] : data;
  }
  if (!claim || claim.state !== "claimed" || !claim.charge_order_number) {
    throw new ApiError("결제를 시작할 수 없습니다.", 409, "payment-claim-failed");
  }

  const product = await getProduct(order.product_id as ProductId, order.region as Region);
  const auth = await getPaypleAuthToken();
  const now = new Date();
  const chargeRequest = {
    PCD_CST_ID: auth.cst_id,
    PCD_CUST_KEY: auth.custKey,
    PCD_AUTH_KEY: auth.AuthKey,
    PCD_PAY_TYPE: "card",
    PCD_PAYER_ID: billingKey,
    PCD_PAY_GOODS: product.display_name,
    PCD_SIMPLE_FLAG: "Y",
    PCD_PAY_TOTAL: Number(order.amount),
    PCD_PAY_OID: claim.charge_order_number,
    PCD_PAYER_NO: await generateNumericPayerNo(uid),
    PCD_PAY_YEAR: now.getFullYear().toString(),
    PCD_PAY_MONTH: (now.getMonth() + 1).toString().padStart(2, "0"),
    PCD_PAY_ISTAX: "Y",
    PCD_PAY_TAXTOTAL: Math.floor(Number(order.amount) / 11).toString(),
  };

  const chargeResponse = await fetch(payplePaymentUrl(auth), {
    method: "POST",
    headers: { "Content-Type": "application/json", referer: PAYPLE_HOSTNAME },
    body: JSON.stringify(chargeRequest),
  });
  const payData = await chargeResponse.json();

  if (payData?.PCD_PAY_RST !== "success") {
    await a.from("payment_orders").update({
      status: "failed",
      billing_key_used: billingKey,
      payment_result: payData,
      payple_response: payData,
      error_code: payData?.PCD_PAY_CODE || "unknown",
      error_message: payData?.PCD_PAY_MSG || "결제 실패",
      failed_at: new Date().toISOString(),
    }).eq("order_number", order.order_number);
    if (order.discount_code) {
      await a.rpc("release_checkout_discount_code", {
        p_user_id: uid,
        p_authorization_order_number: order.order_number,
      });
    } else if (order.referral_code) {
      await a.rpc("release_checkout_referral", {
        p_user_id: uid,
        p_authorization_order_number: order.order_number,
      });
    }
    throw new ApiError(payData?.PCD_PAY_MSG || "결제에 실패했습니다.", 400, "payple-charge-failed");
  }

  const { error: persistError } = await a.from("payment_orders").update({
    billing_key_used: billingKey,
    payment_result: payData,
    payple_response: payData,
  }).eq("order_number", order.order_number);
  if (persistError) {
    throw new ApiError(
      "결제는 완료되었지만 결제 결과를 저장하지 못했습니다. 다시 결제하지 말고 고객지원으로 문의해주세요.",
      500,
      "payment-result-persist-failed",
    );
  }

  return await settleSuccessfulCharge(uid, { ...order, status: "charging", billing_key_used: billingKey }, payData, billingKey);
}

async function reportFailure(uid: string, body: Record<string, unknown>) {
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber : "";
  if (!orderNumber) return { success: true };
  await admin().from("payment_orders").update({
    status: "failed",
    error_code: typeof body.errorCode === "string" ? body.errorCode : "client_reported",
    error_message: typeof body.errorMessage === "string" ? body.errorMessage : "결제창 오류",
    failed_at: new Date().toISOString(),
  }).eq("order_number", orderNumber).eq("user_id", uid).eq("type", "checkout_auth");
  return { success: true };
}

async function participationRefundQuote(uid: string, body: Record<string, unknown>) {
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
  if (!orderNumber) throw new ApiError("구매 주문번호가 필요합니다.", 400, "missing-order");
  const { data, error } = await admin().rpc("participation_pack_refund_quote", {
    p_payment_order_id: orderNumber,
    p_user_id: uid,
  });
  if (error) throw new ApiError(error.message, 400, "refund-quote-failed");
  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: true,
    refundable: Boolean(row?.refundable),
    creditsPurchased: Number(row?.credits_purchased ?? 0),
    creditsRemaining: Number(row?.credits_remaining ?? 0),
    refundAmount: Number(row?.refund_amount ?? 0),
    expiresAt: row?.expires_at ?? null,
    message: row?.message ?? "",
  };
}

async function refundParticipationPack(uid: string, body: Record<string, unknown>) {
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "User requested participation-pack refund";
  if (!orderNumber) throw new ApiError("구매 주문번호가 필요합니다.", 400, "missing-order");
  const a = admin();

  const { data: prior } = await a
    .from("payment_cancellations")
    .select("id, status, refund_amount_processed, credits_reversed")
    .eq("user_id", uid)
    .eq("original_order_id", orderNumber)
    .in("status", ["completed", "completed_pending_credit_reversal"])
    .maybeSingle();

  if (prior?.status === "completed") {
    const { data: balance } = await a.from("participation_credit_balances").select("balance").eq("user_id", uid).maybeSingle();
    return { success: true, alreadyRefunded: true, refundAmount: Number(prior.refund_amount_processed || 0), creditsReversed: Number(prior.credits_reversed || 0), creditBalance: Number(balance?.balance || 0) };
  }
  if (prior?.status === "completed_pending_credit_reversal") {
    const { data: reversed, error: reverseError } = await a.rpc("reverse_participation_pack_remaining", {
      p_payment_order_id: orderNumber,
      p_user_id: uid,
      p_reason: reason,
    });
    if (reverseError) throw new ApiError("결제 취소는 완료되었지만 참여권 정산을 완료하지 못했습니다. 고객지원으로 문의해주세요.", 500, "settlement-pending");
    const row = Array.isArray(reversed) ? reversed[0] : reversed;
    await a.from("payment_cancellations").update({ status: "completed", credits_reversed: Number(row?.credits_reversed || 0), payple_error_message: null }).eq("id", prior.id);
    return { success: true, alreadyRefunded: true, refundAmount: Number(prior.refund_amount_processed || 0), creditsReversed: Number(row?.credits_reversed || 0), creditBalance: Number(row?.credit_balance || 0) };
  }

  const quoteResult = await participationRefundQuote(uid, { orderNumber });
  if (!quoteResult.refundable || quoteResult.refundAmount <= 0) {
    throw new ApiError(quoteResult.message || "환불 가능한 금액이 없습니다.", 400, "not-refundable");
  }

  const { data: order, error: orderError } = await a
    .from("payment_orders")
    .select("order_number, amount, completed_at, payment_result, status, type")
    .eq("order_number", orderNumber)
    .eq("user_id", uid)
    .maybeSingle();
  if (orderError || !order || order.type !== "participation_pack_purchase") {
    throw new ApiError("참여권 구매 내역을 찾을 수 없습니다.", 404, "order-not-found");
  }

  const completedAt = new Date(order.completed_at);
  const pcdTime = order.payment_result?.PCD_PAY_TIME;
  const payDate = typeof pcdTime === "string" && pcdTime.length >= 8 ? pcdTime.slice(0, 8) : formatYyyyMMdd(completedAt);
  const auth = await getPaypleAuthToken(true);
  const cancelResponse = await fetch(`${PAYPLE_HOST}/php/account/api/cPayCAct.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", referer: PAYPLE_HOSTNAME },
    body: JSON.stringify({
      PCD_CST_ID: auth.cst_id,
      PCD_CUST_KEY: auth.custKey,
      PCD_AUTH_KEY: auth.AuthKey,
      PCD_REFUND_KEY: PAYPLE_REFUND_KEY,
      PCD_PAYCANCEL_FLAG: "Y",
      PCD_PAY_OID: orderNumber,
      PCD_PAY_DATE: payDate,
      PCD_REFUND_TOTAL: String(quoteResult.refundAmount),
    }),
  });
  const cancelData = await cancelResponse.json();
  if (cancelData?.PCD_PAY_RST !== "success") {
    await a.from("payment_cancellations").insert({
      id: crypto.randomUUID(), user_id: uid, original_order_id: orderNumber, status: "failed",
      reason, refund_amount_attempted: quoteResult.refundAmount,
      refund_policy: "remaining_uses_proportional", payple_error_code: cancelData?.PCD_PAY_CODE || "unknown",
      payple_error_message: cancelData?.PCD_PAY_MSG || "환불 실패", payple_response: cancelData,
    });
    throw new ApiError(cancelData?.PCD_PAY_MSG || "환불에 실패했습니다.", 400, "payple-refund-failed");
  }

  const { data: reversed, error: reverseError } = await a.rpc("reverse_participation_pack_remaining", {
    p_payment_order_id: orderNumber,
    p_user_id: uid,
    p_reason: reason,
  });
  if (reverseError) {
    await a.from("payment_cancellations").insert({
      id: crypto.randomUUID(), user_id: uid, original_order_id: orderNumber,
      status: "completed_pending_credit_reversal", reason,
      refund_amount_processed: quoteResult.refundAmount, refund_policy: "remaining_uses_proportional",
      payple_response: cancelData, payple_error_message: reverseError.message,
    });
    throw new ApiError("결제 취소는 완료되었지만 참여권 정산을 완료하지 못했습니다. 고객지원으로 문의해주세요.", 500, "settlement-pending");
  }
  const reversedRow = Array.isArray(reversed) ? reversed[0] : reversed;
  await a.from("payment_cancellations").insert({
    id: crypto.randomUUID(), user_id: uid, original_order_id: orderNumber, status: "completed",
    reason, refund_amount_processed: quoteResult.refundAmount,
    credits_reversed: Number(reversedRow?.credits_reversed || quoteResult.creditsRemaining),
    refund_policy: "remaining_uses_proportional", payple_response: cancelData,
  });
  return {
    success: true,
    refundAmount: quoteResult.refundAmount,
    creditsReversed: Number(reversedRow?.credits_reversed || quoteResult.creditsRemaining),
    creditBalance: Number(reversedRow?.credit_balance || 0),
  };
}

// Payple callback fields that /payment/result renders or forwards to the payment
// function's "verify" action. Anything else Payple sends is dropped rather than
// copied into the redirect URL: the callback is an unauthenticated endpoint, so
// without an allowlist any caller can push arbitrary keys into the page's query
// string. PCD_CST_ID / PCD_CUST_KEY / PCD_AUTH_KEY / PCD_REFUND_KEY are deliberately
// absent — those are our Payple credentials and must never reach a browser.
const CALLBACK_PASSTHROUGH_FIELDS = new Set([
  "PCD_PAY_RST",
  "PCD_PAY_CODE",
  "PCD_PAY_MSG",
  "PCD_PAY_OID",
  "PCD_PAY_TYPE",
  "PCD_PAY_WORK",
  "PCD_PAY_GOODS",
  "PCD_PAY_TOTAL",
  "PCD_PAY_TIME",
  "PCD_PAY_YEAR",
  "PCD_PAY_MONTH",
  "PCD_PAY_CARDNAME",
  "PCD_PAYER_ID",
  "PCD_PAYER_NO",
  "PCD_PAYER_NAME",
  "PCD_PAYER_EMAIL",
  "PCD_CARD_VER",
  "PCD_CARD_BILLKEY",
  "PCD_REGULER_FLAG",
  "PCD_USER_DEFINE1",
  "PCD_USER_DEFINE2",
]);

// Payple's own values are short; this only bounds how long a forged redirect can get.
const CALLBACK_VALUE_MAX_LENGTH = 512;

function collectCallbackField(
  target: Record<string, string>,
  key: string,
  value: unknown,
): void {
  if (!CALLBACK_PASSTHROUGH_FIELDS.has(key)) return;
  if (typeof value !== "string" && typeof value !== "number") return;
  const text = String(value);
  if (text.length > CALLBACK_VALUE_MAX_LENGTH) return;
  target[key] = text;
}

async function callback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const paymentData: Record<string, string> = {};
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      let parsed: unknown;
      try {
        parsed = await req.json();
      } catch {
        return new Response("Invalid payment callback body", { status: 400 });
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          collectCallbackField(paymentData, key, value);
        }
      }
    } else {
      const form = await req.formData();
      for (const [key, value] of form.entries()) {
        collectCallbackField(paymentData, key, String(value));
      }
    }
  } else {
    for (const [key, value] of url.searchParams.entries()) {
      collectCallbackField(paymentData, key, value);
    }
  }
  if (Object.keys(paymentData).length === 0) return new Response("No payment data received", { status: 400 });
  const params = new URLSearchParams(paymentData);
  params.set("payment_id", paymentData.PCD_PAY_OID || `payment_${Date.now()}`);
  return new Response(null, {
    status: 303,
    headers: { Location: `${PAYPLE_FRONTEND_URL}/payment/result?${params.toString()}` },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/callback")) return await callback(req);

  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }
  } catch {
    return json(req, { success: false, message: "Invalid JSON body" }, 400);
  }

  const action = String(body.action || "");
  try {
    if (action === "products") return json(req, await listProducts());

    const uid = await callerUid(req);
    if (!uid) return json(req, { success: false, message: "Authentication required" }, 401);

    switch (action) {
      case "quote": return json(req, await quote(uid, body));
      case "window": return json(req, await createPaymentWindow(uid, body));
      case "billing-status": return json(req, await billingStatus(uid));
      case "billing-method-window": return json(req, await createBillingMethodUpdateWindow(uid, body));
      case "verify": return json(req, await verifyPayment(uid, body));
      case "report-failure": return json(req, await reportFailure(uid, body));
      case "participation-refund-quote": return json(req, await participationRefundQuote(uid, body));
      case "refund-participation-pack": return json(req, await refundParticipationPack(uid, body));
      default: return json(req, { success: false, message: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    const err = error as ApiError;
    console.error("checkout error", action, err);
    return json(req, { success: false, message: err.message || "Internal error", errorCode: err.code || "internal" }, typeof err.status === "number" ? err.status : 500);
  }
});
