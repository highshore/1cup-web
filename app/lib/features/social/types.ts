// Daily Threads / Instagram posts (table `social_daily_posts`). Shared by the admin
// UI, the admin API route and the server-side generator.

export type SocialChannel = "threads" | "instagram";
export type SocialPostFormat = "thread" | "carousel" | "reel";
export type SocialPostStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "publishing"
  | "published"
  | "failed"
  | "expired";
export type SlotReason = "explore" | "best" | "try" | "manual" | "asap";

// Post themes, all promoting One Cup Daily. The weekday picks one (server/content.ts);
// an admin can override it. Older posts may carry retired themes (debate, vocabulary,
// summary, invite), which the admin still labels.
export const SOCIAL_PILLARS = ["insight", "expression", "compare", "scene", "quiz", "news", "weekly"] as const;
export type SocialPillar = (typeof SOCIAL_PILLARS)[number];

export interface ThreadContent {
  /** First post of the thread (≤ 400 characters). */
  text: string;
  /** Replies posted under it in order (each ≤ 450 characters). The tracking link is
   *  appended to the last one when the thread is published. */
  replies: string[];
}

export interface CardSlide {
  /** Small label above the title, e.g. "오늘의 표현". */
  eyebrow: string;
  title: string;
  body: string;
  /** Optional English sentence shown in an accent box. */
  highlight: string;
}

export interface CarouselContent {
  caption: string;
  slides: CardSlide[];
}

/** A reel is a carousel read aloud: one spoken line per slide, also shown as subtitles. */
export interface ReelContent extends CarouselContent {
  narration: string[];
}

export interface SocialMedia {
  url: string;
  kind: "image" | "video";
}

export interface SocialDailyPost {
  id: string;
  channel: SocialChannel;
  format: SocialPostFormat;
  postDate: string; // YYYY-MM-DD (KST)
  pillar: string;
  status: SocialPostStatus;
  scheduledFor: string | null; // ISO
  slot: string;
  slotReason: SlotReason | "";
  content: ThreadContent | CarouselContent | ReelContent;
  media: SocialMedia[];
  source: Record<string, unknown>;
  runId: string | null;
  externalUrl: string;
  error: string;
  approvedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface SlotStat {
  slot: string;
  samples: number;
  medianViews24h: number | null;
}

export interface SocialChannelOverview {
  posts: SocialDailyPost[];
  slots: SlotStat[];
}

// Posting-time candidates (KST). The optimizer tries each until it has enough 24-hour
// view counts, then mostly posts at the best one.
export const SOCIAL_SLOTS: Record<SocialChannel, string[]> = {
  instagram: ["08:00", "12:30", "19:00", "21:30"],
  threads: ["08:30", "12:00", "18:30", "22:30"],
};

export const THREAD_TEXT_LIMIT = 400;
export const THREAD_REPLY_LIMIT = 450;
export const THREAD_MAX_REPLIES = 4;
export const CAROUSEL_CAPTION_LIMIT = 2000;
export const CAROUSEL_MIN_SLIDES = 3;
export const CAROUSEL_MAX_SLIDES = 8;
export const REEL_MAX_SLIDES = 7;
export const NARRATION_LINE_LIMIT = 120;
export const INSTAGRAM_FORMATS = ["carousel", "reel"] as const;

export const isThreadContent = (content: unknown): content is ThreadContent =>
  !!content && typeof content === "object" && typeof (content as ThreadContent).text === "string";

export const isCarouselContent = (content: unknown): content is CarouselContent =>
  !!content && typeof content === "object" && Array.isArray((content as CarouselContent).slides);

export const isReelContent = (content: unknown): content is ReelContent =>
  isCarouselContent(content) && Array.isArray((content as ReelContent).narration);
