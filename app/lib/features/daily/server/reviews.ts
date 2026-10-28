// Server-only: Daily reviews, written on /daily/review by customers who received at least
// one lesson, shown publicly only after the founder approves them. Writing one needs 소속
// and 직종 (saved to the customer) and consent to promotional use, and earns 15 days once
// (daily_grant_review_reward; terms 제9조의3). It is signed with 소속, 직종 and the family-name
// initial (reviewerLabel), and carries the 1cup feedback questions, which are never shown.
import { admin } from "../../../supabase/server";
import { DAILY_JOB_CATEGORIES, type DailyTrack } from "../constants";
import { reviewerLabel } from "../review_label";
import type { DailySessionCustomer } from "./session";

export interface DailyReviewInput {
  rating: number;
  body: string;
  workplace: string;
  jobCategory: string;
  promoConsent: boolean;
  survey: DailyReviewSurvey;
}

/** The 1cup feedback questions: three 1–5 ratings (required) and two optional answers. */
export interface DailyReviewSurvey {
  continue: number;
  recommend: number;
  miss: number;
  hardest: string;
  suggestion: string;
}

/** What submitting did with the 15-day reward. */
export type DailyReviewReward = "applied" | "pending" | "already";

export interface PublicDailyReview {
  id: string;
  track: DailyTrack;
  rating: number;
  body: string;
  displayName: string | null;
  lessonsReceived: number;
  approvedAt: string;
  // Written for the 15-day reward; shown on the card (추천·보증 심사지침).
  rewarded: boolean;
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
  const db = admin();
  const [{ count }, { data: existing }, { data: me }] = await Promise.all([
    deliveredLessons(customer.id),
    db.from("daily_reviews").select("rating, body, status, reward_earned_at, reward_applied_at, q_continue, q_recommend, q_miss, q_hardest, q_suggestion").eq("customer_id", customer.id).maybeSingle(),
    db.from("daily_customers").select("workplace, job_category").eq("id", customer.id).maybeSingle(),
  ]);
  // A message-link session may be someone the link was forwarded to: no 소속·직종 for it.
  return {
    eligible: count > 0,
    verified: customer.verified,
    workplace: customer.verified ? ((me?.workplace as string | null) ?? "") : "",
    jobCategory: customer.verified ? ((me?.job_category as string | null) ?? "") : "",
    // Only the first letter, for the page's preview of how the review is signed.
    nameInitial: customer.verified ? (Array.from((customer.name ?? "").trim())[0] ?? "") : "",
    existing: existing
      ? {
          rating: existing.rating,
          body: existing.body,
          survey: {
            continue: existing.q_continue ?? 0,
            recommend: existing.q_recommend ?? 0,
            miss: existing.q_miss ?? 0,
            hardest: existing.q_hardest ?? "",
            suggestion: existing.q_suggestion ?? "",
          },
          status: existing.status,
          reward: existing.reward_applied_at ? "applied" : existing.reward_earned_at ? "pending" : null,
        }
      : null,
  };
}

export async function submitReview(customer: DailySessionCustomer, input: DailyReviewInput) {
  const rating = Math.round(Number(input.rating));
  const body = String(input.body ?? "").trim();
  if (!(rating >= 1 && rating <= 5)) throw new ReviewError("별점을 골라 주세요.");
  if (body.length < 10 || body.length > 300) throw new ReviewError("후기는 10자 이상 300자 이하로 써 주세요.");
  const workplace = String(input.workplace ?? "").trim().slice(0, 60);
  const jobCategory = String(input.jobCategory ?? "").trim();
  if (!workplace) throw new ReviewError("소속을 적어 주세요.");
  if (!(DAILY_JOB_CATEGORIES as readonly string[]).includes(jobCategory)) throw new ReviewError("직종을 골라 주세요.");
  const scale = (v: unknown) => {
    const n = Math.round(Number(v));
    return n >= 1 && n <= 5 ? n : 0;
  };
  const survey = {
    q_continue: scale(input.survey?.continue),
    q_recommend: scale(input.survey?.recommend),
    q_miss: scale(input.survey?.miss),
    q_hardest: String(input.survey?.hardest ?? "").trim().slice(0, 300) || null,
    q_suggestion: String(input.survey?.suggestion ?? "").trim().slice(0, 300) || null,
  };
  if (!survey.q_continue || !survey.q_recommend || !survey.q_miss) throw new ReviewError("설문의 별점 세 개를 모두 골라 주세요.");
  if (input.promoConsent !== true) throw new ReviewError("홍보 활용에 동의해야 후기를 보낼 수 있어요.");

  const { count, track } = await deliveredLessons(customer.id);
  if (count === 0 || !track) throw new ReviewError("레슨을 받은 뒤에 후기를 남길 수 있어요.", 403);

  const db = admin();
  const { data: existing } = await db.from("daily_reviews").select("status, reward_earned_at").eq("customer_id", customer.id).maybeSingle();
  if (existing?.status === "approved") throw new ReviewError("이미 소개 페이지에 올라간 후기예요.", 409);

  const { error: profileError } = await db.from("daily_customers").update({ workplace, job_category: jobCategory }).eq("id", customer.id);
  if (profileError) throw new ReviewError("소속과 직종을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);

  const { error } = await db.from("daily_reviews").upsert(
    {
      customer_id: customer.id,
      track,
      rating,
      body,
      display_name: reviewerLabel(workplace, jobCategory, customer.name),
      ...survey,
      lessons_received: count,
      status: "pending",
      promo_consent_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );
  if (error) throw new ReviewError("후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);

  // Once per customer: a rewritten review keeps the reward it already earned.
  if (existing?.reward_earned_at) return "already" as DailyReviewReward;
  const { data: reward, error: rewardError } = await db.rpc("daily_grant_review_reward", { p_customer_id: customer.id });
  if (rewardError) {
    console.error("daily review reward:", rewardError.message);
    throw new ReviewError("후기는 저장했지만 혜택을 넣지 못했어요. 확인한 뒤 넣어 드릴게요.", 500);
  }
  return (reward === "applied" ? "applied" : "pending") as DailyReviewReward;
}

/** Approved reviews for the landing page, newest first. */
export async function approvedReviews(limit = 9): Promise<PublicDailyReview[]> {
  const { data } = await admin()
    .from("daily_reviews")
    .select("id, track, rating, body, display_name, lessons_received, approved_at, reward_earned_at")
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
    rewarded: Boolean(row.reward_earned_at),
  }));
}
