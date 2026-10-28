import { NextResponse } from "next/server";
import { admin } from "../../../lib/supabase/server";
import { AdminSentenceError, requireDailyAdmin } from "../../../lib/features/daily/server/admin_sentences";

export const runtime = "nodejs";

// POST { id, status: "ready" | "draft" }: approve a lesson draft (only ready lessons are
// sent on their date) or take an approved one back to draft.
export async function POST(req: Request) {
  try {
    await requireDailyAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
    const status = body.status === "ready" || body.status === "draft" ? body.status : null;
    if (!id || !status) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    const { data, error } = await admin()
      .from("daily_lessons")
      .update({ status })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "레슨을 찾지 못했어요." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminSentenceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("api/admin/daily-lessons:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
