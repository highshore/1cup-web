// Marketing cron settings, templates and run history — Supabase port of the Firestore
// version. Reads go straight to Postgres. Cron-sensitive writes go through the
// `marketing` edge function; simple template-content edits use the table's admin-only RLS.
import { supabase, invokeFunction } from "../../../supabase/client";
import {
  DEFAULT_MARKETING_CRON_SETTINGS,
  MARKETING_CHANNELS,
  MarketingChannel,
  MarketingChannelConnection,
  MarketingCronRun,
  MarketingCronSchedule,
  MarketingCronSettings,
  MarketingPerformanceSnapshot,
  MarketingRunStatus,
  MarketingTemplate,
  MarketingTemplatePhoto,
  SocialMarketingChannel,
} from "../types/growth_types";

const CONFIG = "growth_config";
const CONFIG_ROW = "settings";
const RUNS = "marketing_cron_runs";
const TEMPLATES = "marketing_templates";

export const MARKETING_RUN_PAGE_SIZE = 10;
const MARKETING_PERFORMANCE_POINT_LIMIT = 180;
const TEMPLATE_LIMIT = 100;

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toPhotos = (value: unknown): MarketingTemplatePhoto[] =>
  Array.isArray(value)
    ? value
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p) => ({
          url: typeof p.url === "string" ? p.url : "",
          alt: typeof p.alt === "string" ? p.alt : "",
        }))
        .filter((p) => p.url)
    : [];

const isChannel = (value: unknown): value is MarketingChannel =>
  typeof value === "string" && (MARKETING_CHANNELS as string[]).includes(value);

const toChannels = (value: unknown): MarketingChannel[] => {
  const selected = new Set(Array.isArray(value) ? value.filter(isChannel) : []);
  const channels = MARKETING_CHANNELS.filter((channel) => selected.has(channel));
  // Rows created before channel support post only to Gopas.
  return channels.length ? channels : ["koreapas"];
};

const toSchedule = (value: unknown): MarketingCronSchedule => {
  const schedule = (value ?? {}) as Record<string, unknown>;
  return {
    minute: toNumber(schedule.minute, DEFAULT_MARKETING_CRON_SETTINGS.schedule.minute),
    hour: toNumber(schedule.hour, DEFAULT_MARKETING_CRON_SETTINGS.schedule.hour),
    daysOfWeek: Array.isArray(schedule.daysOfWeek)
      ? (schedule.daysOfWeek as unknown[]).map((day) => toNumber(day))
      : [],
  };
};

const toSettings = (row: Record<string, unknown> | null): MarketingCronSettings => {
  if (!row) return DEFAULT_MARKETING_CRON_SETTINGS;
  const schedule = (row.schedule ?? {}) as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    nextRunAt: toDate(row.next_run_at),
    schedule: {
      minute: toNumber(schedule.minute, DEFAULT_MARKETING_CRON_SETTINGS.schedule.minute),
      hour: toNumber(schedule.hour, DEFAULT_MARKETING_CRON_SETTINGS.schedule.hour),
      // An explicitly empty list is a saved, disabled schedule. Only a legacy row
      // without this field should receive the original weekday default.
      daysOfWeek: Array.isArray(schedule.daysOfWeek)
        ? (schedule.daysOfWeek as unknown[]).map((d) => toNumber(d))
        : DEFAULT_MARKETING_CRON_SETTINGS.schedule.daysOfWeek,
    },
    templateId: typeof row.template_id === "string" ? row.template_id : "",
    destinationUrl:
      typeof row.destination_url === "string" && row.destination_url
        ? row.destination_url
        : DEFAULT_MARKETING_CRON_SETTINGS.destinationUrl,
    title: typeof row.title === "string" ? row.title : "",
    copy: typeof row.copy === "string" ? row.copy : "",
    callToAction: typeof row.call_to_action === "string" ? row.call_to_action : "",
    photos: toPhotos(row.photos),
    timeZone:
      typeof row.time_zone === "string" && row.time_zone
        ? row.time_zone
        : DEFAULT_MARKETING_CRON_SETTINGS.timeZone,
    lastRunAt: toDate(row.last_run_at),
    updatedAt: toDate(row.updated_at),
  };
};

const toTemplate = (row: Record<string, unknown>): MarketingTemplate => ({
  id: String(row.id ?? ""),
  name: typeof row.name === "string" ? row.name : "",
  destinationUrl: typeof row.destination_url === "string" ? row.destination_url : "",
  title: typeof row.title === "string" ? row.title : "",
  copy: typeof row.copy === "string" ? row.copy : "",
  callToAction: typeof row.call_to_action === "string" ? row.call_to_action : "",
  photos: toPhotos(row.photos),
  channels: toChannels(row.channels),
  threadsText: typeof row.threads_text === "string" ? row.threads_text : "",
  instagramCaption: typeof row.instagram_caption === "string" ? row.instagram_caption : "",
  scheduleEnabled: row.schedule_enabled === true,
  schedule: toSchedule(row.schedule),
  nextRunAt: toDate(row.next_run_at),
  lastRunAt: toDate(row.last_run_at),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const toPerformance = (value: unknown): MarketingPerformanceSnapshot => {
  const data = (value ?? {}) as Record<string, unknown>;
  return {
    trackedPosts: toNumber(data.trackedPosts),
    impressions: toNumber(data.impressions),
    clicks: toNumber(data.clicks),
    signups: toNumber(data.signups),
    likes: toNumber(data.likes),
    comments: toNumber(data.comments),
  };
};

const toRun = (row: Record<string, unknown>): MarketingCronRun => ({
  id: String(row.id ?? ""),
  templateId: typeof row.template_id === "string" ? row.template_id : "",
  channel: isChannel(row.channel) ? row.channel : "koreapas",
  trigger: row.trigger === "manual" ? "manual" : row.trigger === "daily" ? "daily" : "schedule",
  status: (row.status as MarketingRunStatus) || "queued",
  scheduledFor: toDate(row.scheduled_for),
  startedAt: toDate(row.started_at),
  completedAt: toDate(row.completed_at),
  postId: typeof row.post_id === "string" ? row.post_id : "",
  postTitle: typeof row.post_title === "string" ? row.post_title : "",
  postCopy: typeof row.post_copy === "string" ? row.post_copy : "",
  trackingCode: typeof row.tracking_code === "string" ? row.tracking_code : "",
  trackingUrl: typeof row.tracking_url === "string" ? row.tracking_url : "",
  hiddenPostId: typeof row.hidden_post_id === "string" ? row.hidden_post_id : "",
  externalPostUrl: typeof row.external_post_url === "string" ? row.external_post_url : "",
  photos: toPhotos(row.photos),
  performance: toPerformance(row.performance),
  performanceCheckedAt: toDate(row.performance_checked_at),
  error: typeof row.error === "string" ? row.error : "",
});

export const fetchMarketingCronSettings = async (): Promise<MarketingCronSettings> => {
  const { data } = await supabase.from(CONFIG).select("*").eq("id", CONFIG_ROW).maybeSingle();
  return toSettings(data as Record<string, unknown> | null);
};

export type MarketingCronRunPage = {
  runs: MarketingCronRun[];
  hasMore: boolean;
};

export const fetchMarketingCronRuns = async (
  offset = 0,
  pageSize = MARKETING_RUN_PAGE_SIZE,
): Promise<MarketingCronRunPage> => {
  const { data, error } = await supabase
    .from(RUNS)
    .select("*")
    .order("scheduled_for", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    // Fetch a probe row so the dashboard can accurately tell whether there is
    // another page without issuing an expensive count query.
    .range(offset, offset + pageSize);
  if (error) throw error;
  const rows = (data ?? []).map((row) => toRun(row as Record<string, unknown>));
  return { runs: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
};

// Completed runs are immutable per-post snapshots, so they are the correct source
// for a time series. Keep this deliberately bounded; the panel is a marketing
// overview, not an unbounded client-side analytics export.
export const fetchMarketingPerformanceRuns = async (): Promise<MarketingCronRun[]> => {
  const { data, error } = await supabase
    .from(RUNS)
    .select("*")
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MARKETING_PERFORMANCE_POINT_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => toRun(row as Record<string, unknown>));
};

// Run history for one channel (the Threads/Instagram admin pages), one numbered page
// at a time. Every run is one post attempt on that channel, so this doubles as the
// channel's post list.
export const MARKETING_CHANNEL_RUN_PAGE_SIZE = 20;

export const fetchMarketingChannelRuns = async (
  channel: MarketingChannel,
  page = 1,
  pageSize = MARKETING_CHANNEL_RUN_PAGE_SIZE,
): Promise<{ runs: MarketingCronRun[]; total: number }> => {
  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, error, count } = await supabase
    .from(RUNS)
    .select("*", { count: "exact" })
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { runs: (data ?? []).map((row) => toRun(row as Record<string, unknown>)), total: count ?? 0 };
};

// Every run of the last `days` days, for the channel page's totals (independent of the
// history page being viewed).
export const fetchMarketingChannelRecentRuns = async (
  channel: MarketingChannel,
  days = 30,
): Promise<MarketingCronRun[]> => {
  const { data, error } = await supabase
    .from(RUNS)
    .select("*")
    .eq("channel", channel)
    .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((row) => toRun(row as Record<string, unknown>));
};

export const fetchMarketingTemplates = async (): Promise<MarketingTemplate[]> => {
  const { data, error } = await supabase
    .from(TEMPLATES)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(TEMPLATE_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => toTemplate(row as Record<string, unknown>));
};

// Firestore's onSnapshot becomes a Realtime channel. postgres_changes only carries the
// changed row, so each event refetches the ordered list — the volumes here are tiny and
// it keeps the ordering identical to the initial load.
const subscribeToTable = <T>(
  table: string,
  load: () => Promise<T>,
  onChange: (value: T) => void,
): (() => void) => {
  let cancelled = false;
  const push = () => {
    load()
      .then((rows) => {
        if (!cancelled) onChange(rows);
      })
      .catch((e) => console.error(`Failed to load ${table}:`, e));
  };
  push();
  const channel = supabase
    .channel(`${table}-changes`)
    .on("postgres_changes", { event: "*", schema: "public", table }, push)
    .subscribe();
  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
};

export const subscribeToMarketingCronRuns = (
  onChange: (page: MarketingCronRunPage) => void,
): (() => void) => subscribeToTable(RUNS, fetchMarketingCronRuns, onChange);

export const subscribeToMarketingTemplates = (
  onChange: (templates: MarketingTemplate[]) => void,
): (() => void) => subscribeToTable(TEMPLATES, fetchMarketingTemplates, onChange);

// ---- writes ----

export const saveMarketingTemplateSchedule = async (settings: {
  templateId: string;
  schedule: MarketingCronSchedule;
}): Promise<void> => {
  await invokeFunction("marketing", { action: "save-template-schedule", settings });
};

export const createMarketingTemplate = async (template: {
  name: string;
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: MarketingTemplatePhoto[];
  channels: MarketingChannel[];
  threadsText: string;
  instagramCaption: string;
  schedule: MarketingCronSchedule;
}): Promise<string> => {
  const result = await invokeFunction<{ templateId: string }>("marketing", {
    action: "create-template",
    template,
  });
  return result.templateId;
};

export const updateMarketingTemplate = async (
  templateId: string,
  template: {
    destinationUrl: string;
    title: string;
    copy: string;
    callToAction: string;
    photos: MarketingTemplatePhoto[];
    channels: MarketingChannel[];
    threadsText: string;
    instagramCaption: string;
  },
): Promise<void> => {
  const { data, error } = await supabase
    .from(TEMPLATES)
    .update({
      destination_url: template.destinationUrl,
      title: template.title,
      copy: template.copy,
      call_to_action: template.callToAction,
      photos: template.photos,
      channels: template.channels,
      threads_text: template.threadsText,
      instagram_caption: template.instagramCaption,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Marketing template not found or not editable.");
};

export const ensureDefaultMarketingTemplate = async (): Promise<string> => {
  const result = await invokeFunction<{ templateId: string }>("marketing", {
    action: "ensure-default-template",
  });
  return result.templateId;
};

export const deleteMarketingTemplate = async (templateId: string): Promise<void> => {
  await invokeFunction("marketing", { action: "delete-template", templateId });
};

export const deleteMarketingCronRun = async (runId: string): Promise<void> => {
  await invokeFunction("marketing", { action: "delete-run", runId });
};

export type GeneratedMarketingTemplate = {
  name: string;
  title: string;
  copy: string;
  callToAction: string;
  threadsText: string;
  instagramCaption: string;
  schedule: MarketingCronSchedule;
};

export const generateMarketingTemplate = async (input: {
  brief: string;
  destinationUrl: string;
}): Promise<GeneratedMarketingTemplate> => {
  return invokeFunction<GeneratedMarketingTemplate>("marketing", {
    action: "generate-template",
    ...input,
  });
};

export const runMarketingCronNow = async (templateId: string): Promise<void> => {
  await invokeFunction("marketing", { action: "run-now", templateId });
};

// ---- Threads / Instagram connections ----
// Tokens never come back to the browser; the Edge Function returns status only.

export const fetchMarketingChannelConnections = async (): Promise<MarketingChannelConnection[]> => {
  const result = await invokeFunction<{ channels: Array<Record<string, unknown>> }>("marketing", {
    action: "channel-status",
  });
  return (result.channels ?? [])
    .filter((row) => row.channel === "threads" || row.channel === "instagram")
    .map((row) => ({
      channel: row.channel as SocialMarketingChannel,
      connected: row.connected === true,
      username: typeof row.username === "string" ? row.username : "",
      accountId: typeof row.accountId === "string" ? row.accountId : "",
      tokenExpiresAt: toDate(row.tokenExpiresAt),
      connectedAt: toDate(row.connectedAt),
      lastError: typeof row.lastError === "string" ? row.lastError : "",
    }));
};

export const connectMarketingChannel = async (
  channel: SocialMarketingChannel,
  accessToken: string,
): Promise<{ username: string }> =>
  invokeFunction<{ username: string }>("marketing", { action: "connect-channel", channel, accessToken });

export const disconnectMarketingChannel = async (channel: SocialMarketingChannel): Promise<void> => {
  await invokeFunction("marketing", { action: "disconnect-channel", channel });
};
