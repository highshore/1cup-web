// Marketing cron settings, templates and run history — Supabase port of the Firestore
// version. Reads go straight to Postgres; writes go through the `marketing` edge
// function so the admin check and the cron's own bookkeeping stay server-side.
import { supabase, invokeFunction } from "../../../supabase/client";
import {
  DEFAULT_MARKETING_CRON_SETTINGS,
  MarketingCronRun,
  MarketingCronSchedule,
  MarketingCronSettings,
  MarketingPerformanceSnapshot,
  MarketingRunStatus,
  MarketingTemplate,
  MarketingTemplatePhoto,
} from "../types/growth_types";

const CONFIG = "growth_config";
const CONFIG_ROW = "settings";
const RUNS = "marketing_cron_runs";
const TEMPLATES = "marketing_templates";

const RUN_LIMIT = 50;
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

const toSettings = (row: Record<string, unknown> | null): MarketingCronSettings => {
  if (!row) return DEFAULT_MARKETING_CRON_SETTINGS;
  const schedule = (row.schedule ?? {}) as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    nextRunAt: toDate(row.next_run_at),
    schedule: {
      minute: toNumber(schedule.minute, DEFAULT_MARKETING_CRON_SETTINGS.schedule.minute),
      hour: toNumber(schedule.hour, DEFAULT_MARKETING_CRON_SETTINGS.schedule.hour),
      daysOfWeek: Array.isArray(schedule.daysOfWeek)
        ? (schedule.daysOfWeek as unknown[]).map((d) => toNumber(d))
        : DEFAULT_MARKETING_CRON_SETTINGS.schedule.daysOfWeek,
    },
    templateId: typeof row.template_id === "string" ? row.template_id : "",
    templateAssignments:
      row.template_assignments && typeof row.template_assignments === "object"
        ? (row.template_assignments as Record<string, string>)
        : {},
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
  channel: "koreapas",
  trigger: row.trigger === "manual" ? "manual" : "schedule",
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

export const fetchMarketingCronRuns = async (): Promise<MarketingCronRun[]> => {
  const { data, error } = await supabase
    .from(RUNS)
    .select("*")
    .order("scheduled_for", { ascending: false, nullsFirst: false })
    .limit(RUN_LIMIT);
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
  load: () => Promise<T[]>,
  onChange: (rows: T[]) => void,
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
  onChange: (runs: MarketingCronRun[]) => void,
): (() => void) => subscribeToTable(RUNS, fetchMarketingCronRuns, onChange);

export const subscribeToMarketingTemplates = (
  onChange: (templates: MarketingTemplate[]) => void,
): (() => void) => subscribeToTable(TEMPLATES, fetchMarketingTemplates, onChange);

// ---- writes: all through the edge function, which re-checks admin server-side ----

export const saveMarketingCronSettings = async (settings: {
  enabled: boolean;
  schedule: MarketingCronSchedule;
  templateId: string;
  templateAssignments: Record<string, string>;
}): Promise<void> => {
  await invokeFunction("marketing", { action: "save-settings", settings });
};

export const createMarketingTemplate = async (template: {
  name: string;
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: MarketingTemplatePhoto[];
}): Promise<string> => {
  const result = await invokeFunction<{ templateId: string }>("marketing", {
    action: "create-template",
    template,
  });
  return result.templateId;
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

export const runMarketingCronNow = async (): Promise<void> => {
  await invokeFunction("marketing", { action: "run-now" });
};
