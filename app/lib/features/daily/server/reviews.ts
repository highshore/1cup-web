// Server-only: Daily reviews. Written by verified customers (Daily phone sign-in plus at
// least one delivered lesson), shown publicly only after the founder approves them.
import { admin } from "../../../supabase/server";
import type { DailyTrack } from "../constants";
import type { DailySessionCustomer } from "./session";

export interface DailyReviewInput {
  rating: number;
  body: string;
  displayName: string;
}

export interface PublicDailyReview {
  id: string;
  track: DailyTrack;
  rating: number;
  body: string;
  displayName: string | null;
  lessonsReceived: number;
  approvedAt: string;
}

export class ReviewError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function deliveredLessons(customerId: string) {
  const db = admin();
  const { data: subs } = await db
    .from("daily_subscriptions")
    .select("id, track, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  const ids = (subs ?? []).map((s) => s.id);
  if (ids.length === 0) return { count: 0, track: null as DailyTrack | null };
  const { count } = await db
    .from("daily_deliveries")
    .select("id", { count: "exact", head: true })
    .in("subscription_id", ids)
    .eq("kind", "lesson")
    .eq("status", "sent");
  return { count: count ?? 0, track: (subs?.[0]?.track ?? null) as DailyTrack | null };
}

export async function reviewStatus(customer: DailySessionCustomer) {
  const [{ count }, { data: existing }] = await Promise.all([
    deliveredLessons(customer.id),
    admin().from("daily_reviews").select("rating, body, display_name, status").eq("customer_id", customer.id).maybeSingle(),
  ]);
  return {
    eligible: count > 0,
    existing: existing
      ? { rating: existing.rating, body: existing.body, displayName: existing.display_name, status: existing.status }
      : null,
  };
}

export async function submitReview(customer: DailySessionCustomer, input: DailyReviewInput) {
  const rating = Math.round(Number(input.rating));
  const body = String(input.body ?? "").trim();
  const displayName = String(input.displayName ?? "").trim().slice(0, 12);
  if (!(rating >= 1 && rating <= 5)) throw new ReviewError("별점을 골라 주세요.");
  if (body.length < 10 || body.length > 300) throw new ReviewError("후기는 10자 이상 300자 이하로 써 주세요.");

  const { count, track } = await deliveredLessons(customer.id);
  if (count === 0 || !track) throw new ReviewError("레슨을 받은 뒤에 후기를 남길 수 있어요.", 403);

  const db = admin();
  const { data: existing } = await db.from("daily_reviews").select("status").eq("customer_id", customer.id).maybeSingle();
  if (existing?.status === "approved") throw new ReviewError("이미 소개 페이지에 올라간 후기예요.", 409);

  const { error } = await db.from("daily_reviews").upsert(
    {
      customer_id: customer.id,
      track,
      rating,
      body,
      display_name: displayName || null,
      lessons_received: count,
      status: "pending",
    },
    { onConflict: "customer_id" },
  );
  if (error) throw new ReviewError("후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
}

/** Approved reviews for the landing page, newest first. */
export async function approvedReviews(limit = 9): Promise<PublicDailyReview[]> {
  const { data } = await admin()
    .from("daily_reviews")
    .select("id, track, rating, body, display_name, lessons_received, approved_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    track: row.track,
    rating: row.rating,
    body: row.body,
    displayName: row.display_name,
    lessonsReceived: row.lessons_received,
    approvedAt: row.approved_at,
  }));
}
