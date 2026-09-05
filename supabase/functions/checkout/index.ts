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
    .select("code, active, referrer")
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
  const discountAmount = Math.min(Number(product.referral_discount_amount || 0), Number(product.list_amount));
  return {
    valid: true,
    discountAmount,
    finalAmount: Number(product.list_amount) - discountAmount,
    message: "첫 구매 추천 할인이 적용되었습니다.",
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
  const referral = await quoteReferral(uid, code, product);
  return {
    success: true,
    validReferral: referral.valid,
    listAmount: Number(product.list_amount),
    discountAmount: referral.discountAmount,
    finalAmount: referral.finalAmount,
    message: referral.message,
  };
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

  let discountAmount = 0;
  let finalAmount = Number(product.list_amount);
  let appliedReferralCode: string | null = null;
  if (referralCode) {
    const referral = await quoteReferral(uid, referralCode, product);
    if (!referral.valid) throw new ApiError(referral.message, 400, "invalid-referral");
    discountAmount = referral.discountAmount;
    finalAmount = referral.finalAmount;
    appliedReferralCode = referralCode;
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

async function verifyPayment(uid: string, body: Record<string, unknown>) {
  const paymentParams = body.paymentParams as Record<string, any> | undefined;
  if (!paymentParams) throw new ApiError("결제 결과가 없습니다.", 400, "missing-payment-result");
  const authorizationOrderNumber = String(paymentParams.PCD_PAY_OID || "");
  if (!authorizationOrderNumber) throw new ApiError("주문번호가 없습니다.", 400, "missing-order");
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
    .eq("type", "checkout_auth")
    .maybeSingle();
  if (orderError) throw new ApiError(orderError.message, 500, "order-query-failed");
  if (!order) throw new ApiError("결제 주문을 찾을 수 없습니다.", 404, "order-not-found");

  const billingKey = String(paymentParams.PCD_PAYER_ID || paymentParams.PCD_CARD_BILLKEY || order.billing_key_used || "");
  if (!billingKey) throw new ApiError("결제용 빌링키를 확인할 수 없습니다.", 500, "missing-billing-key");

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

  if (order.referral_code) {
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
    if (order.referral_code) {
      await a.rpc("release_checkout_referral", { p_user_id: uid, p_authorization_order_number: order.order_number });
    }
    throw new ApiError(payData?.PCD_PAY_MSG || "결제에 실패했습니다.", 400, "payple-charge-failed");
  }

  await a.from("payment_orders").update({
    billing_key_used: billingKey,
    payment_result: payData,
    payple_response: payData,
  }).eq("order_number", order.order_number);

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

async function callback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const paymentData: Record<string, string> = {};
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      Object.assign(paymentData, await req.json());
    } else {
      const form = await req.formData();
      for (const [key, value] of form.entries()) paymentData[key] = String(value);
    }
  } else {
    for (const [key, value] of url.searchParams.entries()) paymentData[key] = value;
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
