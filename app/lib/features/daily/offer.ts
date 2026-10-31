// Today's price (terms 제5조): every product costs half its regular price until the
// customer's offer deadline. The server decides the deadline and the charge
// (daily_price_offer, supabase/functions/daily/payments.ts); this only describes it.

/**
 * What the server says about a customer's today's price. expiresAt is null while their
 * first free trial is still running: the deadline is then midnight KST of the day the
 * trial ends, which is not known yet.
 */
export interface DailyPriceOffer {
  active: boolean;
  expiresAt: string | null;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Days since the epoch, counted in KST.
const kstDay = (ms: number) => Math.floor((ms + KST_OFFSET_MS) / DAY_MS);

/** "오늘 밤 12시", "내일 오후 3:20", "11월 3일 오전 9:00": when the today's price ends. */
export function offerDeadlineLabel(iso: string, now = Date.now()): string {
  const at = new Date(iso).getTime();
  const today = kstDay(now);
  const kst = new Date(at + KST_OFFSET_MS);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  // Midnight belongs to the day it ends.
  if (h === 0 && m === 0) {
    const day = kstDay(at - 1);
    if (day === today) return "오늘 밤 12시";
    if (day === today + 1) return "내일 밤 12시";
  }
  const time = `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
  const day = kstDay(at);
  if (day === today) return `오늘 ${time}`;
  if (day === today + 1) return `내일 ${time}`;
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 ${time}`;
}

/** "07:42:09": hours, minutes and seconds left, never below zero. */
export function formatTimeLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
