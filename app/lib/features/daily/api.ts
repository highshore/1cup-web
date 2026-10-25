"use client";

// Where the subscribe page leaves Payple's browser callback and the order number for
// the result page, which is the one place a checkout is verified.
export const DAILY_PAYMENT_SESSION_KEY = "dailyPaypleResponse";
export const DAILY_PAYMENT_ORDER_KEY = "dailyPaymentOrder";

export class DailyApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

// Everything goes through /api/daily, which holds the Daily session in an httpOnly cookie.
export async function dailyApi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`/api/daily/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new DailyApiError(payload.message ?? "", payload.errorCode ?? "", response.status);
  }
  return payload as T;
}
