// Server-only: picks each daily post's time.
//
// Every channel has four candidate slots (SOCIAL_SLOTS). A slot's score is the median
// of its posts' views 24 hours after posting (growth_posts.metrics_24h, filled by the
// insights refresh), so a post published at 08:00 and one at 21:30 are compared over the
// same window. Until every slot has MIN_SAMPLES scored posts the optimizer explores,
// rotating through the least-tried slots. After that it posts at the best slot, but on
// one day in five tries the runner-up so a shift in the audience still gets noticed.
import { admin } from "../../../supabase/server";
import { SOCIAL_SLOTS, type SlotReason, type SlotStat, type SocialChannel, type VariantStat } from "../types";

const MIN_SAMPLES = 4;
const TRY_EVERY_DAYS = 5;
const LOOKBACK_DAYS = 90;

const dayNumber = (postDate: string) => Math.floor(new Date(`${postDate}T00:00:00Z`).getTime() / 86_400_000);

export const slotToIso = (postDate: string, slot: string) => new Date(`${postDate}T${slot}:00+09:00`).toISOString();

export const kstSlotOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );

export const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** A published daily post with its views 24 hours after posting. */
export interface ScoredPost {
  slot: string;
  threadMedia: string;
  threadStructure: string;
  hookStyle: string;
  /** First line of a Threads post, or the first card's title. */
  opener: string;
  views: number;
}

const openerOf = (content: Record<string, unknown>) => {
  if (typeof content.text === "string") return content.text.split("\n")[0].trim();
  const slides = Array.isArray(content.slides) ? (content.slides as Array<Record<string, unknown>>) : [];
  return String(slides[0]?.title ?? "").trim();
};

export async function scoredPosts(channel: SocialChannel): Promise<ScoredPost[]> {
  const db = admin();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data: posts } = await db
    .from("social_daily_posts")
    .select("slot, thread_media, thread_structure, content, growth_post_id")
    .eq("channel", channel)
    .eq("status", "published")
    .not("growth_post_id", "is", null)
    .gte("published_at", since);
  const ids = (posts ?? []).map((post) => String(post.growth_post_id));
  const views = new Map<string, number>();
  if (ids.length) {
    const { data: growth } = await db.from("growth_posts").select("id, metrics_24h").in("id", ids);
    for (const row of growth ?? []) {
      const metrics = (row.metrics_24h ?? null) as Record<string, unknown> | null;
      if (metrics && typeof metrics.impressions === "number") views.set(String(row.id), metrics.impressions);
    }
  }
  return (posts ?? [])
    .filter((post) => views.has(String(post.growth_post_id)))
    .map((post) => {
      const content = (post.content ?? {}) as Record<string, unknown>;
      return {
        slot: String(post.slot ?? ""),
        threadMedia: String(post.thread_media ?? ""),
        threadStructure: String(post.thread_structure ?? ""),
        hookStyle: typeof content.hookStyle === "string" ? content.hookStyle : "",
        opener: openerOf(content),
        views: views.get(String(post.growth_post_id)) as number,
      };
    });
}

export const statsBy = (posts: ScoredPost[], keys: readonly string[], pick: (post: ScoredPost) => string): VariantStat[] =>
  keys.map((key) => {
    const samples = posts.filter((post) => pick(post) === key).map((post) => post.views);
    return { key, samples: samples.length, medianViews24h: median(samples) };
  });

export const slotStats = (channel: SocialChannel, posts: ScoredPost[]): SlotStat[] =>
  statsBy(posts, SOCIAL_SLOTS[channel], (post) => post.slot).map(({ key, ...rest }) => ({ slot: key, ...rest }));

// A draft made after the day's last slot gets the earliest time that still leaves room
// to review it: 30 minutes out, rounded up to 5 minutes. It is not one of the scored
// slots, so it never skews the slot statistics.
const asapTime = (notBefore: number) => {
  const at = new Date(Math.ceil((notBefore + 15 * 60_000) / 300_000) * 300_000);
  return { slot: kstSlotOf(at.toISOString()), reason: "asap" as const, scheduledFor: at.toISOString() };
};

export function chooseSlot(
  channel: SocialChannel,
  postDate: string,
  stats: SlotStat[],
  notBefore = Date.now() + 15 * 60_000,
): { slot: string; reason: SlotReason; scheduledFor: string } {
  // A draft made for today can only use slots that are still ahead.
  const ahead = stats.filter((stat) => new Date(slotToIso(postDate, stat.slot)).getTime() >= notBefore);
  if (ahead.length === 0) return asapTime(notBefore);
  const pool = ahead;
  const day = dayNumber(postDate);
  const at = (slot: string) => slotToIso(postDate, slot);

  const fewest = Math.min(...pool.map((stat) => stat.samples));
  if (fewest < MIN_SAMPLES) {
    const least = pool.filter((stat) => stat.samples === fewest);
    const slot = least[day % least.length].slot;
    return { slot, reason: "explore", scheduledFor: at(slot) };
  }
  const ranked = [...pool].sort((a, b) => (b.medianViews24h ?? 0) - (a.medianViews24h ?? 0));
  if (ranked.length > 1 && day % TRY_EVERY_DAYS === 0) return { slot: ranked[1].slot, reason: "try", scheduledFor: at(ranked[1].slot) };
  const best = ranked[0]?.slot ?? SOCIAL_SLOTS[channel][0];
  return { slot: best, reason: "best", scheduledFor: at(best) };
}
