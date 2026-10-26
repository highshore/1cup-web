// Server-only: what happens around a lesson besides the lesson itself.
//
//   함께 쓰는 문장  one sentence per person per lesson, ☕ reactions, 통역사 PICK
//   1분 퀴즈        answers, and the "같이 푼 퀴즈" numbers once 10 people answered
//   연속 기록       consecutive delivered lessons whose quiz the reader solved
//   내 표현장       every lesson the reader received, newest first
//   친구 초대       the reader's invite link and what it has earned
//
// A lesson page is identified by its message's token, which leads to one subscription.
// Writing a sentence or answering the quiz is for that subscription's own customer
// (signed in, by phone code, Kakao or the message link); everyone else on the page sees
// the wall. Counts of other people are shown only when 10 or more are behind them, and
// are never padded.
import crypto from "crypto";
import { admin } from "../../../supabase/server";
import type { DailySessionCustomer } from "./session";

/** "같이 푼 퀴즈" and "같은 표현을 받은 사람" appear only from this many people. */
export const DAILY_CROWD_MIN = 10;
const SENTENCE_LIMIT = 50;

export class CommunityError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

interface LessonRef {
  lessonId: string;
  subscriptionId: string;
  ownerId: string;
  track: "business" | "tech";
  publishOn: string;
  quiz: { options: string[]; answer: number } | null;
}

async function lessonRef(token: string): Promise<LessonRef> {
  if (!/^[0-9a-f]{36}$/.test(token ?? "")) throw new CommunityError("레슨을 찾을 수 없어요.", 404);
  const { data } = await admin()
    .from("daily_deliveries")
    .select("kind, lesson_id, subscription_id, subscription:daily_subscriptions(customer_id), lesson:daily_lessons(track, publish_on, quiz)")
    .eq("access_token", token)
    .maybeSingle();
  const row = data as unknown as {
    kind: string;
    lesson_id: string | null;
    subscription_id: string;
    subscription: { customer_id: string } | null;
    lesson: { track: "business" | "tech"; publish_on: string; quiz: LessonRef["quiz"] } | null;
  } | null;
  if (!row || row.kind !== "lesson" || !row.lesson_id || !row.lesson || !row.subscription) {
    throw new CommunityError("레슨을 찾을 수 없어요.", 404);
  }
  return {
    lessonId: row.lesson_id,
    subscriptionId: row.subscription_id,
    ownerId: row.subscription.customer_id,
    track: row.lesson.track,
    publishOn: row.lesson.publish_on,
    quiz: row.lesson.quiz,
  };
}

function requireOwner(ref: LessonRef, viewer: DailySessionCustomer | null) {
  if (!viewer) throw new CommunityError("로그인하면 쓸 수 있어요.", 401);
  if (viewer.id !== ref.ownerId) throw new CommunityError("이 레슨을 받은 사람만 쓸 수 있어요.", 403);
  return viewer;
}

// ---------------------------------------------------------------------------
// Lesson page
// ---------------------------------------------------------------------------

interface SentenceRow {
  id: string;
  customer_id: string;
  body: string;
  display_name: string | null;
  hidden_at: string | null;
  picked_at: string | null;
  created_at: string;
}

export interface DailySentence {
  id: string;
  body: string;
  displayName: string | null;
  cups: number;
  cupped: boolean;
  mine: boolean;
  picked: boolean;
  hidden: boolean;
}

async function quizStats(lessonId: string, quiz: LessonRef["quiz"]) {
  if (!quiz) return null;
  const { data } = await admin().from("daily_quiz_answers").select("choice, correct").eq("lesson_id", lessonId);
  const rows = data ?? [];
  if (rows.length < DAILY_CROWD_MIN) return { total: rows.length, shown: false as const };
  const correct = rows.filter((r) => r.correct).length;
  const wrongCounts = new Map<number, number>();
  for (const r of rows) if (!r.correct) wrongCounts.set(r.choice, (wrongCounts.get(r.choice) ?? 0) + 1);
  const [topWrong] = [...wrongCounts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total: rows.length,
    shown: true as const,
    correctRate: Math.round((correct / rows.length) * 100),
    topWrong: topWrong ? { option: quiz.options[topWrong[0]] ?? "", rate: Math.round((topWrong[1] / rows.length) * 100) } : null,
  };
}

export async function lessonCommunity(token: string, viewer: DailySessionCustomer | null) {
  const ref = await lessonRef(token);
  const db = admin();
  const [{ data: sentences }, { count: together }, { data: myAnswer }, { data: pick }] = await Promise.all([
    db.from("daily_sentences")
      .select("id, customer_id, body, display_name, hidden_at, picked_at, created_at")
      .eq("lesson_id", ref.lessonId)
      .order("created_at", { ascending: false })
      .limit(SENTENCE_LIMIT + 1),
    db.from("daily_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", ref.lessonId)
      .eq("kind", "lesson")
      .eq("status", "sent"),
    viewer
      ? db.from("daily_quiz_answers").select("choice").eq("lesson_id", ref.lessonId).eq("customer_id", viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // 어제의 통역사 PICK: the latest pick from an earlier lesson on this track.
    db.from("daily_sentences")
      .select("body, display_name, lesson:daily_lessons!inner(expression, track, publish_on)")
      .not("picked_at", "is", null)
      .is("hidden_at", null)
      .eq("lesson.track", ref.track)
      .lt("lesson.publish_on", ref.publishOn)
      .order("picked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const visible = ((sentences ?? []) as SentenceRow[]).filter((s) => !s.hidden_at || s.customer_id === viewer?.id);
  const ids = visible.map((s) => s.id);
  const { data: cups } = ids.length
    ? await db.from("daily_sentence_cups").select("sentence_id, customer_id").in("sentence_id", ids)
    : { data: [] as Array<{ sentence_id: string; customer_id: string }> };
  const cupCount = new Map<string, number>();
  const cuppedByViewer = new Set<string>();
  for (const c of cups ?? []) {
    cupCount.set(c.sentence_id, (cupCount.get(c.sentence_id) ?? 0) + 1);
    if (c.customer_id === viewer?.id) cuppedByViewer.add(c.sentence_id);
  }
  const list: DailySentence[] = visible
    .map((s) => ({
      id: s.id,
      body: s.body,
      displayName: s.display_name,
      cups: cupCount.get(s.id) ?? 0,
      cupped: cuppedByViewer.has(s.id),
      mine: s.customer_id === viewer?.id,
      picked: Boolean(s.picked_at),
      hidden: Boolean(s.hidden_at),
    }))
    // PICK first, then the most ☕, then the newest (the query order).
    .sort((a, b) => Number(b.picked) - Number(a.picked) || b.cups - a.cups);

  const answered = (myAnswer as { choice: number } | null)?.choice ?? null;
  const pickRow = pick as unknown as { body: string; display_name: string | null; lesson: { expression: string } } | null;
  return {
    canWrite: viewer?.id === ref.ownerId,
    signedIn: Boolean(viewer),
    sentences: list.slice(0, SENTENCE_LIMIT),
    mine: list.find((s) => s.mine) ?? null,
    together: (together ?? 0) >= DAILY_CROWD_MIN ? together : null,
    quiz: answered === null ? { answered: null, stats: null } : { answered, stats: await quizStats(ref.lessonId, ref.quiz) },
    yesterdayPick: pickRow ? { body: pickRow.body, displayName: pickRow.display_name, expression: pickRow.lesson.expression } : null,
    progress: viewer ? await progress(viewer.id) : null,
  };
}

export async function saveSentence(token: string, viewer: DailySessionCustomer | null, input: { body: unknown; displayName: unknown }) {
  const ref = await lessonRef(token);
  const customer = requireOwner(ref, viewer);
  const body = String(input.body ?? "").replace(/\s+/g, " ").trim();
  const displayName = String(input.displayName ?? "").trim().slice(0, 12) || null;
  if (body.length < 2 || body.length > 200) throw new CommunityError("문장은 2자 이상 200자 이하로 써 주세요.");
  const db = admin();
  const { data: existing } = await db
    .from("daily_sentences")
    .select("picked_at")
    .eq("lesson_id", ref.lessonId)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (existing?.picked_at) throw new CommunityError("통역사 PICK에 뽑힌 문장은 고칠 수 없어요. 지우는 것은 할 수 있어요.", 409);
  const { error } = await db.from("daily_sentences").upsert(
    {
      lesson_id: ref.lessonId,
      subscription_id: ref.subscriptionId,
      customer_id: customer.id,
      body,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,customer_id" },
  );
  if (error) throw new CommunityError("문장을 올리지 못했어요. 다시 시도해 주세요.", 500);
}

export async function deleteSentence(token: string, viewer: DailySessionCustomer | null) {
  const ref = await lessonRef(token);
  const customer = requireOwner(ref, viewer);
  await admin().from("daily_sentences").delete().eq("lesson_id", ref.lessonId).eq("customer_id", customer.id);
}

/** ☕ on someone else's sentence, or takes it back. Any signed-in Daily customer. */
export async function toggleCup(sentenceId: unknown, viewer: DailySessionCustomer | null): Promise<boolean> {
  if (!viewer) throw new CommunityError("로그인하면 ☕를 보낼 수 있어요.", 401);
  if (typeof sentenceId !== "string") throw new CommunityError("문장을 찾을 수 없어요.", 404);
  const db = admin();
  const { data: sentence } = await db.from("daily_sentences").select("customer_id, hidden_at").eq("id", sentenceId).maybeSingle();
  if (!sentence || sentence.hidden_at) throw new CommunityError("문장을 찾을 수 없어요.", 404);
  if (sentence.customer_id === viewer.id) throw new CommunityError("내 문장에는 ☕를 보낼 수 없어요.");
  const { data: removed } = await db
    .from("daily_sentence_cups")
    .delete()
    .eq("sentence_id", sentenceId)
    .eq("customer_id", viewer.id)
    .select("sentence_id");
  if (removed && removed.length > 0) return false;
  await db.from("daily_sentence_cups").upsert({ sentence_id: sentenceId, customer_id: viewer.id }, { onConflict: "sentence_id,customer_id", ignoreDuplicates: true });
  return true;
}

/** Records the first answer (later ones are ignored) and returns the crowd numbers. */
export async function answerQuiz(token: string, viewer: DailySessionCustomer | null, choice: unknown) {
  const ref = await lessonRef(token);
  const customer = requireOwner(ref, viewer);
  const picked = Number(choice);
  if (!ref.quiz || !Number.isInteger(picked) || picked < 0 || picked >= ref.quiz.options.length) {
    throw new CommunityError("보기를 골라 주세요.");
  }
  await admin().from("daily_quiz_answers").upsert(
    {
      lesson_id: ref.lessonId,
      customer_id: customer.id,
      subscription_id: ref.subscriptionId,
      choice: picked,
      correct: picked === ref.quiz.answer,
    },
    { onConflict: "lesson_id,customer_id", ignoreDuplicates: true },
  );
  return { stats: await quizStats(ref.lessonId, ref.quiz), progress: await progress(customer.id) };
}

// ---------------------------------------------------------------------------
// 연속 기록 and 내 표현장
// ---------------------------------------------------------------------------

const KST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

interface BookRow {
  for_date: string;
  access_token: string;
  lesson: { id: string; track: "business" | "tech"; expression: string; meaning: string; quiz: unknown } | null;
}

async function deliveredLessons(customerId: string) {
  const db = admin();
  const { data: subs } = await db.from("daily_subscriptions").select("id").eq("customer_id", customerId);
  const subIds = (subs ?? []).map((s) => s.id);
  if (subIds.length === 0) return { rows: [] as BookRow[], answers: new Map<string, boolean>() };
  const [{ data: rows }, { data: answers }] = await Promise.all([
    db.from("daily_deliveries")
      .select("for_date, access_token, lesson:daily_lessons(id, track, expression, meaning, quiz)")
      .in("subscription_id", subIds)
      .eq("kind", "lesson")
      .eq("status", "sent")
      .order("for_date", { ascending: false })
      .limit(400),
    db.from("daily_quiz_answers").select("lesson_id, correct").eq("customer_id", customerId),
  ]);
  return {
    rows: ((rows ?? []) as unknown as BookRow[]).filter((r) => r.lesson),
    answers: new Map((answers ?? []).map((a) => [a.lesson_id as string, a.correct as boolean])),
  };
}

/**
 * The streak: consecutive delivered lesson days, newest first, on which the reader
 * solved a quiz. Today's lesson does not break it before it is solved.
 */
function streakOf(rows: BookRow[], answers: Map<string, boolean>): number {
  const days = new Map<string, boolean>();
  for (const r of rows) days.set(r.for_date, (days.get(r.for_date) ?? false) || answers.has(r.lesson!.id));
  const today = KST_DATE.format(new Date());
  let streak = 0;
  for (const [day, solved] of [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    if (solved) streak += 1;
    else if (day === today && streak === 0) continue;
    else break;
  }
  return streak;
}

async function progress(customerId: string) {
  const { rows, answers } = await deliveredLessons(customerId);
  const lessons = new Set(rows.map((r) => r.lesson!.id));
  return { streak: streakOf(rows, answers), expressions: lessons.size };
}

export async function expressionBook(viewer: DailySessionCustomer) {
  const { rows, answers } = await deliveredLessons(viewer.id);
  const seen = new Set<string>();
  const items = rows
    .filter((r) => (seen.has(r.lesson!.id) ? false : (seen.add(r.lesson!.id), true)))
    .map((r) => ({
      date: r.for_date,
      token: r.access_token,
      track: r.lesson!.track,
      expression: r.lesson!.expression,
      meaning: r.lesson!.meaning,
      quiz: r.lesson!.quiz ? (answers.has(r.lesson!.id) ? (answers.get(r.lesson!.id) ? "correct" : "wrong") : "open") : null,
    }));
  return { streak: streakOf(rows, answers), items };
}

// ---------------------------------------------------------------------------
// 친구 초대
// ---------------------------------------------------------------------------

// No 0/O/1/I, so a code read aloud or retyped survives.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newInviteCode(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function isInviteCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z2-9]{8}$/.test(value);
}

export async function inviteInfo(viewer: DailySessionCustomer) {
  const db = admin();
  const { data: me } = await db.from("daily_customers").select("invite_code").eq("id", viewer.id).single();
  let code = me?.invite_code as string | null;
  for (let attempt = 0; !code && attempt < 5; attempt += 1) {
    const candidate = newInviteCode();
    const { error } = await db.from("daily_customers").update({ invite_code: candidate }).eq("id", viewer.id).is("invite_code", null);
    if (!error) {
      const { data: reread } = await db.from("daily_customers").select("invite_code").eq("id", viewer.id).single();
      code = reread?.invite_code ?? null;
    }
  }
  if (!code) throw new CommunityError("초대 링크를 만들지 못했어요. 다시 시도해 주세요.", 500);
  const { data: invites } = await db.from("daily_invites").select("inviter_rewarded_at").eq("inviter_customer_id", viewer.id);
  return {
    code,
    joined: invites?.length ?? 0,
    rewardedDays: (invites ?? []).filter((i) => i.inviter_rewarded_at).length * 7,
    pendingDays: (invites ?? []).filter((i) => !i.inviter_rewarded_at).length * 7,
  };
}

/** Whether a code belongs to a live customer (checked before it is kept in a cookie). */
export async function inviteCodeExists(code: string): Promise<boolean> {
  const { data } = await admin().from("daily_customers").select("id").eq("invite_code", code).is("deleted_at", null).maybeSingle();
  return Boolean(data);
}
