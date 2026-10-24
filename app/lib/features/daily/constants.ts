export const DAILY_TRACKS = ["business", "tech"] as const;
export type DailyTrack = (typeof DAILY_TRACKS)[number];

export const DAILY_MONTHLY_PRICE_KRW = 3700;

// Free-trial signup is not built yet. Trial buttons stay in their "opening soon" state
// until this flips, and DAILY_TRIAL_PATH must exist before it does.
export const DAILY_TRIAL_OPEN = false;
export const DAILY_TRIAL_PATH = "/daily/start";

export const formatKrw = (amount: number) => amount.toLocaleString("ko-KR");
