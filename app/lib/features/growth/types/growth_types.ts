export type GrowthPostStatus =
  | "prepared"
  | "posting"
  | "posted"
  | "failed"
  | "draft"
  | "approved"
  | "rejected";

export interface GrowthPostMetrics {
  impressions: number;
  clicks: number;
  signups: number;
  likes: number;
  comments: number;
}

export interface MarketingCronSchedule {
  minute: number;
  hour: number;
  daysOfWeek: number[];
}

export type MarketingChannel = "koreapas" | "threads" | "instagram";
export type SocialMarketingChannel = Exclude<MarketingChannel, "koreapas">;

// Fixed display/posting order; Gopas first because its publisher is the slowest.
export const MARKETING_CHANNELS: MarketingChannel[] = ["koreapas", "threads", "instagram"];
export const SOCIAL_MARKETING_CHANNELS: SocialMarketingChannel[] = ["threads", "instagram"];

// Threads allows 500 characters; the run appends a ~46 character tracking link.
export const THREADS_TEXT_LIMIT = 450;
export const INSTAGRAM_CAPTION_LIMIT = 2200;

export interface MarketingChannelConnection {
  channel: SocialMarketingChannel;
  connected: boolean;
  username: string;
  accountId: string;
  tokenExpiresAt: Date | null;
  connectedAt: Date | null;
  lastError: string;
}

export interface MarketingTemplatePhoto {
  url: string;
  alt: string;
}

export interface MarketingTemplate {
  id: string;
  name: string;
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: MarketingTemplatePhoto[];
  channels: MarketingChannel[];
  threadsText: string;
  instagramCaption: string;
  scheduleEnabled: boolean;
  schedule: MarketingCronSchedule;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MarketingCronSettings {
  enabled: boolean;
  nextRunAt: Date | null;
  schedule: MarketingCronSchedule;
  templateId: string;
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: MarketingTemplatePhoto[];
  timeZone: string;
  lastRunAt: Date | null;
  updatedAt: Date | null;
}

export type MarketingRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "skipped"
  | "awaitingPublisher"
  | "failed";

export interface MarketingPerformanceSnapshot extends GrowthPostMetrics {
  trackedPosts: number;
}

export interface MarketingCronRun {
  id: string;
  templateId: string;
  channel: MarketingChannel;
  trigger: "schedule" | "manual" | "daily";
  status: MarketingRunStatus;
  scheduledFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  postId: string;
  postTitle: string;
  postCopy: string;
  trackingCode: string;
  trackingUrl: string;
  hiddenPostId: string;
  externalPostUrl: string;
  photos: MarketingTemplatePhoto[];
  performance: MarketingPerformanceSnapshot;
  performanceCheckedAt: Date | null;
  error: string;
}

export const DEFAULT_MARKETING_CRON_SETTINGS: MarketingCronSettings = {
  enabled: false,
  nextRunAt: null,
  schedule: {
    minute: 0,
    hour: 19,
    daysOfWeek: [1, 2, 3, 4, 5],
  },
  templateId: "",
  destinationUrl: "https://1cupenglish.com/payment",
  title: "",
  copy: "",
  callToAction: "",
  photos: [],
  timeZone: "Asia/Seoul",
  lastRunAt: null,
  updatedAt: null,
};
