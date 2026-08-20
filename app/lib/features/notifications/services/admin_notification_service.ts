import "server-only";

import { admin, createServerClientRSC } from "../../../supabase/server";
import type {
  AdminNotificationCampaign,
  AdminNotificationRecipient,
  AdminNotificationTemplate,
  AdminNotificationsData,
  CreateNotificationTemplateInput,
  NotificationAudience,
  NotificationTemplateSchedule,
  SendAdminNotificationInput,
  SendAdminNotificationResult,
} from "../types";

export class AdminNotificationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 400 | 500,
  ) {
    super(message);
  }
}

type CurrentProfile = {
  uid?: unknown;
  account_status?: unknown;
};

type NotificationRecipientRow = {
  uid?: unknown;
  display_name?: unknown;
  photo_url?: unknown;
  account_status?: unknown;
  has_active_subscription?: unknown;
  is_placeholder?: unknown;
};

type NotificationCampaignRow = {
  id?: unknown;
  audience?: unknown;
  title?: unknown;
  body?: unknown;
  action_label?: unknown;
  action_url?: unknown;
  recipient_count?: unknown;
  delivered_count?: unknown;
  created_at?: unknown;
};

type NotificationTemplateRow = {
  id?: unknown;
  name?: unknown;
  audience?: unknown;
  recipient_ids?: unknown;
  title?: unknown;
  body?: unknown;
  action_label?: unknown;
  action_url?: unknown;
  schedule_enabled?: unknown;
  schedule?: unknown;
  next_run_at?: unknown;
  last_run_at?: unknown;
  updated_at?: unknown;
};

function isAudience(value: unknown): value is NotificationAudience {
  return (
    value === "all_members" ||
    value === "active_subscribers" ||
    value === "selected_members"
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function countValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function scheduleValue(value: unknown): NotificationTemplateSchedule {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const minute = typeof row.minute === "number" && Number.isInteger(row.minute) ? row.minute : 0;
  const hour = typeof row.hour === "number" && Number.isInteger(row.hour) ? row.hour : 19;
  const days = Array.isArray(row.daysOfWeek)
    ? [...new Set(row.daysOfWeek.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b)
    : [];
  return {
    minute: Math.min(59, Math.max(0, minute)),
    hour: Math.min(23, Math.max(0, hour)),
    daysOfWeek: days,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))]
    : [];
}

function toIsoOrNull(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

async function requireAdminProfile(): Promise<string> {
  const client = await createServerClientRSC();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    throw new AdminNotificationError("Authentication is required.", 401);
  }

  const { data, error } = await client.rpc("current_user_row");
  if (error) {
    console.error("Unable to resolve notification administrator:", error);
    throw new AdminNotificationError("Unable to verify administrator access.", 500);
  }

  const profile = (Array.isArray(data) ? data[0] : data) as CurrentProfile | null;
  const uid = requiredString(profile?.uid);
  if (!uid || profile?.account_status !== "admin") {
    throw new AdminNotificationError("Administrator access is required.", 403);
  }

  return uid;
}

function toRecipient(row: NotificationRecipientRow): AdminNotificationRecipient | null {
  const id = requiredString(row.uid);
  if (!id || row.is_placeholder === true) return null;

  return {
    id,
    displayName: stringOrNull(row.display_name),
    photoUrl: stringOrNull(row.photo_url),
    accountStatus: stringOrNull(row.account_status),
    hasActiveSubscription: row.has_active_subscription === true,
  };
}

function toCampaign(row: NotificationCampaignRow): AdminNotificationCampaign | null {
  const id = requiredString(row.id);
  const title = requiredString(row.title);
  const body = requiredString(row.body);
  const createdAt = requiredString(row.created_at);
  if (!id || !title || !body || !createdAt || !isAudience(row.audience)) return null;

  return {
    id,
    audience: row.audience,
    title,
    body,
    actionLabel: stringOrNull(row.action_label),
    actionUrl: stringOrNull(row.action_url),
    recipientCount: countValue(row.recipient_count),
    deliveredCount: countValue(row.delivered_count),
    createdAt,
  };
}

function toTemplate(row: NotificationTemplateRow): AdminNotificationTemplate | null {
  const id = requiredString(row.id);
  const name = requiredString(row.name);
  const title = requiredString(row.title);
  const body = requiredString(row.body);
  const updatedAt = requiredString(row.updated_at);
  if (!id || !name || !title || !body || !updatedAt || !isAudience(row.audience)) return null;

  return {
    id,
    name,
    audience: row.audience,
    recipientIds: stringArray(row.recipient_ids),
    title,
    body,
    actionLabel: stringOrNull(row.action_label),
    actionUrl: stringOrNull(row.action_url),
    scheduleEnabled: row.schedule_enabled === true,
    schedule: scheduleValue(row.schedule),
    nextRunAt: toIsoOrNull(row.next_run_at),
    lastRunAt: toIsoOrNull(row.last_run_at),
    updatedAt,
  };
}

export async function getAdminNotifications(): Promise<AdminNotificationsData> {
  await requireAdminProfile();
  const db = admin();

  const [recipientsResult, campaignsResult, templatesResult] = await Promise.all([
    db
      .from("users")
      .select("uid, display_name, photo_url, account_status, has_active_subscription, is_placeholder")
      .order("display_name", { ascending: true, nullsFirst: false })
      .limit(1000),
    db
      .from("notification_campaigns")
      .select(
        "id, audience, title, body, action_label, action_url, recipient_count, delivered_count, created_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
    db
      .from("notification_templates")
      .select("id, name, audience, recipient_ids, title, body, action_label, action_url, schedule_enabled, schedule, next_run_at, last_run_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  if (recipientsResult.error || campaignsResult.error || templatesResult.error) {
    console.error("Unable to load notification center:", {
      recipients: recipientsResult.error,
      campaigns: campaignsResult.error,
      templates: templatesResult.error,
    });
    throw new AdminNotificationError("Unable to load notifications.", 500);
  }

  return {
    recipients: (recipientsResult.data ?? [])
      .map((row) => toRecipient(row as NotificationRecipientRow))
      .filter((row): row is AdminNotificationRecipient => row !== null),
    campaigns: (campaignsResult.data ?? [])
      .map((row) => toCampaign(row as NotificationCampaignRow))
      .filter((row): row is AdminNotificationCampaign => row !== null),
    templates: (templatesResult.data ?? [])
      .map((row) => toTemplate(row as NotificationTemplateRow))
      .filter((row): row is AdminNotificationTemplate => row !== null),
  };
}

function validateTemplateInput(input: CreateNotificationTemplateInput): CreateNotificationTemplateInput {
  const name = input.name.trim();
  const title = input.title.trim();
  const body = input.body.trim();
  const actionLabel = input.actionLabel?.trim() || null;
  const actionUrl = input.actionUrl?.trim() || null;
  const recipientIds = [...new Set(input.recipientIds.filter((id) => id.trim().length > 0))];
  const schedule = scheduleValue(input.schedule);

  if (!name || name.length > 120 || !title || title.length > 120 || !body || body.length > 4000) {
    throw new AdminNotificationError("Please review the template content.", 400);
  }
  if ((actionLabel === null) !== (actionUrl === null) || (actionUrl && (!actionUrl.startsWith("/") || actionUrl.startsWith("//") || /\s/.test(actionUrl)))) {
    throw new AdminNotificationError("Please review the template action.", 400);
  }
  if (input.audience === "selected_members" && recipientIds.length === 0) {
    throw new AdminNotificationError("Choose at least one member for this template.", 400);
  }

  return {
    name,
    audience: input.audience,
    recipientIds,
    title,
    body,
    actionLabel,
    actionUrl,
    scheduleEnabled: input.scheduleEnabled === true && schedule.daysOfWeek.length > 0,
    schedule,
  };
}

function nextKstSchedule(schedule: NotificationTemplateSchedule, after = new Date()): string | null {
  if (schedule.daysOfWeek.length === 0) return null;
  const korea = new Date(after.getTime() + 9 * 60 * 60 * 1000);
  for (let offset = 0; offset <= 370; offset += 1) {
    const candidate = Date.UTC(
      korea.getUTCFullYear(),
      korea.getUTCMonth(),
      korea.getUTCDate() + offset,
      schedule.hour,
      schedule.minute,
    ) - 9 * 60 * 60 * 1000;
    if (schedule.daysOfWeek.includes(new Date(candidate + 9 * 60 * 60 * 1000).getUTCDay()) && candidate > after.getTime()) {
      return new Date(candidate).toISOString();
    }
  }
  return null;
}

export async function createNotificationTemplate(
  input: CreateNotificationTemplateInput,
): Promise<string> {
  const createdBy = await requireAdminProfile();
  const template = validateTemplateInput(input);
  const nextRunAt = template.scheduleEnabled ? nextKstSchedule(template.schedule) : null;

  if (template.audience === "selected_members") {
    const { data, error } = await admin()
      .from("users")
      .select("uid, is_placeholder")
      .in("uid", template.recipientIds);
    if (
      error ||
      (data ?? []).length !== template.recipientIds.length ||
      (data ?? []).some((recipient) => recipient.is_placeholder === true)
    ) {
      throw new AdminNotificationError("One or more selected members are unavailable.", 400);
    }
  }

  const { data, error } = await admin()
    .from("notification_templates")
    .insert({
      name: template.name,
      audience: template.audience,
      recipient_ids: template.recipientIds,
      title: template.title,
      body: template.body,
      action_label: template.actionLabel,
      action_url: template.actionUrl,
      schedule_enabled: template.scheduleEnabled,
      schedule: template.schedule,
      next_run_at: nextRunAt,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    console.error("Unable to save notification template:", error);
    throw new AdminNotificationError("The template could not be saved.", 500);
  }
  return data.id;
}

export async function updateNotificationTemplateSchedule({
  templateId,
  scheduleEnabled,
  schedule,
}: {
  templateId: string;
  scheduleEnabled: boolean;
  schedule: NotificationTemplateSchedule;
}): Promise<void> {
  await requireAdminProfile();
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) {
    throw new AdminNotificationError("Invalid notification template.", 400);
  }
  const validSchedule = scheduleValue(schedule);
  const enabled = scheduleEnabled && validSchedule.daysOfWeek.length > 0;
  const { error } = await admin()
    .from("notification_templates")
    .update({
      schedule_enabled: enabled,
      schedule: validSchedule,
      next_run_at: enabled ? nextKstSchedule(validSchedule) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);
  if (error) {
    console.error("Unable to save notification template schedule:", error);
    throw new AdminNotificationError("The template schedule could not be saved.", 500);
  }
}

export async function deleteNotificationTemplate(templateId: string): Promise<void> {
  await requireAdminProfile();
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) {
    throw new AdminNotificationError("Invalid notification template.", 400);
  }
  const { error } = await admin().from("notification_templates").delete().eq("id", templateId);
  if (error) {
    console.error("Unable to delete notification template:", error);
    throw new AdminNotificationError("The template could not be deleted.", 500);
  }
}

export async function sendAdminNotification(
  input: SendAdminNotificationInput,
): Promise<SendAdminNotificationResult> {
  const createdBy = await requireAdminProfile();
  const { data, error } = await admin().rpc("send_admin_notification", {
    p_created_by: createdBy,
    p_audience: input.audience,
    p_recipient_ids: input.recipientIds,
    p_title: input.title,
    p_body: input.body,
    p_action_label: input.actionLabel,
    p_action_url: input.actionUrl,
  });

  if (error) {
    console.error("Unable to send admin notification:", error);
    throw new AdminNotificationError("The notification could not be sent.", 400);
  }

  const result = data as Record<string, unknown> | null;
  const campaignId = requiredString(result?.campaignId);
  const recipientCount = countValue(result?.recipientCount);
  const deliveredCount = countValue(result?.deliveredCount);

  if (!campaignId || recipientCount < 1 || deliveredCount !== recipientCount) {
    console.error("Unexpected admin notification RPC response:", data);
    throw new AdminNotificationError("The notification could not be confirmed.", 500);
  }

  return { campaignId, recipientCount, deliveredCount };
}
