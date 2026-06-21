// Growth / marketing agent data model.
// A self-optimizing loop posts meetup ads across channels, measures the
// ground-truth signups attributed to each post, and adapts its strategy.

export type GrowthChannel =
  | "koreapas"
  | "linkedin"
  | "reddit"
  | "threads"
  | "instagram"
  | "x";

export type GrowthPostStatus =
  | "draft" // agent (or admin) created it; awaiting approval
  | "approved" // approved, queued to post
  | "posted" // live on the channel
  | "rejected" // admin rejected the draft
  | "failed"; // posting attempt failed

// The experiment "arms" the agent varies and learns over.
export interface GrowthVariant {
  hook?: string; // opening hook / headline strategy
  angle?: string; // content angle / theme
  tone?: string; // voice / tone
  cta?: string; // call to action
  postTime?: string; // intended time-of-day
  [key: string]: string | undefined;
}

export interface GrowthPostMetrics {
  impressions?: number;
  clicks: number; // tracked-link clicks (visits via /r/<code>)
  signups: number; // attributed signups — the ground-truth reward
  likes?: number;
  comments?: number;
}

export interface GrowthPost {
  id: string;
  channel: GrowthChannel | string;
  title?: string;
  content: string;
  imageUrl?: string;
  variant: GrowthVariant;
  trackingCode: string; // maps to /r/<code> and the referrals doc
  status: GrowthPostStatus;
  externalUrl?: string; // link to the live post once published
  iterationId?: string; // which agent run produced this post
  metrics: GrowthPostMetrics;
  scheduledFor?: string | null;
  postedAt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// One run of the agent loop: what it observed, decided, and changed.
export interface GrowthIteration {
  id: string;
  runAt: Date;
  channel: string;
  observation: string; // summary of the performance data it read
  decision: string; // rationale for the next move
  strategyChange?: string; // explicit change vs. the prior strategy
  variant?: GrowthVariant; // the variant it chose to try
  postId?: string; // resulting draft/post, if any
  model?: string;
  tokensUsed?: number;
}

// Global controls for the agent, stored at growth_config/settings.
export interface GrowthConfig {
  agentActive: boolean; // master on/off for the loop
  approveFirst: boolean; // require admin approval before posting
  updatedAt?: Date;
}

export const DEFAULT_GROWTH_CONFIG: GrowthConfig = {
  agentActive: false,
  approveFirst: true,
};

export const GROWTH_CHANNEL_LABELS: Record<string, string> = {
  koreapas: "코리아패스",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  threads: "Threads",
  instagram: "Instagram",
  x: "X",
};
