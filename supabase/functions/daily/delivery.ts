// Delivery core for 영어 한잔 Daily. The scheduler tick uses it today; the signup flow
// will use it to send the free lesson the moment someone finishes signing up.
//
// Order of operations for every send, and why:
//   1. Write the delivery row first. (subscription_id, kind, for_date) is unique, so an
//      overlapping or retried tick that reaches the same slot inserts nothing and sends
//      nothing. That row is the only duplicate guard there is.
//   2. Send through NHN Alimtalk, keyed back to the row by recipientGroupingKey.
//   3. Record per-recipient results, then move each subscription to its next slot.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendKakaoMessages } from "../_shared/kakao.ts";

export type Track = "business" | "tech";
export type DeliveryKind = "lesson" | "review" | "trial_ended";

export interface Subscription {
  id: string;
  customer_id: string;
  track: Track;
  recipient_phone: string;
  recipient_name: string | null;
  delivery_time: string;
  status: "trial" | "trial_ended" | "active" | "cancelled";
  next_send_at: string | null;
  paid_until?: string | null;
}

interface Lesson {
  id: string;
  track: Track;
  publish_on: string;
  expression: string;
  meaning: string;
  examples: Array<{ en?: string; ko?: string }>;
}

interface PlannedDelivery {
  sub: Subscription;
  kind: DeliveryKind;
  forDate: string;
  lesson?: Lesson;
  reviewLessons?: Lesson[];
}

interface ClaimedDelivery extends PlannedDelivery {
  id: string;
  accessToken: string;
}

export interface TemplateCodes {
  // Which variables the codes expect; see the daily_template_config migration.
  style: "daily" | "send-article";
  lesson: string;
  review: string;
  trialEnded: string;
}

// A slot more than this late is skipped rather than sent: after an outage, a morning
// lesson arriving at 3 a.m. is worse than one missed lesson.
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
// A pending row this old belongs to a tick that died between claiming and sending.
const ORPHAN_AFTER_MS = 10 * 60 * 1000;
const DUE_BATCH = 500;

const TRACK_LABEL: Record<Track, string> = {
  business: "비즈니스 영어",
  tech: "테크 영어",
};

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in Asia/Seoul. */
export function kstDate(d: Date): string {
  return KST_DATE.format(d);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a YYYY-MM-DD date. */
export function isoDow(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Template codes from daily_config, falling back to the DAILY_TEMPLATE_* secrets. */
export async function templateCodes(db: SupabaseClient): Promise<TemplateCodes | null> {
  const { data } = await db
    .from("daily_config")
    .select("template_style, lesson_template, review_template, trial_ended_template")
    .eq("id", "settings")
    .maybeSingle();
  const lesson = data?.lesson_template || Deno.env.get("DAILY_TEMPLATE_LESSON");
  const review = data?.review_template || Deno.env.get("DAILY_TEMPLATE_REVIEW");
  const trialEnded = data?.trial_ended_template || Deno.env.get("DAILY_TEMPLATE_TRIAL_ENDED");
  if (!lesson || !review || !trialEnded) return null;
  return { style: data?.template_style === "send-article" ? "send-article" : "daily", lesson, review, trialEnded };
}

function siteUrl(): string {
  return (Deno.env.get("DAILY_SITE_URL") ?? "https://1cupenglish.com").replace(/\/$/, "");
}

function customerName(sub: Subscription): string {
  const name = (sub.recipient_name ?? "").trim();
  return name !== "" ? name : "고객님";
}

// ---------------------------------------------------------------------------
// Planning: what each due subscription should get for its slot
// ---------------------------------------------------------------------------

async function lessonFor(
  db: SupabaseClient,
  track: Track,
  forDate: string,
  latestOnOrBefore: boolean,
): Promise<Lesson | null> {
  let query = db
    .from("daily_lessons")
    .select("id, track, publish_on, expression, meaning, examples")
    .eq("track", track)
    .eq("status", "ready");
  query = latestOnOrBefore
    ? query.lte("publish_on", forDate).order("publish_on", { ascending: false }).limit(1)
    : query.eq("publish_on", forDate).limit(1);
  const { data, error } = await query;
  if (error) throw new Error(`lesson lookup failed: ${error.message}`);
  return (data?.[0] as Lesson | undefined) ?? null;
}

async function hasSentLesson(db: SupabaseClient, subscriptionId: string): Promise<boolean> {
  const { count, error } = await db
    .from("daily_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", subscriptionId)
    .eq("kind", "lesson")
    .eq("status", "sent");
  if (error) throw new Error(`trial check failed: ${error.message}`);
  return (count ?? 0) > 0;
}

async function weekLessons(
  db: SupabaseClient,
  subscriptionId: string,
  saturday: string,
): Promise<Lesson[]> {
  const { data, error } = await db
    .from("daily_deliveries")
    .select("lesson:daily_lessons(id, track, publish_on, expression, meaning, examples)")
    .eq("subscription_id", subscriptionId)
    .eq("kind", "lesson")
    .eq("status", "sent")
    .gte("for_date", addDays(saturday, -5))
    .lte("for_date", addDays(saturday, -1))
    .order("for_date", { ascending: true });
  if (error) throw new Error(`review lookup failed: ${error.message}`);
  return (data ?? [])
    .map((row) => (row as unknown as { lesson: Lesson | null }).lesson)
    .filter((lesson): lesson is Lesson => lesson !== null);
}

/**
 * What a subscription gets for the slot on `forDate`, or a reason it gets nothing.
 * A trial that has already had its lesson gets the trial-ended notice instead.
 */
export async function planSlot(
  db: SupabaseClient,
  sub: Subscription,
  forDate: string,
): Promise<PlannedDelivery | { skip: "no-lesson" | "no-review" | "sunday" | "unpaid" }> {
  const dow = isoDow(forDate);
  if (dow === 7) return { skip: "sunday" };
  // A paid subscription past the end of its paid period gets nothing until a renewal
  // extends it (the billing run ends it for good after the grace days).
  if (sub.status === "active" && sub.paid_until && new Date(sub.paid_until).getTime() <= Date.now()) {
    return { skip: "unpaid" };
  }

  if (sub.status === "trial") {
    if (await hasSentLesson(db, sub.id)) {
      return { sub, kind: "trial_ended", forDate };
    }
    // The free lesson. On a Saturday there is no lesson for the day, so the most
    // recent one stands in.
    const lesson = await lessonFor(db, sub.track, forDate, dow === 6);
    return lesson ? { sub, kind: "lesson", forDate, lesson } : { skip: "no-lesson" };
  }

  if (dow === 6) {
    const reviewLessons = await weekLessons(db, sub.id, forDate);
    return reviewLessons.length > 0
      ? { sub, kind: "review", forDate, reviewLessons }
      : { skip: "no-review" };
  }

  const lesson = await lessonFor(db, sub.track, forDate, false);
  return lesson ? { sub, kind: "lesson", forDate, lesson } : { skip: "no-lesson" };
}

// ---------------------------------------------------------------------------
// Claiming: the delivery row is written before anything is sent
// ---------------------------------------------------------------------------

async function claim(db: SupabaseClient, plans: PlannedDelivery[]): Promise<ClaimedDelivery[]> {
  if (plans.length === 0) return [];
  const rows = plans.map((p) => ({
    subscription_id: p.sub.id,
    kind: p.kind,
    for_date: p.forDate,
    lesson_id: p.lesson?.id ?? null,
    review_lesson_ids: p.reviewLessons?.map((l) => l.id) ?? [],
  }));

  // ON CONFLICT DO NOTHING ... RETURNING: only rows this call created come back.
  const { data: inserted, error } = await db
    .from("daily_deliveries")
    .upsert(rows, { onConflict: "subscription_id,kind,for_date", ignoreDuplicates: true })
    .select("id, subscription_id, kind, for_date, access_token");
  if (error) throw new Error(`claim failed: ${error.message}`);

  const claimed = new Map<string, { id: string; access_token: string }>();
  for (const row of inserted ?? []) {
    claimed.set(`${row.subscription_id}|${row.kind}|${row.for_date}`, row);
  }

  // Rows left pending by a tick that died before sending, and rows whose send failed,
  // are this call's to (re)send. A subscription is due once per slot, so a failed row is
  // retried at most once per slot, never in a loop.
  const unclaimed = plans.filter((p) => !claimed.has(`${p.sub.id}|${p.kind}|${p.forDate}`));
  if (unclaimed.length > 0) {
    const orphanCutoff = new Date(Date.now() - ORPHAN_AFTER_MS).toISOString();
    const { data: orphans, error: orphanError } = await db
      .from("daily_deliveries")
      .select("id, subscription_id, kind, for_date, access_token")
      .in("subscription_id", unclaimed.map((p) => p.sub.id))
      .or(`status.eq.failed,and(status.eq.pending,created_at.lt.${orphanCutoff})`);
    if (orphanError) throw new Error(`orphan lookup failed: ${orphanError.message}`);
    for (const row of orphans ?? []) {
      claimed.set(`${row.subscription_id}|${row.kind}|${row.for_date}`, row);
    }
  }

  return plans.flatMap((p) => {
    const row = claimed.get(`${p.sub.id}|${p.kind}|${p.forDate}`);
    return row ? [{ ...p, id: row.id, accessToken: row.access_token }] : [];
  });
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function siteHost(): string {
  return siteUrl().replace(/^https?:\/\//, "");
}

function linkPath(d: ClaimedDelivery): string {
  if (d.kind === "lesson") return `/daily/l/${d.accessToken}`;
  if (d.kind === "review") return `/daily/r/${d.accessToken}`;
  return `/daily/subscribe?t=${d.accessToken}`;
}

// The approved 1cup article template, reused for the dry run: one title line, the name,
// and a button to https://#{article-link} (the template adds the scheme itself).
function sendArticleParameter(d: ClaimedDelivery): Record<string, string> {
  const track = TRACK_LABEL[d.sub.track];
  const title =
    d.kind === "lesson" && d.lesson
      ? `[${track}] 오늘의 표현 ${d.lesson.expression}: ${d.lesson.meaning}`
      : d.kind === "review" && d.reviewLessons
      ? `[영어 한잔 Daily] 이번 주 복습: ${d.reviewLessons.map((l) => l.expression).join(", ")}`
      : `[영어 한잔 Daily] ${track} 무료 체험이 끝났어요`;
  return {
    "korean-title": title,
    "customer-name": customerName(d.sub),
    "article-link": `${siteHost()}${linkPath(d)}`,
  };
}

// Variable names must match the approved templates exactly (see ALIMTALK_TEMPLATES.md).
function templateParameter(d: ClaimedDelivery, style: TemplateCodes["style"] = "daily"): Record<string, string> {
  if (style === "send-article") return sendArticleParameter(d);
  const name = customerName(d.sub);
  const track = TRACK_LABEL[d.sub.track];
  if (d.kind === "lesson" && d.lesson) {
    return {
      name,
      track,
      expression: d.lesson.expression,
      meaning: d.lesson.meaning,
      example: d.lesson.examples?.[0]?.en ?? "",
      token: d.accessToken,
    };
  }
  if (d.kind === "review" && d.reviewLessons) {
    return {
      name,
      count: String(d.reviewLessons.length),
      expressions: d.reviewLessons.map((l) => `· ${l.expression}`).join("\n"),
      token: d.accessToken,
    };
  }
  return { name, track, token: d.accessToken };
}

// Plain-text version for the LMS fallback, sent only when Alimtalk cannot be delivered
// (no KakaoTalk on that number, template problem, Kakao outage).
function fallbackText(d: ClaimedDelivery): string {
  const p = templateParameter(d);
  if (d.kind === "lesson") {
    return `[영어 한잔 Daily] 오늘의 표현\n\n${p.expression}\n${p.meaning}\n\n레슨 보기: ${siteUrl()}/daily/l/${p.token}`;
  }
  if (d.kind === "review") {
    return `[영어 한잔 Daily] 이번 주 복습\n\n${p.expressions}\n\n복습하기: ${siteUrl()}/daily/r/${p.token}`;
  }
  return `[영어 한잔 Daily] 무료 체험 종료 안내\n\n${p.track} 무료 체험이 끝났어요. 계속 받으려면 구독해주세요.\n\n구독 안내: ${siteUrl()}/daily/subscribe?t=${p.token}`;
}

interface SendResult {
  sentIds: string[];
  failed: Array<{ id: string; error: string }>;
  requestId: string | null;
}

async function sendBatch(
  deliveries: ClaimedDelivery[],
  templateCode: string,
  style: TemplateCodes["style"],
): Promise<SendResult> {
  const result: SendResult = { sentIds: [], failed: [], requestId: null };
  if (deliveries.length === 0) return result;

  // Off unless asked for: NHN rejects the whole message (-2502) when the Kakao channel
  // has no text-resend (대체 발송) setting, which ours does not have yet.
  const smsFallback = Deno.env.get("DAILY_SMS_FALLBACK") === "true";
  const recipientList = deliveries.map((d) => ({
    recipientNo: d.sub.recipient_phone,
    templateParameter: templateParameter(d, style),
    recipientGroupingKey: d.id,
    ...(smsFallback
      ? {
        resendParameter: {
          isResend: true,
          resendType: "LMS",
          resendTitle: "영어 한잔 Daily",
          resendContent: fallbackText(d),
        },
      }
      : {}),
  }));

  try {
    // NHN accepts up to 1,000 recipients per request; DUE_BATCH keeps us well under.
    const response = await sendKakaoMessages(recipientList, templateCode) as {
      message?: {
        requestId?: string;
        sendResults?: Array<{ recipientGroupingKey?: string; resultCode?: number; resultMessage?: string }>;
      };
    };
    result.requestId = response.message?.requestId ?? null;
    const byKey = new Map(
      (response.message?.sendResults ?? []).map((r) => [r.recipientGroupingKey ?? "", r]),
    );
    for (const d of deliveries) {
      const r = byKey.get(d.id);
      if (r && r.resultCode === 0) result.sentIds.push(d.id);
      else result.failed.push({ id: d.id, error: r ? `${r.resultCode}: ${r.resultMessage}` : "no result" });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    for (const d of deliveries) result.failed.push({ id: d.id, error: message });
  }
  return result;
}

/** Sends claimed deliveries and records the outcome on each row and subscription. */
export async function sendClaimed(
  db: SupabaseClient,
  claimed: ClaimedDelivery[],
  codes: TemplateCodes,
): Promise<{ sent: number; failed: number }> {
  const byKind: Record<DeliveryKind, ClaimedDelivery[]> = { lesson: [], review: [], trial_ended: [] };
  for (const d of claimed) byKind[d.kind].push(d);

  const results = await Promise.all([
    sendBatch(byKind.lesson, codes.lesson, codes.style),
    sendBatch(byKind.review, codes.review, codes.style),
    sendBatch(byKind.trial_ended, codes.trialEnded, codes.style),
  ]);

  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.sentIds.length > 0) {
      const { error } = await db
        .from("daily_deliveries")
        .update({ status: "sent", sent_at: now, provider_request_id: r.requestId, error: null })
        .in("id", r.sentIds);
      if (error) console.error("marking sent failed:", error.message);
      sent += r.sentIds.length;
    }
    for (const f of r.failed) {
      const { error } = await db
        .from("daily_deliveries")
        .update({ status: "failed", provider_request_id: r.requestId, error: f.error.slice(0, 500) })
        .eq("id", f.id);
      if (error) console.error("marking failed failed:", error.message);
      failed += 1;
    }
  }

  const sentSet = new Set(results.flatMap((r) => r.sentIds));
  const sentSubs = claimed.filter((d) => sentSet.has(d.id)).map((d) => d.sub.id);
  if (sentSubs.length > 0) {
    await db.from("daily_subscriptions").update({ last_sent_at: now }).in("id", sentSubs);
  }

  // The trial ends whether or not its notice got through; a failed notice must not
  // turn into another free lesson on the next slot.
  const endedSubs = byKind.trial_ended.map((d) => d.sub.id);
  if (endedSubs.length > 0) {
    const { error } = await db
      .from("daily_subscriptions")
      .update({ status: "trial_ended", trial_ended_at: now, next_send_at: null })
      .in("id", endedSubs)
      .eq("status", "trial");
    if (error) console.error("ending trials failed:", error.message);
  }

  return { sent, failed };
}

// ---------------------------------------------------------------------------
// The free lesson, sent the moment someone finishes signing up
// ---------------------------------------------------------------------------

/** The lesson a new trial gets: the latest ready one on or before today (KST). */
export async function trialLessonFor(db: SupabaseClient, track: Track, now = new Date()): Promise<Lesson | null> {
  return await lessonFor(db, track, kstDate(now), true);
}

/**
 * Sends a new trial its lesson now. Uses the same claim-then-send path as the tick, so
 * if a tick reaches this subscription at the same moment only one of them sends.
 * Returns false when it could not be sent; the next tick slot then retries it, since a
 * trial with no sent lesson is planned as a lesson, not as the trial-ended notice.
 */
export async function sendTrialLesson(
  db: SupabaseClient,
  sub: Subscription,
  lesson: Lesson,
  codes: TemplateCodes,
  now = new Date(),
): Promise<boolean> {
  const claimed = await claim(db, [{ sub, kind: "lesson", forDate: kstDate(now), lesson }]);
  if (claimed.length === 0) return false;
  const outcome = await sendClaimed(db, claimed, codes);
  return outcome.sent === 1;
}

// ---------------------------------------------------------------------------
// The scheduler tick
// ---------------------------------------------------------------------------

export interface TickStats {
  due: number;
  sent: number;
  failed: number;
  stale: number;
  missingLesson: number;
  noReview: number;
  unpaid: number;
  skipped?: string;
}

export async function runTick(db: SupabaseClient, now = new Date()): Promise<TickStats> {
  const stats: TickStats = { due: 0, sent: 0, failed: 0, stale: 0, missingLesson: 0, noReview: 0, unpaid: 0 };

  const codes = await templateCodes(db);
  if (!codes) {
    // Not an error: until Kakao approves the templates there is nothing we may send.
    // Schedules are left alone so nobody's slot is consumed in the meantime.
    return { ...stats, skipped: "templates-not-configured" };
  }

  const { data: due, error } = await db
    .from("daily_subscriptions")
    .select("id, customer_id, track, recipient_phone, recipient_name, delivery_time, status, next_send_at, paid_until")
    .in("status", ["trial", "active"])
    .lte("next_send_at", now.toISOString())
    .order("next_send_at", { ascending: true })
    .limit(DUE_BATCH);
  if (error) throw new Error(`due lookup failed: ${error.message}`);

  const subs = (due ?? []) as Subscription[];
  stats.due = subs.length;
  if (subs.length === 0) return stats;

  const plans: PlannedDelivery[] = [];
  for (const sub of subs) {
    const slot = new Date(sub.next_send_at as string);
    if (now.getTime() - slot.getTime() > STALE_AFTER_MS) {
      stats.stale += 1;
      continue;
    }
    const plan = await planSlot(db, sub, kstDate(slot));
    if ("skip" in plan) {
      if (plan.skip === "no-lesson") stats.missingLesson += 1;
      if (plan.skip === "no-review") stats.noReview += 1;
      if (plan.skip === "unpaid") stats.unpaid += 1;
      continue;
    }
    plans.push(plan);
  }

  const claimed = await claim(db, plans);
  const outcome = await sendClaimed(db, claimed, codes);
  stats.sent = outcome.sent;
  stats.failed = outcome.failed;

  // Every due subscription moves on, sent or skipped; ended trials already have
  // next_send_at cleared and the function leaves them alone.
  const { error: rescheduleError } = await db.rpc("daily_reschedule", {
    p_subscription_ids: subs.map((s) => s.id),
  });
  if (rescheduleError) throw new Error(`reschedule failed: ${rescheduleError.message}`);

  return stats;
}
