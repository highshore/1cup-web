// Daily is one business-English product in two levels. The code (and the database
// column) still calls the level a track.
export const DAILY_TRACKS = ["basic", "advanced"] as const;
export type DailyTrack = (typeof DAILY_TRACKS)[number];

export const DAILY_TRACK_LABEL: Record<DailyTrack, string> = { basic: "초·중급", advanced: "고급" };

export function isDailyTrack(value: unknown): value is DailyTrack {
  return value === "basic" || value === "advanced";
}

// Which industry a lesson's expression comes from (daily_lessons.field).
export type DailyField = "consulting" | "finance" | "tech" | "consumer";
export const DAILY_FIELD_LABEL: Record<DailyField, string> = { consulting: "컨설팅", finance: "금융", tech: "테크", consumer: "소비재" };

// The 28-day subscription. Passes are one-time and priced per month above it on purpose:
// the subscription is the cheapest way to take Daily, and the page says so.
export const DAILY_MONTHLY_PRICE_KRW = 3700;

export const DAILY_PASSES = [
  { id: "pass_1m", label: "1개월 이용권", days: 28, priceKrw: 4500 },
  { id: "pass_3m", label: "3개월 이용권", days: 84, priceKrw: 12300 },
  { id: "pass_6m", label: "6개월 이용권", days: 168, priceKrw: 23400 },
] as const;

// A pass's price per 28 days (one period), and the 1개월 이용권 price it is compared with (struck through
// under the longer passes).
export const DAILY_PASS_MONTHLY_BASE_KRW = DAILY_PASSES[0].priceKrw;
export const dailyPassPerMonth = (priceKrw: number, days: number) => Math.round((priceKrw * 28) / days);

// Free-trial signup. When false, the landing page's trial buttons show "opening soon"
// instead of linking to the signup. The server has its own switch,
// daily_config.trial_open, which decides whether a trial can actually start.
export const DAILY_TRIAL_OPEN = true;
export const DAILY_TRIAL_PATH = "/daily/start";
export const DAILY_TERMS_PATH = "/daily/terms";
export const DAILY_GUIDE_PATH = "/daily/guide";
export const DAILY_ACCOUNT_PATH = "/daily/account";
export const DAILY_PRIVACY_PATH = "/daily/privacy";
export const DAILY_REVIEW_PATH = "/daily/review";

// Days of service each reward adds (terms 제5조의2 친구 초대, 제9조의3 후기). The SQL in
// daily_apply_invite / daily_grant_review_reward uses the same numbers.
export const DAILY_INVITE_REWARD_DAYS = 15;
export const DAILY_REVIEW_REWARD_DAYS = 15;

// 직종 on 내 정보 and the review page (daily_customers.job_category).
export const DAILY_JOB_CATEGORIES = [
  "경영·기획·전략",
  "마케팅·광고·홍보",
  "영업·사업개발",
  "개발·IT·데이터",
  "디자인",
  "연구·R&D",
  "재무·회계",
  "인사·HR",
  "법무",
  "생산·제조·품질",
  "무역·물류·구매",
  "금융·투자",
  "컨설팅",
  "의료·제약·바이오",
  "교육",
  "공공·공기업",
  "미디어·콘텐츠",
  "학생",
  "기타",
] as const;

// Bump when the Daily terms or the consent wording change; stored with each signup. The
// date is when the version took effect; a later revision the same day adds ".n".
export const DAILY_TERMS_VERSION = "2026-10-28.2";

export const formatKrw = (amount: number) => amount.toLocaleString("ko-KR");
