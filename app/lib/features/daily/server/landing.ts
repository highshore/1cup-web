// Server-only: the live numbers the landing page shows. Everything here is real data, read
// on the server and refreshed with the page (revalidate): the week of 초·중급 lessons and
// how many people learn with Daily. Nothing is invented or rounded up; a number too small
// to be worth showing is left out by the page (see DAILY_PROOF_MIN).
import { admin } from "../../../supabase/server";

export type WeekDayState = "past" | "today" | "upcoming";

export interface WeekDay {
  date: string;
  state: WeekDayState;
  /** Only for days already sent. Today's and later expressions stay unseen until sent. */
  expression: string | null;
}

export interface LandingWeek {
  /** The weekdays of this week, or of next week on a weekend. */
  days: WeekDay[];
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

export async function landingWeek(): Promise<LandingWeek> {
  const today = kstToday();
  const isoDow = ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Monday
  // On Saturday and Sunday the page looks ahead to the coming week.
  const monday = isoDow >= 6 ? addDays(today, 8 - isoDow) : addDays(today, 1 - isoDow);
  const dates = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const { data } = await admin()
    .from("daily_lessons")
    .select("publish_on, expression")
    .eq("track", "basic")
    .eq("status", "ready")
    .in("publish_on", dates);
  const byDate = new Map((data ?? []).map((row) => [row.publish_on as string, row.expression as string]));
  return {
    days: dates.map((date) => {
      const state: WeekDayState = date < today ? "past" : date === today ? "today" : "upcoming";
      return { date, state, expression: state === "past" ? (byDate.get(date) ?? null) : null };
    }),
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
