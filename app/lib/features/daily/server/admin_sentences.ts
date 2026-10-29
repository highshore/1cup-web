// Server-only: 1cup admins moderating 함께 쓰는 문장 and choosing 통역사 PICK
// (terms 제9조의2). The admin is a signed-in 1cup member with account_status 'admin' whose
// phone number is on daily_config.admin_access_phones (admin_access.ts).
import { admin, createServerClientRSC } from "../../../supabase/server";
import { isDailyAdmin } from "./admin_access";
import { maskName } from "./community";

export class AdminSentenceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function requireDailyAdmin(): Promise<string> {
  const client = await createServerClientRSC();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new AdminSentenceError("로그인이 필요해요.", 401);
  const { data } = await client.rpc("current_user_row");
  const row = (Array.isArray(data) ? data[0] : data) as { uid?: string; account_status?: string } | null;
  if (row?.account_status !== "admin" || !row.uid) throw new AdminSentenceError("관리자만 볼 수 있어요.", 403);
  if (!(await isDailyAdmin(row.uid))) throw new AdminSentenceError("관리자만 볼 수 있어요.", 403);
  return row.uid;
}

export async function listSentences() {
  const db = admin();
  const { data, error } = await db
    .from("daily_sentences")
    .select("id, body, hidden_at, picked_at, created_at, lesson_id, customer:daily_customers!daily_sentences_customer_id_fkey(name), lesson:daily_lessons(expression, track, publish_on)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new AdminSentenceError("불러오지 못했어요.", 500);
  const ids = (data ?? []).map((s) => s.id);
  const { data: cups } = ids.length
    ? await db.from("daily_sentence_cups").select("sentence_id").in("sentence_id", ids)
    : { data: [] as Array<{ sentence_id: string }> };
  const counts = new Map<string, number>();
  for (const c of cups ?? []) counts.set(c.sentence_id, (counts.get(c.sentence_id) ?? 0) + 1);
  // display_name is what readers see (the masked Kakao nickname), never the full name.
  return (data ?? []).map(({ customer, ...s }) => ({
    ...s,
    display_name: maskName((customer as unknown as { name: string | null } | null)?.name),
    cups: counts.get(s.id) ?? 0,
  }));
}

export async function moderateSentence(adminUid: string, id: unknown, action: unknown) {
  if (typeof id !== "string") throw new AdminSentenceError("문장을 골라 주세요.");
  const db = admin();
  const { data: sentence } = await db.from("daily_sentences").select("lesson_id").eq("id", id).maybeSingle();
  if (!sentence) throw new AdminSentenceError("문장을 찾을 수 없어요.", 404);
  const now = new Date().toISOString();
  if (action === "hide") {
    // A hidden sentence cannot stay the lesson's PICK.
    await db.from("daily_sentences").update({ hidden_at: now, picked_at: null, picked_by: null }).eq("id", id);
  } else if (action === "unhide") {
    await db.from("daily_sentences").update({ hidden_at: null }).eq("id", id);
  } else if (action === "pick") {
    // One PICK per lesson: the previous one steps down first.
    await db.from("daily_sentences").update({ picked_at: null, picked_by: null }).eq("lesson_id", sentence.lesson_id).neq("id", id);
    const { error } = await db.from("daily_sentences").update({ picked_at: now, picked_by: adminUid, hidden_at: null }).eq("id", id);
    if (error) throw new AdminSentenceError("PICK으로 고르지 못했어요.", 500);
  } else if (action === "unpick") {
    await db.from("daily_sentences").update({ picked_at: null, picked_by: null }).eq("id", id);
  } else {
    throw new AdminSentenceError("알 수 없는 작업이에요.");
  }
}
