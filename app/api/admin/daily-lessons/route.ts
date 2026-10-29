import { after, NextResponse } from "next/server";
import { admin } from "../../../lib/supabase/server";
import { AdminSentenceError, requireDailyAdmin } from "../../../lib/features/daily/server/admin_sentences";
import { fillMissingLessonAudio } from "../../../lib/features/daily/server/audio";

export const runtime = "nodejs";
// Approving lessons reads their audio after the response (see below).
export const maxDuration = 300;

// POST { id | ids, status: "ready" | "draft" }: approve lesson drafts (only ready lessons
// are sent on their date) or take approved ones back to draft. ids approves several at
// once from the 콘텐츠 list.
export async function POST(req: Request) {
  try {
    await requireDailyAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const raw = Array.isArray(body.ids) ? body.ids : [body.id];
    const ids = raw.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id));
    const status = body.status === "ready" || body.status === "draft" ? body.status : null;
    if (ids.length === 0 || ids.length !== raw.length || ids.length > 100 || !status) {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    const { data, error } = await admin().from("daily_lessons").update({ status }).in("id", ids).select("id");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "레슨을 찾지 못했어요." }, { status: 404 });
    // Approved lessons get their audio read now, so the first reader does not wait for it.
    if (status === "ready") after(() => fillMissingLessonAudio({ lessonIds: data.map((row) => row.id) }));
    return NextResponse.json({ success: true, updated: data.length });
  } catch (error) {
    if (error instanceof AdminSentenceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("api/admin/daily-lessons:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
