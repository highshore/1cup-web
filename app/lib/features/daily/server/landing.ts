// Server-only: the live numbers the landing page shows. Everything here is real data, read
// on the server and refreshed with the page (revalidate): the first lessons a new member gets
// and how many people learn with Daily. Nothing is invented or rounded up; a number too small
// to be worth showing is left out by the page (see DAILY_PROOF_MIN).
import { admin } from "../../../supabase/server";

/** How many expressions the landing page counts up to: a 28-day plan's worth of weekdays. */
export const DAILY_START_GOAL = 20;

export interface StartDay {
  /** 1 for Expression 1. */
  n: number;
  /** When it arrives for someone who signs up today (KST, YYYY-MM-DD). */
  date: string;
  /** Only Expression 1, the one a new member gets the moment they sign up. */
  expression: string | null;
}

export interface LandingStart {
  /** Expressions 1 to 5 for someone signing up today. */
  days: StartDay[];
  /** When Expression DAILY_START_GOAL arrives for someone signing up today. */
  goalOn: string;
  /** The same, for someone who waits a week. */
  goalOnNextWeek: string;
}

export interface LandingProof {
  learners: number;
  sentences: number;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstToday() {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday. */
function isoDow(date: string) {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/**
 * Every member starts from Expression 1 (see nextLessonFor in the daily function): the first
 * comes the moment they sign up, then one each weekday. So signing up today puts Expression n
 * on a fixed date, and waiting moves every one of them.
 */
export async function landingStart(): Promise<LandingStart> {
  const today = kstToday();
  const arrivals = [today];
  for (let date = today; arrivals.length < DAILY_START_GOAL; ) {
    date = addDays(date, 1);
    if (isoDow(date) <= 5) arrivals.push(date);
  }
  const { data } = await admin()
    .from("daily_lessons")
    .select("expression")
    .eq("track", "basic")
    .eq("status", "ready")
    .lte("publish_on", today)
    .order("publish_on", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  const first = (data?.[0]?.expression as string | undefined) ?? null;
  const goalOn = arrivals[DAILY_START_GOAL - 1];
  return {
    days: arrivals.slice(0, 5).map((date, i) => ({ n: i + 1, date, expression: i === 0 ? first : null })),
    goalOn,
    // The schedule repeats weekly, so a week's wait moves the goal by exactly a week.
    goalOnNextWeek: addDays(goalOn, 7),
  };
}

export async function landingProof(): Promise<LandingProof> {
  const db = admin();
  const [learners, sentences] = await Promise.all([
    db.from("daily_customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    db.from("daily_sentences").select("id", { count: "exact", head: true }).is("hidden_at", null),
  ]);
  return { learners: learners.count ?? 0, sentences: sentences.count ?? 0 };
}
