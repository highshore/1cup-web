export const DAILY_TRACKS = ["business", "tech"] as const;
export type DailyTrack = (typeof DAILY_TRACKS)[number];

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
export const DAILY_PRIVACY_PATH = "/daily/privacy";

// Bump when the Daily terms or the consent wording change; stored with each signup.
export const DAILY_TERMS_VERSION = "2026-10-25";

export const formatKrw = (amount: number) => amount.toLocaleString("ko-KR");
