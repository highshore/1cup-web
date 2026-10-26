// Daily is one business-English product in two levels. The code (and the database
// column) still calls the level a track.
export const DAILY_TRACKS = ["basic", "advanced"] as const;
export type DailyTrack = (typeof DAILY_TRACKS)[number];

export const DAILY_TRACK_LABEL: Record<DailyTrack, string> = { basic: "초중급", advanced: "고급" };

export function isDailyTrack(value: unknown): value is DailyTrack {
  return value === "basic" || value === "advanced";
}

// Which industry a lesson's expression comes from (daily_lessons.field).
export type DailyField = "consulting" | "finance" | "tech" | "consumer";
export const DAILY_FIELD_LABEL: Record<DailyField, string> = { consulting: "컨설팅", finance: "금융", tech: "테크", consumer: "소비재" };

// The 30-day subscription. Passes are one-time and priced per month above it on purpose:
// the subscription is the cheapest way to take Daily, and the page says so.
export const DAILY_MONTHLY_PRICE_KRW = 3700;

export const DAILY_PASSES = [
  { id: "pass_1m", label: "1개월 이용권", days: 30, priceKrw: 4500 },
  { id: "pass_3m", label: "3개월 이용권", days: 90, priceKrw: 13500 },
  { id: "pass_6m", label: "6개월 이용권", days: 180, priceKrw: 27000 },
] as const;

// Free-trial signup. When false, the landing page's trial buttons show "opening soon"
// instead of linking to the signup. The server has its own switch,
// daily_config.trial_open, which decides whether a trial can actually start.
export const DAILY_TRIAL_OPEN = true;
export const DAILY_TRIAL_PATH = "/daily/start";
export const DAILY_TERMS_PATH = "/daily/terms";
export const DAILY_GUIDE_PATH = "/daily/guide";
export const DAILY_ACCOUNT_PATH = "/daily/account";
export const DAILY_PRIVACY_PATH = "/daily/privacy";

// Bump when the Daily terms or the consent wording change; stored with each signup. The
// date is when the version took effect; a later revision the same day adds ".n".
export const DAILY_TERMS_VERSION = "2026-10-26.3";

export const formatKrw = (amount: number) => amount.toLocaleString("ko-KR");
