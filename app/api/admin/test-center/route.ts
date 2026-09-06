import { NextRequest } from "next/server";

import { getExamCenter, noStore, requireExamAdmin, updateExamWorkspace } from "../../../lib/features/exam/services/exam_admin_server";

export const runtime = "nodejs";
export const maxDuration = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  if (!await requireExamAdmin()) return noStore({ error: "Administrator access is required." }, 403);
  try {
    return noStore(await getExamCenter());
  } catch (cause) {
    console.error("[exam-center] load failed", cause);
    return noStore({ error: "The exam workspace is temporarily unavailable." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return noStore({ error: "Invalid request origin." }, 403);

  const adminUserId = await requireExamAdmin();
  if (!adminUserId) return noStore({ error: "Administrator access is required." }, 403);

  try {
    const input = await request.json();
    if (!isRecord(input) || typeof input.action !== "string") return noStore({ error: "Invalid exam workspace request." }, 400);
    return noStore(await updateExamWorkspace(input.action, input, adminUserId));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The exam workspace could not be updated.";
    return noStore({ error: message }, 400);
  }
}
