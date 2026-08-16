import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db, functions } from "../../../firebase/firebase";
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
const CONFIG_DOC = "settings";
const RUNS = "marketing_cron_runs";
const TEMPLATES = "marketing_templates";

const toDate = (value: unknown): Date | null => {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toSchedule = (value: unknown): MarketingCronSchedule => {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const savedDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek : null;
  const days = savedDays
    ? savedDays.filter(
        (day): day is number =>
          typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6
      )
    : [];
  return {
    minute: Math.min(55, Math.max(0, toNumber(data.minute, 0))),
    hour: Math.min(23, Math.max(0, toNumber(data.hour, 19))),
    daysOfWeek: savedDays
      ? [...new Set(days)].sort((a, b) => a - b)
      : DEFAULT_MARKETING_CRON_SETTINGS.schedule.daysOfWeek,
  };
};

const toTemplateAssignments = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (assignments, [day, templateId]) => {
      if (/^[0-6]$/.test(day) && typeof templateId === "string" && templateId) {
        assignments[day] = templateId;
      }
      return assignments;
    },
    {}
  );
};

const toPhotos = (value: unknown): MarketingTemplatePhoto[] =>
  Array.isArray(value)
    ? value.flatMap((photo) => {
        if (!photo || typeof photo !== "object") return [];
        const data = photo as Record<string, unknown>;
        return typeof data.url === "string" && data.url
          ? [{ url: data.url, alt: typeof data.alt === "string" ? data.alt : "" }]
          : [];
      })
    : [];

const toSettings = (data?: Record<string, unknown>): MarketingCronSettings => ({
  ...DEFAULT_MARKETING_CRON_SETTINGS,
  enabled: Boolean(data?.enabled),
  nextRunAt: toDate(data?.nextRunAt),
  schedule: toSchedule(data?.schedule),
  templateId: typeof data?.templateId === "string" ? data.templateId : "",
  templateAssignments: toTemplateAssignments(data?.templateAssignments),
  destinationUrl:
    typeof data?.destinationUrl === "string"
      ? data.destinationUrl
      : DEFAULT_MARKETING_CRON_SETTINGS.destinationUrl,
  title: typeof data?.title === "string" ? data.title : "",
  copy: typeof data?.copy === "string" ? data.copy : "",
  callToAction: typeof data?.callToAction === "string" ? data.callToAction : "",
  photos: toPhotos(data?.photos),
  timeZone:
    typeof data?.timeZone === "string"
      ? data.timeZone
      : DEFAULT_MARKETING_CRON_SETTINGS.timeZone,
  lastRunAt: toDate(data?.lastRunAt),
  updatedAt: toDate(data?.updatedAt),
});

const toTemplate = (id: string, data: Record<string, unknown>): MarketingTemplate => ({
  id,
  name: typeof data.name === "string" ? data.name : "",
  destinationUrl: typeof data.destinationUrl === "string" ? data.destinationUrl : "",
  title: typeof data.title === "string" ? data.title : "",
  copy: typeof data.copy === "string" ? data.copy : "",
  callToAction: typeof data.callToAction === "string" ? data.callToAction : "",
  photos: toPhotos(data.photos),
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

const toPerformance = (data?: Record<string, unknown>): MarketingPerformanceSnapshot => ({
  trackedPosts: toNumber(data?.trackedPosts),
  impressions: toNumber(data?.impressions),
  clicks: toNumber(data?.clicks),
  signups: toNumber(data?.signups),
  likes: toNumber(data?.likes),
  comments: toNumber(data?.comments),
});

const toRun = (id: string, data: Record<string, unknown>): MarketingCronRun => ({
  id,
  channel: "koreapas",
  trigger: data.trigger === "manual" ? "manual" : "schedule",
  status: (data.status as MarketingRunStatus) || "queued",
  scheduledFor: toDate(data.scheduledFor),
  startedAt: toDate(data.startedAt),
  completedAt: toDate(data.completedAt),
  postId: typeof data.postId === "string" ? data.postId : "",
  postTitle: typeof data.postTitle === "string" ? data.postTitle : "",
  postCopy: typeof data.postCopy === "string" ? data.postCopy : "",
  trackingCode: typeof data.trackingCode === "string" ? data.trackingCode : "",
  trackingUrl: typeof data.trackingUrl === "string" ? data.trackingUrl : "",
  hiddenPostId: typeof data.hiddenPostId === "string" ? data.hiddenPostId : "",
  externalPostUrl: typeof data.externalPostUrl === "string" ? data.externalPostUrl : "",
  photos: toPhotos(data.photos),
  performance: toPerformance(data.performance as Record<string, unknown> | undefined),
  performanceCheckedAt: toDate(data.performanceCheckedAt),
  error: typeof data.error === "string" ? data.error : "",
});

export const fetchMarketingCronSettings = async (): Promise<MarketingCronSettings> => {
  try {
    const snapshot = await getDoc(doc(db, CONFIG, CONFIG_DOC));
    return snapshot.exists()
      ? toSettings(snapshot.data() as Record<string, unknown>)
      : { ...DEFAULT_MARKETING_CRON_SETTINGS };
  } catch (error) {
    console.error("Unable to load marketing cron settings:", error);
    return { ...DEFAULT_MARKETING_CRON_SETTINGS };
  }
};

export const fetchMarketingCronRuns = async (): Promise<MarketingCronRun[]> => {
  try {
    const snapshot = await getDocs(
      query(collection(db, RUNS), orderBy("scheduledFor", "desc"), limit(50))
    );
    return snapshot.docs.map((entry) =>
      toRun(entry.id, entry.data() as Record<string, unknown>)
    );
  } catch (error) {
    console.error("Unable to load marketing cron runs:", error);
    return [];
  }
};

export const fetchMarketingTemplates = async (): Promise<MarketingTemplate[]> => {
  try {
    const snapshot = await getDocs(
      query(collection(db, TEMPLATES), orderBy("updatedAt", "desc"), limit(100))
    );
    return snapshot.docs.map((entry) =>
      toTemplate(entry.id, entry.data() as Record<string, unknown>)
    );
  } catch (error) {
    console.error("Unable to load marketing templates:", error);
    return [];
  }
};

export const subscribeToMarketingCronRuns = (
  onUpdate: (runs: MarketingCronRun[]) => void
) =>
  onSnapshot(
    query(collection(db, RUNS), orderBy("scheduledFor", "desc"), limit(50)),
    (snapshot) =>
      onUpdate(
        snapshot.docs.map((entry) =>
          toRun(entry.id, entry.data() as Record<string, unknown>)
        )
      ),
    (error) => console.error("Unable to watch marketing cron runs:", error)
  );

export const subscribeToMarketingTemplates = (
  onUpdate: (templates: MarketingTemplate[]) => void
) =>
  onSnapshot(
    query(collection(db, TEMPLATES), orderBy("updatedAt", "desc"), limit(100)),
    (snapshot) =>
      onUpdate(
        snapshot.docs.map((entry) =>
          toTemplate(entry.id, entry.data() as Record<string, unknown>)
        )
      ),
    (error) => console.error("Unable to watch marketing templates:", error)
  );

export const saveMarketingCronSettings = async (settings: {
  enabled: boolean;
  schedule: MarketingCronSchedule;
  templateId: string;
  templateAssignments: Record<string, string>;
}) => {
  const callable = httpsCallable(functions, "saveMarketingCronSettings");
  await callable(settings);
};

export const createMarketingTemplate = async (template: {
  name: string;
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: MarketingTemplatePhoto[];
}) => {
  const callable = httpsCallable(functions, "createMarketingTemplate");
  const result = await callable(template);
  return (result.data as { templateId: string }).templateId;
};

export const ensureDefaultMarketingTemplate = async () => {
  const callable = httpsCallable(functions, "ensureDefaultMarketingTemplate");
  const result = await callable({});
  return (result.data as { templateId: string }).templateId;
};

export const deleteMarketingTemplate = async (templateId: string) => {
  const callable = httpsCallable(functions, "deleteMarketingTemplate");
  await callable({ templateId });
};

export const runMarketingCronNow = async () => {
  const callable = httpsCallable(functions, "runMarketingCronNow");
  await callable({});
};
