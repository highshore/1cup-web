import type {
  AdminNotificationsData,
  CreateNotificationTemplateInput,
  NotificationTemplateSchedule,
  SendAdminNotificationInput,
  SendAdminNotificationResult,
} from "../types";

function messageFromPayload(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function getAdminNotificationsClient(
  fallbackError: string,
): Promise<AdminNotificationsData> {
  const response = await fetch("/api/admin/notifications", { cache: "no-store" });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(messageFromPayload(payload, fallbackError));
  return payload as AdminNotificationsData;
}

export async function sendAdminNotificationClient(
  input: SendAdminNotificationInput,
  fallbackError: string,
): Promise<SendAdminNotificationResult> {
  const response = await fetch("/api/admin/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(messageFromPayload(payload, fallbackError));
  return payload as SendAdminNotificationResult;
}

async function postNotificationAdminAction<T>(
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<T> {
  const response = await fetch("/api/admin/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new Error(messageFromPayload(payload, fallbackError));
  return payload as T;
}

export async function createNotificationTemplateClient(
  input: CreateNotificationTemplateInput,
  fallbackError: string,
): Promise<string> {
  const result = await postNotificationAdminAction<{ templateId?: unknown }>(
    { action: "create-template", ...input },
    fallbackError,
  );
  if (typeof result.templateId !== "string") throw new Error(fallbackError);
  return result.templateId;
}

export async function saveNotificationTemplateScheduleClient(
  input: { templateId: string; scheduleEnabled: boolean; schedule: NotificationTemplateSchedule },
  fallbackError: string,
): Promise<void> {
  await postNotificationAdminAction(
    { action: "save-template-schedule", ...input },
    fallbackError,
  );
}

export async function deleteNotificationTemplateClient(
  templateId: string,
  fallbackError: string,
): Promise<void> {
  await postNotificationAdminAction(
    { action: "delete-template", templateId },
    fallbackError,
  );
}
