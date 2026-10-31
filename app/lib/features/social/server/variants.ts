// Server-only: picks each daily post's format variants the way slots.ts picks its time.
//
// Three experiments run on top of the posting time: on Threads, the media style (text
// only, text + cards, text + a narrated video) and the structure (one self-contained
// post, or a first post with replies); on both channels, the opening style of the post
// (HOOK_STYLES). Each is scored by the median of views 24 hours after posting. Until
// every option has MIN_SAMPLES scored posts the least-tried options are used; after that
// the best one, with one day in TRY_EVERY_DAYS given to the runner-up.
//
// Choices hash the post date with the experiment's name instead of rotating by day
// number, so the experiments do not move in lockstep (with a plain rotation the
// structure would always follow the slot's parity, and the two could not be told apart).
import { createHash } from "node:crypto";

import { HOOK_STYLES, THREAD_MEDIA, THREAD_STRUCTURES, type SocialChannel, type VariantStat } from "../types";
import { type ScoredPost, statsBy } from "./slots";

const MIN_SAMPLES = 4;
const TRY_EVERY_DAYS = 5;

const roll = (postDate: string, experiment: string) =>
  createHash("sha256").update(`${postDate}:${experiment}`).digest().readUInt32BE(0);

export type VariantReason = "explore" | "best" | "try" | "manual";

export function chooseVariant<K extends string>(
  stats: VariantStat[],
  postDate: string,
  experiment: string,
): { key: K; reason: VariantReason } {
  const dice = roll(postDate, experiment);
  const fewest = Math.min(...stats.map((stat) => stat.samples));
  if (fewest < MIN_SAMPLES) {
    const least = stats.filter((stat) => stat.samples === fewest);
    return { key: least[dice % least.length].key as K, reason: "explore" };
  }
  const ranked = [...stats].sort((a, b) => (b.medianViews24h ?? 0) - (a.medianViews24h ?? 0));
  if (ranked.length > 1 && dice % TRY_EVERY_DAYS === 0) return { key: ranked[1].key as K, reason: "try" };
  return { key: ranked[0].key as K, reason: "best" };
}

export const variantStats = (channel: SocialChannel, posts: ScoredPost[]) => ({
  media: channel === "threads" ? statsBy(posts, THREAD_MEDIA, (post) => post.threadMedia) : [],
  structure: channel === "threads" ? statsBy(posts, THREAD_STRUCTURES, (post) => post.threadStructure) : [],
  hook: statsBy(posts, HOOK_STYLES, (post) => post.hookStyle),
});

// The openers our own audience reacted to most and least, for the draft prompt: the
// model learns the pattern from real results instead of only from generic examples.
// Needs a handful of scored posts before it says anything.
export function openerLessons(posts: ScoredPost[]): { strong: string[]; weak: string[] } {
  const withOpener = posts.filter((post) => post.opener);
  if (withOpener.length < 6) return { strong: [], weak: [] };
  const ranked = [...withOpener].sort((a, b) => b.views - a.views);
  const line = (post: ScoredPost) => `${post.opener} (${post.views.toLocaleString("en-US")} views)`;
  return { strong: ranked.slice(0, 3).map(line), weak: ranked.slice(-2).map(line) };
}
