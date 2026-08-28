import "server-only";

import { randomBytes } from "node:crypto";

import { admin, createServerClientRSC } from "../../../supabase/server";
import type {
  AdminGiftHistoryItem,
  AdminGiftCatalogPage,
  AdminGiftProduct,
  AdminGiftRecipient,
  AdminGiftsData,
  GiftSendStatus,
  SendAdminGiftInput,
  SendAdminGiftResult,
} from "../types";

const GIFTISHOW_BASE_URL = "https://bizapi.giftishow.com/bizApi";
const SEND_TIMEOUT_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const CATALOG_PAGE_SIZE = 10;
const GIFTISHOW_CREDENTIAL_ERROR_MESSAGE =
  "Giftishow rejected the configured API credentials (E0006). Replace GIFTISHOW_AUTH_CODE and GIFTISHOW_AUTH_TOKEN with the current production keys.";

export class AdminGiftError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

class GiftishowTimeoutError extends Error {}

class GiftishowProviderError extends Error {
  constructor(message: string, readonly code: string | null = null) {
    super(message);
  }
}

type ProviderConfig = {
  authCode: string;
  authToken: string;
  userId: string;
  callbackNo: string;
  templateId: string | null;
  bannerId: string | null;
  missing: string[];
  configured: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integerValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value);
  return null;
}

function codePointLength(value: string): number {
  return [...value].length;
}

function readProviderConfig(): ProviderConfig {
  const authCode = process.env.GIFTISHOW_AUTH_CODE?.trim() || "";
  const authToken = process.env.GIFTISHOW_AUTH_TOKEN?.trim() || "";
  const userId = process.env.GIFTISHOW_USER_ID?.trim() || "";
  const callbackNo = process.env.GIFTISHOW_CALLBACK_NO?.trim() || "";
  const templateId = process.env.GIFTISHOW_TEMPLATE_ID?.trim() || null;
  const bannerId = process.env.GIFTISHOW_BANNER_ID?.trim() || null;
  const missing: string[] = [];

  if (!authCode) missing.push("GIFTISHOW_AUTH_CODE");
  if (!authToken) missing.push("GIFTISHOW_AUTH_TOKEN");
  if (!userId) missing.push("GIFTISHOW_USER_ID");
  if (!callbackNo) missing.push("GIFTISHOW_CALLBACK_NO");

  return {
    authCode,
    authToken,
    userId,
    callbackNo,
    templateId,
    bannerId,
    missing,
    configured: missing.length === 0,
  };
}

function requireProviderConfig(): ProviderConfig {
  const config = readProviderConfig();
  if (!config.configured) {
    throw new AdminGiftError(
      `Giftishow is not configured on the server (${config.missing.join(", ")}).`,
      500,
    );
  }
  return config;
}

async function requireAdminProfile(): Promise<string> {
  const client = await createServerClientRSC();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) throw new AdminGiftError("Authentication is required.", 401);

  const { data, error } = await client.rpc("current_user_row");
  if (error) {
    console.error("Unable to resolve gift administrator:", error);
    throw new AdminGiftError("Unable to verify administrator access.", 500);
  }

  const rawProfile = Array.isArray(data) ? data[0] : data;
  const profile = isRecord(rawProfile) ? rawProfile : null;
  const uid = stringValue(profile?.uid);
  if (!uid || profile?.account_status !== "admin") {
    throw new AdminGiftError("Administrator access is required.", 403);
  }
  return uid;
}

function normalizeKoreanPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  return /^0\d{9,10}$/.test(digits) ? digits : null;
}

function normalizeCallbackNumber(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  return /^(?:0\d{8,10}|1[568]\d{6})$/.test(digits) ? digits : null;
}

function maskPhone(phone: string): string {
  return `***-****-${phone.slice(-4)}`;
}

function maskLast4(value: unknown): string | null {
  const last4 = stringValue(value);
  return last4 && /^\d{4}$/.test(last4) ? `***-****-${last4}` : null;
}

function providerMessage(payload: Record<string, unknown>): string | null {
  return stringValue(payload.message);
}

function assertOuterSuccess(payload: Record<string, unknown>): void {
  const code = stringValue(payload.code);
  if (code !== "0000") {
    throw new GiftishowProviderError(providerMessage(payload) || "Giftishow rejected the request.", code);
  }
}

function isCredentialRejection(error: unknown): boolean {
  return error instanceof GiftishowProviderError && error.code === "E0006";
}

function giftishowCredentialError(): AdminGiftError {
  return new AdminGiftError(GIFTISHOW_CREDENTIAL_ERROR_MESSAGE, 502);
}

async function postGiftishow(
  path: string,
  apiCode: string,
  parameters: Record<string, string>,
  config: ProviderConfig,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    api_code: apiCode,
    custom_auth_code: config.authCode,
    custom_auth_token: config.authToken,
    dev_yn: "N",
    ...parameters,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GIFTISHOW_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new GiftishowProviderError("Giftishow returned an invalid JSON response.");
    }

    if (!response.ok) {
      const message = isRecord(parsed) ? providerMessage(parsed) : null;
      throw new GiftishowProviderError(message || `Giftishow returned HTTP ${response.status}.`);
    }
    if (!isRecord(parsed)) throw new GiftishowProviderError("Giftishow returned an invalid response.");
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GiftishowTimeoutError("Giftishow request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toProductRecord(value: Record<string, unknown>): AdminGiftProduct | null {
  const goodsCode = stringValue(value.goodsCode);
  const goodsName = stringValue(value.goodsName);
  if (!goodsCode || !goodsName) {
    return null;
  }

  return {
    goodsCode,
    goodsName,
    brandName: stringValue(value.brandName),
    imageUrl: stringValue(value.goodsImgS) || stringValue(value.goodsImgB),
    salePrice: integerValue(value.salePrice),
    discountPrice: integerValue(value.discountPrice) ?? integerValue(value.goldPrice),
    state: stringValue(value.goodsStateCd),
    limitDay: integerValue(value.limitDay) ?? integerValue(value.limitday),
  };
}

function toProduct(payload: Record<string, unknown>): AdminGiftProduct {
  assertOuterSuccess(payload);
  const result = isRecord(payload.result) ? payload.result : null;
  const detail = result && isRecord(result.goodsDetail) ? result.goodsDetail : null;
  const product = detail ? toProductRecord(detail) : null;
  if (!product) throw new GiftishowProviderError("Giftishow product details are incomplete.");
  return product;
}

async function fetchProduct(goodsCode: string, config: ProviderConfig): Promise<AdminGiftProduct> {
  const normalizedCode = goodsCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(normalizedCode)) {
    throw new AdminGiftError("Please enter a valid Giftishow product code.", 400);
  }
  const payload = await postGiftishow(
    `/goods/${encodeURIComponent(normalizedCode)}`,
    "0111",
    {},
    config,
  );
  return toProduct(payload);
}

async function fetchProductCatalog(page: number, config: ProviderConfig): Promise<AdminGiftCatalogPage> {
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new AdminGiftError("Please enter a valid product catalog page.", 400);
  }

  const payload = await postGiftishow(
    "/goods",
    "0101",
    { start: String(page), size: String(CATALOG_PAGE_SIZE) },
    config,
  );
  assertOuterSuccess(payload);
  const result = isRecord(payload.result) ? payload.result : null;
  const goodsList = result && Array.isArray(result.goodsList) ? result.goodsList : null;
  if (!goodsList) throw new GiftishowProviderError("Giftishow did not return a product catalog.");

  const products = goodsList
    .filter(isRecord)
    .map(toProductRecord)
    .filter((product): product is AdminGiftProduct => product !== null);

  return {
    page,
    size: CATALOG_PAGE_SIZE,
    // Giftishow's listNum is the count for this response, not a reliable total catalog count.
    total: null,
    hasMore: products.length === CATALOG_PAGE_SIZE,
    products,
  };
}

async function fetchBalance(config: ProviderConfig): Promise<number> {
  const payload = await postGiftishow(
    "/bizmoney",
    "0301",
    { user_id: config.userId },
    config,
  );
  assertOuterSuccess(payload);
  const result = isRecord(payload.result) ? payload.result : null;
  const balance = integerValue(payload.balance) ?? integerValue(result?.balance);
  if (balance === null) {
    throw new GiftishowProviderError("Giftishow did not return the Bizmoney balance.");
  }
  return balance;
}

function toHistoryItem(value: unknown): AdminGiftHistoryItem | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const trId = stringValue(value.tr_id);
  const goodsCode = stringValue(value.goods_code);
  const goodsName = stringValue(value.goods_name);
  const mmsTitle = stringValue(value.mms_title);
  const mmsMessage = stringValue(value.mms_message);
  const createdAt = stringValue(value.created_at);
  const rawStatus = stringValue(value.status);
  const validStatuses: GiftSendStatus[] = [
    "pending",
    "sent",
    "failed",
    "cancelled_after_timeout",
    "timeout_unknown",
  ];
  const status = rawStatus && validStatuses.includes(rawStatus as GiftSendStatus)
    ? (rawStatus as GiftSendStatus)
    : null;

  if (!id || !trId || !goodsCode || !goodsName || !mmsTitle || !mmsMessage || !createdAt || !status) {
    return null;
  }

  return {
    id,
    trId,
    memberId: stringValue(value.member_id),
    recipientName: stringValue(value.recipient_name),
    recipientPhoneMasked: maskLast4(value.recipient_phone_last4),
    goodsCode,
    goodsName,
    brandName: stringValue(value.brand_name),
    goodsImageUrl: stringValue(value.goods_image_url),
    salePrice: integerValue(value.sale_price),
    purchasePrice: integerValue(value.purchase_price),
    mmsTitle,
    mmsMessage,
    orderNo: stringValue(value.order_no),
    providerCode: stringValue(value.provider_code),
    providerMessage: stringValue(value.provider_message),
    status,
    createdAt,
    sentAt: stringValue(value.sent_at),
  };
}

function toRecipient(value: unknown): AdminGiftRecipient | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.uid);
  if (!id || value.is_placeholder === true) return null;
  const rawPhone = stringValue(value.phone);
  const phone = rawPhone ? normalizeKoreanPhone(rawPhone) : null;
  return {
    id,
    displayName: stringValue(value.display_name),
    photoUrl: stringValue(value.photo_url),
    maskedPhone: phone ? maskPhone(phone) : null,
    hasPhone: Boolean(phone),
  };
}

async function updateGiftHistory(
  id: string,
  values: Record<string, unknown>,
): Promise<AdminGiftHistoryItem> {
  const db = admin();
  const { data, error } = await db
    .from("gift_sends")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Unable to update gift history:", error);
    throw new AdminGiftError("The gift was processed, but its audit record could not be updated.", 500);
  }
  const mapped = toHistoryItem(data);
  if (!mapped) throw new AdminGiftError("The gift audit record is invalid.", 500);
  return mapped;
}

function parseSendOutcome(payload: Record<string, unknown>): {
  orderNo: string | null;
  providerCode: string;
  providerMessage: string | null;
} {
  assertOuterSuccess(payload);
  const outerCode = stringValue(payload.code) || "0000";
  const outerMessage = providerMessage(payload);
  const envelope = isRecord(payload.result) ? payload.result : null;
  if (!envelope) return { orderNo: null, providerCode: outerCode, providerMessage: outerMessage };

  const innerCode = stringValue(envelope.code);
  const innerMessage = stringValue(envelope.message);
  if (innerCode && innerCode !== "0000") {
    throw new GiftishowProviderError(innerMessage || "Giftishow could not send the coupon.", innerCode);
  }
  const result = isRecord(envelope.result) ? envelope.result : envelope;
  return {
    orderNo: stringValue(result.orderNo),
    providerCode: innerCode || outerCode,
    providerMessage: innerMessage || outerMessage,
  };
}

async function cancelTimedOutSend(trId: string, config: ProviderConfig): Promise<void> {
  const payload = await postGiftishow(
    "/cancel",
    "0202",
    { tr_id: trId, user_id: config.userId },
    config,
  );
  assertOuterSuccess(payload);
}

function generateTrId(): string {
  return `1cup_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`.slice(0, 25);
}

export async function getAdminGifts(): Promise<AdminGiftsData> {
  await requireAdminProfile();
  const db = admin();
  const config = readProviderConfig();

  const [recipientsResult, historyResult] = await Promise.all([
    db
      .from("users")
      .select("uid, display_name, photo_url, phone, account_status, is_placeholder")
      .order("display_name", { ascending: true, nullsFirst: false })
      .limit(1000),
    db
      .from("gift_sends")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
  ]);

  if (recipientsResult.error || historyResult.error) {
    console.error("Unable to load gift center:", {
      recipients: recipientsResult.error,
      history: historyResult.error,
    });
    throw new AdminGiftError("Unable to load the gift center.", 500);
  }

  let balance: number | null = null;
  let balanceError: string | null = null;
  const defaultProduct: AdminGiftProduct | null = null;
  let credentialsRejected = false;

  if (config.configured) {
    const balanceResult = await Promise.resolve(fetchBalance(config)).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ status: "rejected" as const, reason }),
    );
    if (balanceResult.status === "fulfilled") {
      balance = balanceResult.value;
    } else {
      credentialsRejected ||= isCredentialRejection(balanceResult.reason);
      balanceError = balanceResult.reason instanceof Error
        ? balanceResult.reason.message
        : "Unable to load Bizmoney balance.";
    }
    console.info("Giftishow readiness check", {
      balanceAvailable: balanceResult.status === "fulfilled",
      catalogLoadedOnDemand: true,
      balanceProviderCode:
        balanceResult.status === "rejected" && balanceResult.reason instanceof GiftishowProviderError
          ? balanceResult.reason.code
          : null,
    });
  } else {
    console.warn("Giftishow readiness check failed: missing configuration", {
      missing: config.missing,
    });
  }

  return {
    configured: config.configured && !credentialsRejected,
    configurationError: !config.configured
      ? `Missing server configuration: ${config.missing.join(", ")}`
      : credentialsRejected
        ? GIFTISHOW_CREDENTIAL_ERROR_MESSAGE
        : null,
    balance,
    balanceError,
    recipients: (recipientsResult.data ?? [])
      .map(toRecipient)
      .filter((item): item is AdminGiftRecipient => item !== null),
    history: (historyResult.data ?? [])
      .map(toHistoryItem)
      .filter((item): item is AdminGiftHistoryItem => item !== null),
    defaultProduct,
  };
}

export async function lookupAdminGiftProduct(goodsCode: string): Promise<AdminGiftProduct> {
  await requireAdminProfile();
  try {
    return await fetchProduct(goodsCode, requireProviderConfig());
  } catch (error) {
    if (isCredentialRejection(error)) throw giftishowCredentialError();
    throw error;
  }
}

export async function listAdminGiftProducts(page: number): Promise<AdminGiftCatalogPage> {
  await requireAdminProfile();
  try {
    return await fetchProductCatalog(page, requireProviderConfig());
  } catch (error) {
    if (isCredentialRejection(error)) throw giftishowCredentialError();
    throw error;
  }
}

export async function sendAdminGift(input: SendAdminGiftInput): Promise<SendAdminGiftResult> {
  const adminUid = await requireAdminProfile();
  const config = requireProviderConfig();
  const db = admin();

  const goodsCode = input.goodsCode.trim().toUpperCase();
  const mmsTitle = input.mmsTitle.trim();
  const mmsMessage = input.mmsMessage.trim();
  const memberId = input.memberId?.trim() || null;
  let recipientName = input.recipientName?.trim() || null;
  let phone: string | null = null;

  if (!mmsTitle || codePointLength(mmsTitle) > 10) {
    throw new AdminGiftError("MMS title must be between 1 and 10 characters.", 400);
  }
  if (!mmsMessage || mmsMessage.length > 4000) {
    throw new AdminGiftError("MMS message must be between 1 and 4,000 characters.", 400);
  }
  if (recipientName && recipientName.length > 120) {
    throw new AdminGiftError("Recipient name is too long.", 400);
  }

  if (memberId) {
    const { data, error } = await db
      .from("users")
      .select("uid, display_name, phone, is_placeholder")
      .eq("uid", memberId)
      .maybeSingle();
    if (error || !isRecord(data) || data.is_placeholder === true) {
      throw new AdminGiftError("The selected member is unavailable.", 400);
    }
    const storedPhone = stringValue(data.phone);
    phone = storedPhone ? normalizeKoreanPhone(storedPhone) : null;
    recipientName = stringValue(data.display_name) || recipientName;
  } else if (input.phoneNumber) {
    phone = normalizeKoreanPhone(input.phoneNumber);
  }

  if (!phone) throw new AdminGiftError("Enter a valid Korean recipient phone number.", 400);

  const callbackNo = normalizeCallbackNumber(config.callbackNo);
  if (!callbackNo) {
    throw new AdminGiftError("GIFTISHOW_CALLBACK_NO is not a valid Korean phone number.", 500);
  }

  const product = await fetchProduct(goodsCode, config);
  if (product.state !== "SALE") {
    throw new AdminGiftError("This Giftishow product is not currently available for sale.", 400);
  }

  const purchasePrice = product.discountPrice ?? product.salePrice;

  const trId = generateTrId();
  const { data: inserted, error: insertError } = await db
    .from("gift_sends")
    .insert({
      tr_id: trId,
      created_by: adminUid,
      member_id: memberId,
      recipient_name: recipientName,
      recipient_phone_last4: phone.slice(-4),
      goods_code: product.goodsCode,
      goods_name: product.goodsName,
      brand_name: product.brandName,
      goods_image_url: product.imageUrl,
      sale_price: product.salePrice,
      purchase_price: purchasePrice,
      mms_title: mmsTitle,
      mms_message: mmsMessage,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !isRecord(inserted) || !stringValue(inserted.id)) {
    console.error("Unable to create gift audit record:", insertError);
    throw new AdminGiftError("Unable to create the gift audit record. Nothing was sent.", 500);
  }
  const giftId = String(inserted.id);

  const sendParameters: Record<string, string> = {
    goods_code: product.goodsCode,
    mms_msg: mmsMessage,
    mms_title: mmsTitle,
    callback_no: callbackNo,
    phone_no: phone,
    tr_id: trId,
    user_id: config.userId,
    gubun: "N",
  };
  if (config.templateId) sendParameters.template_id = config.templateId;
  if (config.bannerId) sendParameters.banner_id = config.bannerId;

  let historyItem: AdminGiftHistoryItem;
  try {
    const payload = await postGiftishow(
      "/send",
      "0204",
      sendParameters,
      config,
      SEND_TIMEOUT_MS,
    );
    const outcome = parseSendOutcome(payload);
    historyItem = await updateGiftHistory(giftId, {
      status: "sent",
      order_no: outcome.orderNo,
      provider_code: outcome.providerCode,
      provider_message: outcome.providerMessage,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof GiftishowTimeoutError) {
      let status: GiftSendStatus = "timeout_unknown";
      let message = "Giftishow timed out and the cancellation result is unknown.";
      try {
        await cancelTimedOutSend(trId, config);
        status = "cancelled_after_timeout";
        message = "Giftishow timed out; the matching TR_ID was cancelled automatically.";
      } catch (cancelError) {
        console.error("Unable to cancel timed-out Giftishow send:", cancelError);
      }
      await updateGiftHistory(giftId, { status, provider_message: message });
      throw new AdminGiftError(message, 504);
    }

    if (error instanceof AdminGiftError) throw error;

    const providerError = error instanceof GiftishowProviderError ? error : null;
    const message = isCredentialRejection(error)
      ? GIFTISHOW_CREDENTIAL_ERROR_MESSAGE
      : providerError?.message || "Giftishow could not send the coupon.";
    await updateGiftHistory(giftId, {
      status: "failed",
      provider_code: providerError?.code,
      provider_message: message,
    });
    throw new AdminGiftError(message, 502);
  }

  let remainingBalance: number | null = null;
  try {
    remainingBalance = await fetchBalance(config);
  } catch (error) {
    console.error("Unable to refresh Bizmoney after gift send:", error);
  }

  return { gift: historyItem, balance: remainingBalance };
}
