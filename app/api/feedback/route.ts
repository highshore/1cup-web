import { NextResponse } from "next/server";
import { admin } from "../../lib/supabase/server";

export const runtime = "nodejs";

// POST /api/feedback  { uid?: string, survey: {...} }
// Surveys are submitted from a public link (often not logged in), but the feedback
// table's RLS insert CHECK is user_id = current_uid(), which rejects anon/param uids.
// Insert server-side with the service role instead.
export async function POST(req: Request) {
  try {
    const { uid, survey } = await req.json();
    if (!survey || typeof survey !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const db = admin();
    const { error } = await db.from("feedback").insert({
      id: crypto.randomUUID(),
      kind: "survey",
      user_id: uid && uid !== "anonymous" ? uid : null,
      survey,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("feedback:", err);
    return NextResponse.json({ error: "제출에 실패했습니다." }, { status: 500 });
  }
}
