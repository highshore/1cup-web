import { NextRequest, NextResponse } from "next/server";

import {
  AdminNotificationError,
  createNotificationTemplate,
  deleteNotificationTemplate,
  getAdminNotifications,
  sendAdminNotification,
  updateNotificationTemplateSchedule,
} from "../../../lib/features/notifications/services/admin_notification_service";
import type {
  CreateNotificationTemplateInput,
  NotificationAudience,
  NotificationTemplateSchedule,
  SendAdminNotificationInput,
} from "../../../lib/features/notifications/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function parseInput(value: unknown): SendAdminNotificationInput | null {
  if (!isRecord(value)) return null;
  const audience = value.audience;
  if (
    audience !== "all_members" &&
    audience !== "active_subscribers" &&
    audience !== "selected_members"
  ) {
    return null;
  }

  if (typeof value.title !== "string" || typeof value.body !== "string") return null;
  if (!Array.isArray(value.recipientIds) || !value.recipientIds.every((id) => typeof id === "string")) {
    return null;
  }

  const actionLabel = nullableString(value.actionLabel);
  const actionUrl = nullableString(value.actionUrl);
  if (actionLabel === undefined || actionUrl === undefined) return null;

  return {
    audience: audience as NotificationAudience,
    recipientIds: [...new Set(value.recipientIds)],
    title: value.title,
    body: value.body,
    actionLabel,
    actionUrl,
  };
}

function parseSchedule(value: unknown): NotificationTemplateSchedule | null {
  if (!isRecord(value)) return null;
  if (!Number.isInteger(value.minute) || !Number.isInteger(value.hour)) return null;
  if (!Array.isArray(value.daysOfWeek) || !value.daysOfWeek.every((day) => Number.isInteger(day))) return null;
  const minute = value.minute as number;
  const hour = value.hour as number;
  const daysOfWeek = [...new Set(value.daysOfWeek as number[])].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23 || daysOfWeek.length !== value.daysOfWeek.length) return null;
  return { minute, hour, daysOfWeek };
}

function parseTemplateInput(value: unknown): CreateNotificationTemplateInput | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.scheduleEnabled !== "boolean") return null;
  const notification = parseInput(value);
  const schedule = parseSchedule(value.schedule);
  if (!notification || !schedule) return null;
  return { ...notification, name: value.name, scheduleEnabled: value.scheduleEnabled, schedule };
}

function errorResponse(error: unknown) {
  if (error instanceof AdminNotificationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  console.error("Admin notification route failed:", error);
  return NextResponse.json(
    { error: "The notification center is temporarily unavailable." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    const data = await getAdminNotifications();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Invalid notification details." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const action = typeof body.action === "string" ? body.action : "send";
    if (action === "create-template") {
      const input = parseTemplateInput(body);
      if (!input) {
        return NextResponse.json(
          { error: "Invalid notification template." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      const templateId = await createNotificationTemplate(input);
      return NextResponse.json({ templateId }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "save-template-schedule") {
      const schedule = parseSchedule(body.schedule);
      if (typeof body.templateId !== "string" || typeof body.scheduleEnabled !== "boolean" || !schedule) {
        return NextResponse.json(
          { error: "Invalid notification schedule." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      await updateNotificationTemplateSchedule({
        templateId: body.templateId,
        scheduleEnabled: body.scheduleEnabled,
        schedule,
      });
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "delete-template") {
      if (typeof body.templateId !== "string") {
        return NextResponse.json(
          { error: "Invalid notification template." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      await deleteNotificationTemplate(body.templateId);
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    const input = parseInput(body);
    if (!input) {
      return NextResponse.json(
        { error: "Invalid notification details." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await sendAdminNotification(input);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
