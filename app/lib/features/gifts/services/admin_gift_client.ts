import type {
  AdminGiftProduct,
  AdminGiftsData,
  SendAdminGiftInput,
  SendAdminGiftResult,
} from "../types";

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : fallbackMessage;
    throw new Error(message);
  }
  return payload as T;
}

export function getAdminGiftsClient(fallbackMessage: string): Promise<AdminGiftsData> {
  return requestJson<AdminGiftsData>(
    "/api/admin/gifts",
    { method: "GET" },
    fallbackMessage,
  );
}

export function lookupAdminGiftProductClient(
  goodsCode: string,
  fallbackMessage: string,
): Promise<AdminGiftProduct> {
  return requestJson<AdminGiftProduct>(
    "/api/admin/gifts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lookup-product", goodsCode }),
    },
    fallbackMessage,
  );
}

export function sendAdminGiftClient(
  input: SendAdminGiftInput,
  fallbackMessage: string,
): Promise<SendAdminGiftResult> {
  return requestJson<SendAdminGiftResult>(
    "/api/admin/gifts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", ...input }),
    },
    fallbackMessage,
  );
}
