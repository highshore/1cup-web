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

// Threads experiments. Each Threads post gets one media style and one structure; the
// optimizer (server/variants.ts) compares them by views 24 hours after posting.
export const THREAD_MEDIA = ["text", "image", "video"] as const;
export type ThreadMedia = (typeof THREAD_MEDIA)[number];
export const THREAD_STRUCTURES = ["single", "chain"] as const;
export type ThreadStructure = (typeof THREAD_STRUCTURES)[number];

// How a post opens (its first line, or the first card / first scene). Every draft comes
// with one opening per style; the day's assigned style is used and the others can be
// swapped in from the admin. Styles are scored by 24-hour views like the slots.
export const HOOK_STYLES = ["callout", "mistake", "contrast", "quiz", "curiosity", "confession"] as const;
export type HookStyle = (typeof HOOK_STYLES)[number];

export interface HookOption {
  style: HookStyle;
  text: string;
}

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
  /** Cards attached to the first post (media "image"), or the scenes of its video
   *  (media "video", with one narration line per scene). */
  slides?: CardSlide[];
  narration?: string[];
  hooks?: HookOption[];
  hookStyle?: HookStyle | "";
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
  hooks?: HookOption[];
  hookStyle?: HookStyle | "";
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
  /** Threads only; "" on Instagram posts. */
  threadMedia: ThreadMedia | "";
  threadStructure: ThreadStructure | "";
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

/** Views 24 hours after posting for one variant (a media style, structure or hook style). */
export interface VariantStat {
  key: string;
  samples: number;
  medianViews24h: number | null;
}

export interface SocialChannelOverview {
  /** Posts that still need attention; published ones are in the channel's post history. */
  posts: SocialDailyPost[];
  /** Today and/or tomorrow (KST) when a post already exists for that day, in any status. */
  takenDates: string[];
  slots: SlotStat[];
  /** media and structure are empty on Instagram. */
  variants: { media: VariantStat[]; structure: VariantStat[]; hook: VariantStat[] };
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
export const THREAD_MAX_CARDS = 4;
export const THREAD_VIDEO_MAX_SCENES = 5;
export const HOOK_LIMIT = 80;
export const NARRATION_LINE_LIMIT = 120;
export const INSTAGRAM_FORMATS = ["carousel", "reel"] as const;

export const isThreadContent = (content: unknown): content is ThreadContent =>
  !!content && typeof content === "object" && typeof (content as ThreadContent).text === "string";

// True for Instagram carousels and reels, and for Threads posts with cards or a video
// (anything that has slides to render).
export const hasSlides = (content: unknown): content is { slides: CardSlide[]; narration?: string[] } =>
  !!content && typeof content === "object" && Array.isArray((content as CarouselContent).slides);

export const isCarouselContent = (content: unknown): content is CarouselContent =>
  hasSlides(content) && !isThreadContent(content);

export const isReelContent = (content: unknown): content is ReelContent =>
  isCarouselContent(content) && Array.isArray((content as ReelContent).narration);
