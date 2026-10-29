// Server-only: finds what a Kakao message's button opens. The token in the link is the
// credential (36 random hex characters per delivery), so these pages need no login.
import { admin } from "../../../supabase/server";
import type { DailyField, DailyTrack } from "../constants";
import { customerForSession } from "./session";

export interface DailyLessonContent {
  id: string;
  track: DailyTrack;
  publishOn: string;
  field: DailyField | null;
  expression: string;
  meaning: string;
  pronunciation: string | null;
  stress: string | null;
  nuance: string | null;
  similar: string[];
  /** ko_highlight: the words in ko that carry the expression, marked like it is in en. */
  examples: Array<{ context?: string; en: string; ko?: string; ko_highlight?: string }>;
  dialogue: Array<{ speaker?: string; role?: string; en: string; ko?: string; ko_highlight?: string }>;
  /** ko: the whole sentence, answer filled in, in Korean; shown once answered. */
  quiz: { prompt: string; options: string[]; answer: number; explanation?: string; ko?: string; ko_highlight?: string } | null;
}

export interface DailyDeliveryView {
  kind: "lesson" | "review" | "trial_ended";
  forDate: string;
  track: DailyTrack;
  name: string | null;
  isTrial: boolean;
  /** Another track this subscriber already pays for, so a trial lesson can say "also get this one". */
  paidOtherTrack: DailyTrack | null;
  deliveryTime: string;
  lessons: DailyLessonContent[];
}

export const LESSON_COLUMNS =
  "id, track, publish_on, field, expression, meaning, pronunciation, stress, nuance, similar_expressions, examples, dialogue, quiz";

export type LessonRow = {
  id: string;
  track: DailyTrack;
  publish_on: string;
  field: DailyField | null;
  expression: string;
  meaning: string;
  pronunciation: string | null;
  stress: string | null;
  nuance: string | null;
  similar_expressions: string[] | null;
  examples: DailyLessonContent["examples"] | null;
  dialogue: DailyLessonContent["dialogue"] | null;
  quiz: DailyLessonContent["quiz"];
};

export function toContent(row: LessonRow): DailyLessonContent {
  return {
    id: row.id,
    track: row.track,
    publishOn: row.publish_on,
    field: row.field,
    expression: row.expression,
    meaning: row.meaning,
    pronunciation: row.pronunciation,
    stress: row.stress,
    nuance: row.nuance,
    similar: row.similar_expressions ?? [],
    examples: row.examples ?? [],
    dialogue: row.dialogue ?? [],
    quiz: row.quiz,
  };
}

export async function getDeliveryByToken(token: string): Promise<DailyDeliveryView | null> {
  if (!/^[0-9a-f]{36}$/.test(token)) return null;
  const db = admin();
  const { data } = await db
    .from("daily_deliveries")
    .select("kind, for_date, lesson_id, review_lesson_ids, subscription:daily_subscriptions(customer_id, track, recipient_name, status, delivery_time)")
    .eq("access_token", token)
    .maybeSingle();
  if (!data) return null;
  const sub = (data as unknown as {
    subscription: { customer_id: string; track: DailyTrack; recipient_name: string | null; status: string; delivery_time: string } | null;
  }).subscription;
  if (!sub) return null;

  const ids = data.kind === "review" ? (data.review_lesson_ids as string[]) : data.lesson_id ? [data.lesson_id as string] : [];
  let lessons: DailyLessonContent[] = [];
  if (ids.length > 0) {
    const { data: rows } = await db.from("daily_lessons").select(LESSON_COLUMNS).in("id", ids);
    lessons = ((rows ?? []) as LessonRow[])
      .map(toContent)
      .sort((a, b) => a.publishOn.localeCompare(b.publishOn));
  }

  let paidOtherTrack: DailyDeliveryView["paidOtherTrack"] = null;
  if (sub.status === "trial" || sub.status === "trial_ended") {
    const { data: paid } = await db
      .from("daily_subscriptions")
      .select("track")
      .eq("customer_id", sub.customer_id)
      .eq("status", "active")
      .neq("track", sub.track)
      .limit(1)
      .maybeSingle();
    paidOtherTrack = (paid?.track as DailyDeliveryView["paidOtherTrack"]) ?? null;
  }

  return {
    kind: data.kind as DailyDeliveryView["kind"],
    forDate: data.for_date as string,
    track: sub.track,
    name: sub.recipient_name,
    isTrial: sub.status === "trial" || sub.status === "trial_ended",
    paidOtherTrack,
    deliveryTime: sub.delivery_time,
    lessons,
  };
}

export type DeadLinkVisitor = "subscriber" | "not-subscriber" | "unknown";

/**
 * Who opened a lesson or review link that matches no message, so the page can say where
 * to go: a paying subscriber finds their lessons under 내 계정, anyone else subscribes.
 * Without a Daily session in this browser it cannot tell ("unknown").
 */
export async function deadLinkVisitor(sessionToken: string | undefined): Promise<DeadLinkVisitor> {
  const customer = await customerForSession(sessionToken);
  if (!customer) return "unknown";
  const { data } = await admin()
    .from("daily_subscriptions")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("status", "active")
    .limit(1);
  return (data ?? []).length > 0 ? "subscriber" : "not-subscriber";
}
