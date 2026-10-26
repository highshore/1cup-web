// Server-only: finds what a Kakao message's button opens. The token in the link is the
// credential (36 random hex characters per delivery), so these pages need no login.
import { admin } from "../../../supabase/server";

export interface DailyLessonContent {
  id: string;
  track: "business" | "tech";
  publishOn: string;
  expression: string;
  meaning: string;
  pronunciation: string | null;
  stress: string | null;
  nuance: string | null;
  similar: string[];
  examples: Array<{ context?: string; en: string; ko?: string }>;
  dialogue: Array<{ speaker?: string; role?: string; en: string; ko?: string }>;
  quiz: { prompt: string; options: string[]; answer: number; explanation?: string } | null;
  clip: { url: string; caption: string | null; source: string | null } | null;
}

export interface DailyDeliveryView {
  kind: "lesson" | "review" | "trial_ended";
  forDate: string;
  track: "business" | "tech";
  name: string | null;
  isTrial: boolean;
  /** Another track this subscriber already pays for, so a trial lesson can say "also get this one". */
  paidOtherTrack: "business" | "tech" | null;
  deliveryTime: string;
  lessons: DailyLessonContent[];
}

const LESSON_COLUMNS =
  "id, track, publish_on, expression, meaning, pronunciation, stress, nuance, similar_expressions, examples, dialogue, quiz, clip_path, clip_caption, clip_source";

// Signed clip links outlive a long lesson read but not a forwarded screenshot of the URL.
const CLIP_URL_TTL_SECONDS = 6 * 60 * 60;

type LessonRow = {
  id: string;
  track: "business" | "tech";
  publish_on: string;
  expression: string;
  meaning: string;
  pronunciation: string | null;
  stress: string | null;
  nuance: string | null;
  similar_expressions: string[] | null;
  examples: DailyLessonContent["examples"] | null;
  dialogue: DailyLessonContent["dialogue"] | null;
  quiz: DailyLessonContent["quiz"];
  clip_path: string | null;
  clip_caption: string | null;
  clip_source: string | null;
};

async function clipUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path;
  const { data } = await admin().storage.from("daily-clips").createSignedUrl(path, CLIP_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

async function toContent(row: LessonRow): Promise<DailyLessonContent> {
  const url = await clipUrl(row.clip_path);
  return {
    id: row.id,
    track: row.track,
    publishOn: row.publish_on,
    expression: row.expression,
    meaning: row.meaning,
    pronunciation: row.pronunciation,
    stress: row.stress,
    nuance: row.nuance,
    similar: row.similar_expressions ?? [],
    examples: row.examples ?? [],
    dialogue: row.dialogue ?? [],
    quiz: row.quiz,
    clip: url ? { url, caption: row.clip_caption, source: row.clip_source } : null,
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
    subscription: { customer_id: string; track: "business" | "tech"; recipient_name: string | null; status: string; delivery_time: string } | null;
  }).subscription;
  if (!sub) return null;

  const ids = data.kind === "review" ? (data.review_lesson_ids as string[]) : data.lesson_id ? [data.lesson_id as string] : [];
  let lessons: DailyLessonContent[] = [];
  if (ids.length > 0) {
    const { data: rows } = await db.from("daily_lessons").select(LESSON_COLUMNS).in("id", ids);
    lessons = (await Promise.all(((rows ?? []) as LessonRow[]).map(toContent))).sort((a, b) =>
      a.publishOn.localeCompare(b.publishOn),
    );
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
