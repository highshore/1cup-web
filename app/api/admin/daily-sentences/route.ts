import { NextResponse } from "next/server";
import { AdminSentenceError, listSentences, moderateSentence, requireDailyAdmin } from "../../../lib/features/daily/server/admin_sentences";

export const runtime = "nodejs";

// GET  list recent 함께 쓰는 문장 for moderation.
// POST { id, action: "hide" | "unhide" | "pick" | "unpick" }
function failure(error: unknown) {
  if (error instanceof AdminSentenceError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("api/admin/daily-sentences:", error);
  return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 500 });
}

export async function GET() {
  try {
    await requireDailyAdmin();
    return NextResponse.json({ sentences: await listSentences() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: Request) {
  try {
    const adminUid = await requireDailyAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await moderateSentence(adminUid, body.id, body.action);
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
