"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  ArrowPathIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  LinkIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import { useI18n } from "../../../i18n/I18nProvider";
import {
  createMarketingTemplate,
  deleteMarketingCronRun,
  deleteMarketingTemplate,
  ensureDefaultMarketingTemplate,
  fetchMarketingCronRuns,
  fetchMarketingCronSettings,
  fetchMarketingPerformanceRuns,
  fetchMarketingTemplates,
  MARKETING_RUN_PAGE_SIZE,
  generateMarketingTemplate,
  runMarketingCronNow,
  saveMarketingTemplateSchedule,
  subscribeToMarketingCronRuns,
  subscribeToMarketingTemplates,
} from "../services/growth_service";
import { uploadMarketingImage } from "../services/growth_image_service";
import {
  DEFAULT_MARKETING_CRON_SETTINGS,
  MarketingCronRun,
  MarketingCronSchedule,
  MarketingCronSettings,
  MarketingRunStatus,
  MarketingTemplate,
  MarketingTemplatePhoto,
} from "../types/growth_types";

type SettingsDraft = {
  enabled: boolean;
  schedule: MarketingCronSchedule;
  templateId: string;
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: MarketingTemplatePhoto[];
};

const toDraft = (settings: MarketingCronSettings): SettingsDraft => ({
  enabled: settings.enabled,
  schedule: settings.schedule,
  templateId: settings.templateId,
  destinationUrl: settings.destinationUrl,
  title: settings.title,
  copy: settings.copy,
  callToAction: settings.callToAction,
  photos: settings.photos,
});

const zeroWidthMarker = (marker: string) =>
  marker
    .split("")
    .map((character) =>
      character
        .charCodeAt(0)
        .toString(2)
        .padStart(8, "0")
        .replaceAll("0", "\u200B")
        .replaceAll("1", "\u200C")
    )
    .join("\u200D");

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

const formatTemplate = (template: string, date: string) =>
  template.replace("{date}", date);

type PerformancePoint = {
  at: Date;
  views: number;
  ctr: number;
};

/* --- Shared class strings (from the former styled-components) --- */

const focusRingClass =
  "focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2";

// `font: inherit` expanded so the later font-size/weight utilities keep winning.
const fontInheritClass =
  "[font-family:inherit] [font-style:inherit] [line-height:inherit]";

const formCardClass =
  "bg-white border-[3px] border-[#050505] rounded-2xl shadow-[6px_6px_0_rgba(5,5,5,0.9)] p-6 max-[620px]:p-[18px] max-[620px]:shadow-[4px_4px_0_rgba(5,5,5,0.9)]";

const chartCardClass =
  "min-w-0 rounded-xl border-[1.5px] border-[#050505] bg-[#fcfcfc] p-3.5";

const chartHeadingClass = "mb-2.5 flex items-baseline justify-between gap-2.5";

const chartTitleClass = "m-0 text-[13px] font-black text-[#050505]";

/* --- Small components replacing the reused styled-components --- */

const Eyebrow = ({ children }: { children?: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 text-[12px] font-black tracking-[0.05em] text-[#050505] uppercase">
    {children}
  </span>
);

const FormTitle = ({ children }: { children?: ReactNode }) => (
  <h2 className="mx-0 mt-1 mb-1.5 text-[22px] font-black leading-[1.2] text-[#050505]">
    {children}
  </h2>
);

const Description = ({ children }: { children?: ReactNode }) => (
  <p className="m-0 max-w-[720px] text-[14px] font-semibold leading-[1.55] text-[rgba(5,5,5,0.64)]">
    {children}
  </p>
);

const FieldHint = ({ children }: { children?: ReactNode }) => (
  <span className="text-[12px] font-semibold leading-[1.45] text-[rgba(5,5,5,0.56)]">
    {children}
  </span>
);

const Field = ({ $full, children }: { $full?: boolean; children?: ReactNode }) => (
  <label
    className={`flex flex-col gap-[7px] text-[13px] font-black text-[#050505] ${
      $full ? "col-span-full" : ""
    }`}
  >
    {children}
  </label>
);

const Input = ({ className = "", ...rest }: ComponentPropsWithoutRef<"input">) => (
  <input
    className={`box-border min-h-[44px] w-full rounded-[10px] border-2 border-[#050505] bg-white px-[11px] py-2.5 text-[#050505] ${fontInheritClass} [font-weight:inherit] text-[14px] ${focusRingClass} ${className}`}
    {...rest}
  />
);

const Select = ({ className = "", ...rest }: ComponentPropsWithoutRef<"select">) => (
  <select
    className={`box-border min-h-[44px] w-full rounded-[10px] border-2 border-[#050505] bg-white px-[11px] py-2.5 text-[#050505] ${fontInheritClass} [font-weight:inherit] text-[14px] ${focusRingClass} ${className}`}
    {...rest}
  />
);

const TextArea = ({ className = "", ...rest }: ComponentPropsWithoutRef<"textarea">) => (
  <textarea
    className={`box-border min-h-[145px] w-full resize-y rounded-[10px] border-2 border-[#050505] bg-white p-[11px] text-[#050505] [font-family:inherit] [font-style:inherit] [font-weight:inherit] text-[14px] leading-[1.55] ${focusRingClass} ${className}`}
    {...rest}
  />
);

const TemplatePickerActions = ({ children }: { children?: ReactNode }) => (
  <div className="flex flex-wrap gap-2">{children}</div>
);

const PanelTitle = ({
  children,
  ...rest
}: { children?: ReactNode } & ComponentPropsWithoutRef<"h3">) => (
  <h3 className="m-0 text-[14px] font-black text-[#050505]" {...rest}>
    {children}
  </h3>
);

const PanelDescription = ({ children }: { children?: ReactNode }) => (
  <p className="mx-0 mt-1 mb-0 text-[12px] font-semibold leading-[1.45] text-[rgba(5,5,5,0.6)]">
    {children}
  </p>
);

const CompactField = ({
  as: Tag = "label",
  children,
}: {
  as?: "label" | "span";
  children?: ReactNode;
}) => (
  <Tag className="grid gap-1.5 text-[12px] font-black text-[#050505]">{children}</Tag>
);

const Button = ({
  $secondary,
  className = "",
  children,
  ...rest
}: { $secondary?: boolean } & ComponentPropsWithoutRef<"button">) => (
  <button
    className={`inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-[7px] rounded-full border-2 border-[#050505] px-[13px] py-[7px] text-[#050505] shadow-[3px_3px_0_#050505] ${fontInheritClass} text-[13px] font-black transition-[transform,box-shadow] duration-[140ms] ease-[ease] enabled:hover:-translate-x-px enabled:hover:-translate-y-px enabled:hover:shadow-[4px_4px_0_#050505] disabled:cursor-wait disabled:opacity-[0.58] disabled:shadow-none ${
      $secondary ? "bg-white" : "bg-[#f47a4a]"
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const SmallButton = ({
  $danger,
  className = "",
  children,
  ...rest
}: { $danger?: boolean } & ComponentPropsWithoutRef<"button">) => (
  <button
    className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#050505] px-[9px] py-[5px] ${fontInheritClass} text-[12px] font-black disabled:cursor-default disabled:opacity-60 ${
      $danger
        ? "bg-[#fff1f0] text-[#9d1c10] enabled:hover:bg-[#fee2e2]"
        : "bg-white text-[#050505] enabled:hover:bg-[#fff1e9]"
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const Message = ({ $error, children }: { $error?: boolean; children?: ReactNode }) => (
  <span
    className={`text-[13px] font-extrabold leading-[1.4] ${
      $error ? "text-[#ae260f]" : "text-[#17693a]"
    }`}
  >
    {children}
  </span>
);

const statusBgClass: Record<MarketingRunStatus, string> = {
  completed: "bg-[#dff6df]",
  failed: "bg-[#fee2e2]",
  skipped: "bg-[#f5f5f5]",
  awaitingPublisher: "bg-[#fff0c2]",
  queued: "bg-[#eef2ff]",
  running: "bg-[#eef2ff]",
};

const Status = ({
  $status,
  children,
}: {
  $status: MarketingRunStatus;
  children?: ReactNode;
}) => (
  <span
    className={`flex-none whitespace-nowrap rounded-full border-[1.5px] border-[#050505] px-[9px] py-1.5 text-[12px] font-black text-[#050505] ${statusBgClass[$status]}`}
  >
    {children}
  </span>
);

const InlineActions = ({ children }: { children?: ReactNode }) => (
  <div className="flex flex-wrap gap-2">{children}</div>
);

const Notice = ({ $error, children }: { $error?: boolean; children?: ReactNode }) => (
  <div
    className={`flex items-start gap-2 rounded-[10px] border-[1.5px] px-[11px] py-2.5 text-[12px] font-bold leading-[1.5] text-[#4a2600] ${
      $error ? "border-[#c0341d] bg-[#fff1f0]" : "border-[#c68400] bg-[#fff9df]"
    }`}
  >
    {children}
  </div>
);

const TrackingLabel = ({ children }: { children?: ReactNode }) => (
  <span className="text-[11px] font-black text-[rgba(5,5,5,0.56)] uppercase">
    {children}
  </span>
);

const TrackingValue = ({ children }: { children?: ReactNode }) => (
  <span className="[overflow-wrap:anywhere] text-[#050505] [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[12px] font-bold">
    {children}
  </span>
);

const Metric = ({ children }: { children?: ReactNode }) => (
  <div className="min-w-0 rounded-[10px] bg-[#fafafa] p-2.5">{children}</div>
);

const MetricLabel = ({ children }: { children?: ReactNode }) => (
  <dt className="overflow-hidden text-[11px] font-extrabold text-ellipsis whitespace-nowrap text-[rgba(5,5,5,0.55)]">
    {children}
  </dt>
);

const MetricValue = ({ children }: { children?: ReactNode }) => (
  <dd className="mx-0 mt-1 mb-0 text-[17px] font-black text-[#050505]">{children}</dd>
);

const Loading = ({ children }: { children?: ReactNode }) => (
  <div className="flex min-h-[180px] items-center justify-center gap-[9px] text-[14px] font-extrabold text-[rgba(5,5,5,0.66)]">
    {children}
  </div>
);

const TimeSeriesChart = ({
  title,
  points,
  value,
  color,
  suffix = "",
  emptyLabel,
  formatDate,
}: {
  title: string;
  points: PerformancePoint[];
  value: (point: PerformancePoint) => number;
  color: string;
  suffix?: string;
  emptyLabel: string;
  formatDate: (date: Date) => string;
}) => {
  if (!points.length) {
    return (
      <section className={chartCardClass}>
        <div className={chartHeadingClass}><h3 className={chartTitleClass}>{title}</h3></div>
        <div className="grid min-h-[142px] place-items-center text-center text-[13px] font-bold text-[rgba(5,5,5,0.56)]">{emptyLabel}</div>
      </section>
    );
  }

  const width = 320;
  const height = 132;
  const padding = { top: 14, right: 12, bottom: 10, left: 30 };
  const values = points.map(value);
  const max = Math.max(...values, 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const coordinates = values.map((current, index) => {
    const x = padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - (current / max) * chartHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const latest = values.at(-1) ?? 0;

  return (
    <section className={chartCardClass}>
      <div className={chartHeadingClass}>
        <h3 className={chartTitleClass}>{title}</h3>
        <strong className="text-[18px] font-black text-[#050505]">{suffix ? `${latest.toFixed(1)}${suffix}` : latest.toLocaleString()}</strong>
      </div>
      <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight - ratio * chartHeight;
          return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dedede" strokeWidth="1" />;
        })}
        <text x="0" y={padding.top + 4} fill="#6a6a6a" fontSize="10" fontWeight="700">
          {suffix ? `${max.toFixed(1)}${suffix}` : max.toLocaleString()}
        </text>
        <polyline points={coordinates.join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((coordinate, index) => {
          const [cx, cy] = coordinate.split(",");
          return <circle key={`${coordinate}_${index}`} cx={cx} cy={cy} r="3.5" fill="#ffffff" stroke={color} strokeWidth="2" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between gap-3 text-[11px] font-bold text-[rgba(5,5,5,0.56)]">
        <span>{formatDate(points[0].at)}</span>
        <span>{formatDate(points.at(-1)!.at)}</span>
      </div>
    </section>
  );
};

const statusKey: Record<MarketingRunStatus, "queued" | "running" | "posted" | "skipped" | "awaitingPublisher" | "failed"> = {
  queued: "queued",
  running: "running",
  completed: "posted",
  skipped: "skipped",
  awaitingPublisher: "awaitingPublisher",
  failed: "failed",
};

export default function GrowthDashboard() {
  const { locale, t } = useI18n();
  const marketing = t.admin.marketing;
  const [draft, setDraft] = useState<SettingsDraft>(() =>
    toDraft(DEFAULT_MARKETING_CRON_SETTINGS)
  );
  const [runs, setRuns] = useState<MarketingCronRun[]>([]);
  const [performanceRuns, setPerformanceRuns] = useState<MarketingCronRun[]>([]);
  const [selectedPerformanceTemplateId, setSelectedPerformanceTemplateId] = useState("all");
  const [hasMoreRuns, setHasMoreRuns] = useState(false);
  const [loadingMoreRuns, setLoadingMoreRuns] = useState(false);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(() => new Set());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const moreRunsRef = useRef<HTMLDivElement>(null);
  const loadingMoreRunsRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      let defaultTemplateId = "";
      try {
        defaultTemplateId = await ensureDefaultMarketingTemplate();
      } catch (error) {
        console.error("Unable to ensure the default Gopas template:", error);
      }
      const [settings, nextRunPage, nextTemplates, nextPerformanceRuns] = await Promise.all([
        fetchMarketingCronSettings(),
        fetchMarketingCronRuns(),
        fetchMarketingTemplates(),
        fetchMarketingPerformanceRuns(),
      ]);
      if (!mounted) return;
      const initialTemplateId = nextTemplates.some((template) => template.id === settings.templateId)
        ? settings.templateId
        : defaultTemplateId;
      const savedTemplate = nextTemplates.find(
        (template) => template.id === initialTemplateId
      );
      setDraft(
        savedTemplate
          ? {
              ...toDraft(settings),
              templateId: initialTemplateId,
              destinationUrl: savedTemplate.destinationUrl,
              title: savedTemplate.title,
              copy: savedTemplate.copy,
              callToAction: savedTemplate.callToAction,
              photos: savedTemplate.photos,
              enabled: savedTemplate.scheduleEnabled,
              schedule: savedTemplate.schedule,
            }
          : toDraft(settings)
      );
      setRuns(nextRunPage.runs);
      setHasMoreRuns(nextRunPage.hasMore);
      setTemplates(nextTemplates);
      setPerformanceRuns(nextPerformanceRuns);
      setLoading(false);
    };

    void load();
    const unsubscribe = subscribeToMarketingCronRuns((nextRunPage) => {
      if (mounted) {
        setRuns((current) => {
          const refreshedIds = new Set(nextRunPage.runs.map((run) => run.id));
          return [...nextRunPage.runs, ...current.filter((run) => !refreshedIds.has(run.id))];
        });
        setHasMoreRuns(nextRunPage.hasMore);
        void fetchMarketingPerformanceRuns()
          .then((nextPerformanceRuns) => {
            if (mounted) setPerformanceRuns(nextPerformanceRuns);
          })
          .catch((error) => console.error("Unable to refresh marketing performance series:", error));
        setLoading(false);
      }
    });
    const unsubscribeTemplates = subscribeToMarketingTemplates((nextTemplates) => {
      if (mounted) setTemplates(nextTemplates);
    });

    return () => {
      mounted = false;
      unsubscribe();
      unsubscribeTemplates();
    };
  }, []);

  const loadMoreRuns = async () => {
    if (loadingMoreRunsRef.current || !hasMoreRuns) return;
    loadingMoreRunsRef.current = true;
    setLoadingMoreRuns(true);
    try {
      const nextPage = await fetchMarketingCronRuns(runs.length, MARKETING_RUN_PAGE_SIZE);
      setRuns((current) => {
        const existing = new Set(current.map((run) => run.id));
        return [...current, ...nextPage.runs.filter((run) => !existing.has(run.id))];
      });
      setHasMoreRuns(nextPage.hasMore);
    } catch (error) {
      console.error("Unable to load more marketing runs:", error);
      setMessage({ text: marketing.loadMoreRunsError, error: true });
    } finally {
      loadingMoreRunsRef.current = false;
      setLoadingMoreRuns(false);
    }
  };

  useEffect(() => {
    const target = moreRunsRef.current;
    if (!target || !hasMoreRuns) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreRuns();
      },
      { rootMargin: "360px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreRuns, runs.length]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }),
    [locale]
  );

  const performanceDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Seoul",
      }),
    [locale],
  );

  const performanceTemplateOptions = useMemo(() => {
    const names = new Map(templates.map((template) => [template.id, template.name]));
    return [...new Set(performanceRuns.map((run) => run.templateId).filter(Boolean))]
      .map((id) => ({ id, name: names.get(id) || id }))
      .sort((left, right) => left.name.localeCompare(right.name, locale));
  }, [locale, performanceRuns, templates]);

  const performancePoints = useMemo<PerformancePoint[]>(() =>
    performanceRuns
      .filter((run) => selectedPerformanceTemplateId === "all" || run.templateId === selectedPerformanceTemplateId)
      .map((run) => {
        const at = run.completedAt || run.scheduledFor;
        if (!at) return null;
        const views = run.performance.impressions;
        return {
          at,
          views,
          ctr: views > 0 ? (run.performance.clicks / views) * 100 : 0,
        };
      })
      .filter((point): point is PerformancePoint => !!point)
      .sort((left, right) => left.at.getTime() - right.at.getTime()),
    [performanceRuns, selectedPerformanceTemplateId],
  );

  const updateDraft = <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key]
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const updateSchedule = <Key extends keyof MarketingCronSchedule>(
    key: Key,
    value: MarketingCronSchedule[Key]
  ) =>
    setDraft((current) => ({
      ...current,
      schedule: { ...current.schedule, [key]: value },
    }));

  const selectTemplate = (templateId: string) => {
    const template = templates.find((candidate) => candidate.id === templateId);
    setDraft((current) =>
      template
        ? {
            ...current,
            templateId,
            destinationUrl: template.destinationUrl,
            title: template.title,
            copy: template.copy,
            callToAction: template.callToAction,
            photos: template.photos,
            enabled: template.scheduleEnabled,
            schedule: template.schedule,
          }
        : { ...current, templateId: "" }
    );
  };

  const startNewTemplate = () => {
    setDraft({
      ...toDraft(DEFAULT_MARKETING_CRON_SETTINGS),
      destinationUrl: draft.destinationUrl || DEFAULT_MARKETING_CRON_SETTINGS.destinationUrl,
    });
    setTemplateName("");
    setAiBrief("");
    setMessage(null);
  };

  const toggleWeekday = (day: number) => {
    const selected = draft.schedule.daysOfWeek.includes(day);
    const next = selected
      ? draft.schedule.daysOfWeek.filter((candidate) => candidate !== day)
      : [...draft.schedule.daysOfWeek, day].sort((a, b) => a - b);
    setDraft((current) => ({
      ...current,
      enabled: next.length > 0 ? current.enabled : false,
      schedule: { ...current.schedule, daysOfWeek: next },
    }));
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const availableSlots = 6 - draft.photos.length;
    if (availableSlots <= 0) {
      setMessage({ text: marketing.photoLimitError, error: true });
      return;
    }
    setUploadingPhotos(true);
    setMessage(null);
    try {
      const uploaded = await Promise.all(files.slice(0, availableSlots).map(uploadMarketingImage));
      setDraft((current) => ({
        ...current,
        photos: [
          ...current.photos,
          ...uploaded.map((url, index) => ({
            url,
            alt: files[index]?.name.replace(/\.[^.]+$/, "") || "Gopas image",
          })),
        ],
      }));
      if (files.length > availableSlots) {
        setMessage({ text: marketing.photoLimitError, error: true });
      }
    } catch (error) {
      console.error("Unable to upload marketing photo:", error);
      setMessage({ text: marketing.photoUploadError, error: true });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const updatePhotoAlt = (index: number, alt: string) =>
    setDraft((current) => ({
      ...current,
      photos: current.photos.map((photo, photoIndex) =>
        photoIndex === index ? { ...photo, alt } : photo
      ),
    }));

  const movePhoto = (index: number, direction: -1 | 1) =>
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.photos.length) return current;
      const photos = [...current.photos];
      [photos[index], photos[target]] = [photos[target], photos[index]];
      return { ...current, photos };
    });

  const removePhoto = (index: number) =>
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((_, photoIndex) => photoIndex !== index),
    }));

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (!draft.templateId) throw new Error("Select a template first.");
      await saveMarketingTemplateSchedule({
        templateId: draft.templateId,
        scheduleEnabled: draft.enabled,
        schedule: draft.schedule,
      });
      setMessage({ text: marketing.settingsSaved });
    } catch (error) {
      console.error("Unable to save marketing cron settings:", error);
      setMessage({ text: marketing.settingsError, error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    setSavingTemplate(true);
    setMessage(null);
    try {
      const templateId = await createMarketingTemplate({
        name: templateName,
        destinationUrl: draft.destinationUrl,
        title: draft.title,
        copy: draft.copy,
        callToAction: draft.callToAction,
        photos: draft.photos,
        scheduleEnabled: draft.enabled,
        schedule: draft.schedule,
      });
      setTemplateName("");
      setTemplateDialogOpen(false);
      const nextTemplates = await fetchMarketingTemplates();
      setTemplates(nextTemplates);
      const saved = nextTemplates.find((template) => template.id === templateId);
      if (saved) {
        setDraft((current) => ({
          ...current,
          templateId,
          destinationUrl: saved.destinationUrl,
          title: saved.title,
          copy: saved.copy,
          callToAction: saved.callToAction,
          photos: saved.photos,
          enabled: saved.scheduleEnabled,
          schedule: saved.schedule,
        }));
      }
      setMessage({ text: marketing.templateSaved });
    } catch (error) {
      console.error("Unable to create marketing template:", error);
      setMessage({ text: marketing.templateError, error: true });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleGenerateTemplate = async () => {
    if (!aiBrief.trim() || !draft.destinationUrl.trim()) {
      setMessage({ text: marketing.aiTemplateError, error: true });
      return;
    }
    setGeneratingTemplate(true);
    setMessage(null);
    try {
      const generated = await generateMarketingTemplate({
        brief: aiBrief,
        destinationUrl: draft.destinationUrl,
      });
      setTemplateName(generated.name);
      setDraft((current) => ({
        ...current,
        templateId: "",
        title: generated.title,
        copy: generated.copy,
        callToAction: generated.callToAction,
        schedule: generated.schedule,
        // A generated draft never activates a schedule until the admin explicitly
        // turns the toggle on before saving it as a template.
        enabled: false,
      }));
      setMessage({ text: marketing.aiDraftReady });
    } catch (error) {
      console.error("Unable to generate marketing template:", error);
      setMessage({ text: marketing.aiTemplateError, error: true });
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!draft.templateId || !window.confirm(marketing.deleteTemplateConfirm)) return;
    setDeletingTemplate(true);
    setMessage(null);
    try {
      await deleteMarketingTemplate(draft.templateId);
      updateDraft("templateId", "");
    } catch (error) {
      console.error("Unable to delete marketing template:", error);
      setMessage({ text: marketing.templateError, error: true });
    } finally {
      setDeletingTemplate(false);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!window.confirm(marketing.deleteRunConfirm)) return;
    setDeletingRunId(runId);
    setMessage(null);
    try {
      await deleteMarketingCronRun(runId);
      setRuns((current) => current.filter((run) => run.id !== runId));
      setMessage({ text: marketing.recordDeleted });
    } catch (error) {
      console.error("Unable to delete marketing run:", error);
      setMessage({ text: marketing.recordDeleteError, error: true });
    } finally {
      setDeletingRunId(null);
    }
  };

  const handleRunNow = async () => {
    if (!draft.templateId) {
      setMessage({ text: marketing.runNowError, error: true });
      return;
    }
    setRunningNow(true);
    setMessage(null);
    try {
      await runMarketingCronNow(draft.templateId);
      const nextRunPage = await fetchMarketingCronRuns();
      setRuns(nextRunPage.runs);
      setHasMoreRuns(nextRunPage.hasMore);
    } catch (error) {
      console.error("Unable to start marketing cron run:", error);
      setMessage({ text: marketing.runNowError, error: true });
    } finally {
      setRunningNow(false);
    }
  };

  const handleCopy = async (run: MarketingCronRun) => {
    if (!run.postCopy || !run.trackingUrl) return;
    try {
      const invisibleMarker = run.hiddenPostId
        ? "\u2063" + zeroWidthMarker(run.hiddenPostId)
        : "";
      const trackingSuffix = run.postCopy.includes(run.trackingUrl)
        ? ""
        : `\n\n${run.trackingUrl}`;
      await copyText(`${run.postCopy}${trackingSuffix}${invisibleMarker}`);
      setCopiedRunId(run.id);
      window.setTimeout(() => setCopiedRunId(null), 1800);
    } catch (error) {
      console.error("Unable to copy the Gopas post:", error);
    }
  };

  const dateLabel = (date: Date | null) => (date ? formatter.format(date) : "—");
  const getStatusLabel = (status: MarketingRunStatus) => marketing[statusKey[status]];
  const weekdays = [
    marketing.sunday,
    marketing.monday,
    marketing.tuesday,
    marketing.wednesday,
    marketing.thursday,
    marketing.friday,
    marketing.saturday,
  ];
  const selectedTemplate = templates.find((template) => template.id === draft.templateId);
  const hasTemplateContent = Boolean(
    draft.destinationUrl.trim() &&
      draft.title.trim() &&
      draft.copy.trim() &&
      draft.callToAction.trim()
  );
  const isTemplateDirty = selectedTemplate
    ? selectedTemplate.destinationUrl !== draft.destinationUrl ||
      selectedTemplate.title !== draft.title ||
      selectedTemplate.copy !== draft.copy ||
      selectedTemplate.callToAction !== draft.callToAction ||
      JSON.stringify(selectedTemplate.photos) !== JSON.stringify(draft.photos)
    : hasTemplateContent;
  const scheduleHasDays = draft.schedule.daysOfWeek.length > 0;
  const canSaveSchedule = Boolean(draft.templateId) && !isTemplateDirty;

  return (
    <>
      <section className={`${formCardClass} mb-8`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow><ChartBarIcon width={15} /> {marketing.performanceAnalytics}</Eyebrow>
            <FormTitle>{marketing.performanceAnalyticsTitle}</FormTitle>
            <Description>{marketing.performanceAnalyticsDescription}</Description>
          </div>
          <CompactField>
            {marketing.performanceTemplateSelect}
            <select
              className={`box-border min-h-[42px] min-w-[min(100%,250px)] rounded-[10px] border-2 border-[#050505] bg-white px-[10px] py-[9px] text-[#050505] ${fontInheritClass} text-[13px] font-extrabold ${focusRingClass}`}
              value={selectedPerformanceTemplateId}
              onChange={(event) => setSelectedPerformanceTemplateId(event.target.value)}
            >
              <option value="all">{marketing.allTemplates}</option>
              {performanceTemplateOptions.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </CompactField>
        </div>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3.5 max-[680px]:grid-cols-1">
          <TimeSeriesChart
            title={marketing.viewsTimeSeries}
            points={performancePoints}
            value={(point) => point.views}
            color="#f47a4a"
            emptyLabel={marketing.noPerformanceData}
            formatDate={(date) => performanceDateFormatter.format(date)}
          />
          <TimeSeriesChart
            title={marketing.ctrTimeSeries}
            points={performancePoints}
            value={(point) => point.ctr}
            color="#2a65c7"
            suffix="%"
            emptyLabel={marketing.noPerformanceData}
            formatDate={(date) => performanceDateFormatter.format(date)}
          />
        </div>
      </section>
      <section className={formCardClass}>
        <div className="mb-[22px] flex items-start justify-between gap-4 max-[620px]:mb-[18px]">
          <div>
            <Eyebrow><CalendarDaysIcon width={15} /> {marketing.koreapas}</Eyebrow>
            <FormTitle>{marketing.settingsTitle}</FormTitle>
            <Description>{marketing.settingsDescription}</Description>
          </div>
          <div
            className={`inline-flex flex-none items-center gap-[7px] rounded-full border-[1.5px] border-[#050505] px-2.5 py-[7px] text-[12px] font-black text-[#050505] max-[620px]:hidden ${
              draft.enabled && scheduleHasDays ? "bg-[#dff6df]" : "bg-[#f5f5f5]"
            }`}
          >
            <CheckIcon width={14} /> {draft.enabled && scheduleHasDays ? marketing.enabled : marketing.scheduleDisabled}
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-5 max-[740px]:grid-cols-1">
            <div className="col-span-full grid gap-2">
              <PanelTitle>{marketing.templateEditorTitle}</PanelTitle>
              <PanelDescription>{marketing.templateEditorDescription}</PanelDescription>
              <CompactField>
                {marketing.templateSelect}
                <Select
                  value={draft.templateId}
                  onChange={(event) => selectTemplate(event.target.value)}
                >
                  <option value="">{marketing.templatePlaceholder}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </CompactField>
              <TemplatePickerActions>
                <SmallButton type="button" onClick={startNewTemplate}>
                  <PlusIcon width={15} /> {marketing.newTemplate}
                </SmallButton>
              </TemplatePickerActions>
              <CompactField>
                {marketing.aiTemplateBrief}
                <TextArea
                  value={aiBrief}
                  maxLength={2000}
                  placeholder={marketing.aiTemplateBriefPlaceholder}
                  onChange={(event) => setAiBrief(event.target.value)}
                />
                <FieldHint>{marketing.aiTemplateDescription}</FieldHint>
              </CompactField>
              <TemplatePickerActions>
                <SmallButton
                  type="button"
                  disabled={generatingTemplate}
                  onClick={() => void handleGenerateTemplate()}
                >
                  {generatingTemplate ? <ArrowPathIcon width={15} /> : <SparklesIcon width={15} />}
                  {generatingTemplate ? marketing.generatingTemplate : marketing.generateTemplate}
                </SmallButton>
              </TemplatePickerActions>
            </div>
            <div className="col-span-full grid gap-3.5 border-b-[1.5px] border-[rgba(5,5,5,0.22)] pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <PanelTitle>{marketing.scheduleTitle}</PanelTitle>
                  <PanelDescription>{marketing.scheduleDescription}</PanelDescription>
                </div>
              </div>
              <div className="grid grid-cols-[120px_120px_minmax(0,1fr)] gap-3 max-[740px]:grid-cols-[1fr_1fr] max-[480px]:grid-cols-1">
                <CompactField>
                  {marketing.scheduleHour}
                  <Select
                    value={draft.schedule.hour}
                    onChange={(event) => updateSchedule("hour", Number(event.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, index) => index).map((hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}
                      </option>
                    ))}
                  </Select>
                </CompactField>
                <CompactField>
                  {marketing.scheduleMinute}
                  <Select
                    value={draft.schedule.minute}
                    onChange={(event) => updateSchedule("minute", Number(event.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => (
                      <option key={minute} value={minute}>
                        {String(minute).padStart(2, "0")}
                      </option>
                    ))}
                  </Select>
                </CompactField>
                <div className="grid gap-[7px] max-[740px]:col-span-full">
                  <CompactField as="span">{marketing.scheduleWeekdays}</CompactField>
                  <div className="flex flex-wrap gap-1.5">
                    {weekdays.map((weekday, day) => (
                      <button
                        key={weekday}
                        type="button"
                        className={`min-h-8 min-w-8 cursor-pointer rounded-full border-[1.5px] border-[#050505] px-2 py-1 text-[#050505] ${fontInheritClass} text-[12px] font-black ${
                          draft.schedule.daysOfWeek.includes(day) ? "bg-[#f47a4a]" : "bg-white"
                        } ${focusRingClass}`}
                        onClick={() => toggleWeekday(day)}
                        aria-pressed={draft.schedule.daysOfWeek.includes(day)}
                      >
                        {weekday}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {draft.schedule.daysOfWeek.length === 0 && (
                <FieldHint>{marketing.scheduleDisabledWithoutDays}</FieldHint>
              )}
              <div className="grid gap-[5px]">
                <PanelTitle>{marketing.otherRulesTitle}</PanelTitle>
                <strong className="text-[12px] font-black text-[#050505]">{marketing.duplicateRuleTitle}</strong>
                <PanelDescription>{marketing.duplicateRuleDescription}</PanelDescription>
              </div>
            </div>
            <Field $full>
              {marketing.destinationUrl}
              <Input
                type="url"
                value={draft.destinationUrl}
                placeholder={marketing.destinationPlaceholder}
                onChange={(event) => updateDraft("destinationUrl", event.target.value)}
                required
              />
              <FieldHint>{marketing.destinationHint}</FieldHint>
            </Field>
            <Field $full>
              {marketing.postTitle}
              <Input
                value={draft.title}
                placeholder={marketing.postTitlePlaceholder}
                maxLength={180}
                onChange={(event) => updateDraft("title", event.target.value)}
                required
              />
              <FieldHint>{marketing.templateVariablesHint}</FieldHint>
            </Field>
            <Field $full>
              {marketing.postCopy}
              <TextArea
                value={draft.copy}
                placeholder={marketing.copyPlaceholder}
                maxLength={8000}
                onChange={(event) => updateDraft("copy", event.target.value)}
                required
              />
            </Field>
            <Field $full>
              {marketing.callToAction}
              <Input
                value={draft.callToAction}
                placeholder={marketing.callToActionPlaceholder}
                maxLength={1000}
                onChange={(event) => updateDraft("callToAction", event.target.value)}
                required
              />
            </Field>
            <div className="col-span-full grid gap-2.5">
              <div>
                <PanelTitle>{marketing.photosTitle}</PanelTitle>
                <PanelDescription>{marketing.photosDescription}</PanelDescription>
              </div>
              <input
                className="hidden"
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => void handlePhotoUpload(event)}
              />
              <InlineActions>
                <SmallButton
                  type="button"
                  disabled={uploadingPhotos || draft.photos.length >= 6}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {uploadingPhotos ? <ArrowPathIcon width={15} /> : <PhotoIcon width={15} />}
                  {uploadingPhotos ? marketing.uploadingPhotos : marketing.addPhotos}
                </SmallButton>
                <FieldHint>{marketing.photoLimit}</FieldHint>
              </InlineActions>
              {draft.photos.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
                  {draft.photos.map((photo, index) => (
                    <div
                      key={`${photo.url}_${index}`}
                      className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-[9px] rounded-[10px] border-[1.5px] border-[rgba(5,5,5,0.4)] p-2"
                    >
                      <img
                        className="h-14 w-14 rounded-lg bg-[#f5f5f5] object-cover"
                        src={photo.url}
                        alt={photo.alt || marketing.photoDefaultAlt}
                      />
                      <div className="grid min-w-0 gap-1.5">
                        <Input
                          aria-label={marketing.photoAlt}
                          value={photo.alt}
                          maxLength={180}
                          placeholder={marketing.photoAltPlaceholder}
                          onChange={(event) => updatePhotoAlt(index, event.target.value)}
                        />
                        <div className="flex flex-wrap gap-[5px]">
                          <SmallButton
                            type="button"
                            disabled={index === 0}
                            onClick={() => movePhoto(index, -1)}
                          >
                            {marketing.movePhotoUp}
                          </SmallButton>
                          <SmallButton
                            type="button"
                            disabled={index === draft.photos.length - 1}
                            onClick={() => movePhoto(index, 1)}
                          >
                            {marketing.movePhotoDown}
                          </SmallButton>
                          <SmallButton type="button" onClick={() => removePhoto(index)}>
                            {marketing.removePhoto}
                          </SmallButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-full flex flex-wrap items-center gap-[9px]">
              {isTemplateDirty && hasTemplateContent && (
                <SmallButton
                  type="button"
                  disabled={savingTemplate}
                  onClick={() => setTemplateDialogOpen(true)}
                >
                  <CheckIcon width={14} />
                  {draft.templateId ? marketing.saveTemplateChanges : marketing.saveTemplate}
                </SmallButton>
              )}
              {draft.templateId && (
                <SmallButton
                  type="button"
                  disabled={deletingTemplate}
                  onClick={() => void handleDeleteTemplate()}
                >
                  {marketing.deleteTemplate}
                </SmallButton>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <label className="inline-flex w-fit cursor-pointer items-center gap-[9px] text-[13px] font-black text-[#050505]">
              <input
                className={`relative m-0 h-6 w-[42px] cursor-pointer appearance-none rounded-full border-2 border-[#050505] bg-[#d9d9d9] transition-[background] duration-[160ms] ease-[ease] checked:bg-[#f47a4a] after:absolute after:top-[3px] after:left-[3px] after:h-3.5 after:w-3.5 after:rounded-full after:border-[1.5px] after:border-[#050505] after:bg-white after:transition-transform after:duration-[160ms] after:ease-[ease] after:content-[''] checked:after:translate-x-[17px] ${focusRingClass}`}
                type="checkbox"
                checked={draft.enabled && scheduleHasDays}
                disabled={!scheduleHasDays}
                onChange={(event) => updateDraft("enabled", event.target.checked)}
              />
              {marketing.enabled}
            </label>
            <Button type="submit" disabled={saving || !canSaveSchedule}>
              {saving ? <ArrowPathIcon width={16} /> : <CheckIcon width={16} />}
              {saving ? marketing.savingSettings : marketing.saveSettings}
            </Button>
            <Button
              type="button"
              $secondary
              disabled={runningNow || saving}
              onClick={handleRunNow}
            >
              {runningNow ? <ArrowPathIcon width={16} /> : <PlayIcon width={16} />}
              {runningNow ? marketing.runningNow : marketing.runNow}
            </Button>
            {message && <Message $error={message.error}>{message.text}</Message>}
          </div>
        </form>
      </section>

      {templateDialogOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(5,5,5,0.45)] p-5"
          role="presentation"
          onMouseDown={() => setTemplateDialogOpen(false)}
        >
          <div
            className="grid w-[min(100%,430px)] gap-3.5 rounded-2xl border-2 border-[#050505] bg-white p-5 shadow-[6px_6px_0_#050505]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-template-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <PanelTitle id="save-template-title">{marketing.newTemplateDialogTitle}</PanelTitle>
              <PanelDescription>{marketing.newTemplateDialogDescription}</PanelDescription>
            </div>
            <CompactField>
              {marketing.newTemplateName}
              <Input
                autoFocus
                value={templateName}
                maxLength={100}
                placeholder={marketing.newTemplatePlaceholder}
                onChange={(event) => setTemplateName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && templateName.trim() && !savingTemplate) {
                    event.preventDefault();
                    void handleCreateTemplate();
                  }
                }}
              />
            </CompactField>
            <div className="flex flex-wrap justify-end gap-[9px]">
              <SmallButton type="button" onClick={() => setTemplateDialogOpen(false)}>
                {marketing.cancel}
              </SmallButton>
              <Button
                type="button"
                disabled={savingTemplate || !templateName.trim()}
                onClick={() => void handleCreateTemplate()}
              >
                {savingTemplate ? <ArrowPathIcon width={16} /> : <CheckIcon width={16} />}
                {savingTemplate ? marketing.savingTemplate : marketing.saveTemplate}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-0 mt-8 mb-3.5 flex items-center justify-between gap-3">
        <h2 className="m-0 text-[20px] font-black text-[#050505]">{marketing.runsTitle}</h2>
        <span className="rounded-full border-[1.5px] border-[#050505] px-[9px] py-[5px] text-[12px] font-black text-[#050505]">
          {marketing.runs.replace("{count}", String(runs.length))}
        </span>
      </div>

      {loading ? (
        <Loading><ArrowPathIcon width={19} /> {marketing.loading}</Loading>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[rgba(5,5,5,0.48)] px-5 py-9 text-center text-[14px] font-bold text-[rgba(5,5,5,0.64)]">
          {marketing.noRuns}
        </div>
      ) : (
        <div className="grid gap-4">
          {runs.map((run) => {
            const date = run.completedAt || run.startedAt || run.scheduledFor;
            const displayTitle = run.postTitle || marketing.koreapas;
            const isExpanded = expandedRunIds.has(run.id);
            const ctr = run.performance.impressions
              ? `${((run.performance.clicks / run.performance.impressions) * 100).toFixed(1)}%`
              : "—";
            return (
              <article
                key={run.id}
                className="overflow-hidden rounded-2xl border-2 border-[#050505] bg-white shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
              >
                <div className="flex items-start justify-between gap-4 px-[18px] pt-[18px] pb-3.5">
                  <div>
                    <div className="mb-[7px] flex flex-wrap items-center gap-[7px]">
                      <span className="rounded-full bg-[#f47a4a] px-2 py-1 text-[11px] font-black text-[#050505]">
                        {marketing.koreapas}
                      </span>
                      <span className="text-[12px] font-extrabold text-[rgba(5,5,5,0.58)]">
                        {run.trigger === "manual" ? marketing.triggerManual : marketing.triggerScheduled}
                      </span>
                    </div>
                    <h3 className="m-0 text-[18px] font-black leading-[1.32] text-[#050505]">{displayTitle}</h3>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <SmallButton
                      type="button"
                      onClick={() =>
                        setExpandedRunIds((current) => {
                          const next = new Set(current);
                          if (next.has(run.id)) next.delete(run.id);
                          else next.add(run.id);
                          return next;
                        })
                      }
                      aria-expanded={isExpanded}
                      aria-controls={`marketing-run-${run.id}`}
                    >
                      {isExpanded ? <ChevronUpIcon width={15} /> : <ChevronDownIcon width={15} />}
                      {isExpanded ? marketing.collapseRun : marketing.expandRun}
                    </SmallButton>
                    <Status $status={run.status}>{getStatusLabel(run.status)}</Status>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-[7px] px-[18px] pt-0 pb-[15px] text-[12px] font-bold text-[rgba(5,5,5,0.6)]">
                  <span>{formatTemplate(marketing.scheduledFor, dateLabel(run.scheduledFor))}</span>
                  {run.completedAt && (
                    <span>{formatTemplate(marketing.completed, dateLabel(run.completedAt))}</span>
                  )}
                  {!run.completedAt && run.startedAt && (
                    <span>{formatTemplate(marketing.started, dateLabel(run.startedAt))}</span>
                  )}
                </div>
                {isExpanded && (
                <div
                  id={`marketing-run-${run.id}`}
                  className="grid gap-4 border-t border-[rgba(5,5,5,0.16)] px-[18px] pt-[17px] pb-[18px]"
                >
                  {run.status === "awaitingPublisher" && (
                    <Notice>
                      <ExclamationTriangleIcon width={16} />
                      <span>{marketing.awaitingPublisherHint}</span>
                    </Notice>
                  )}
                  {run.status === "failed" && run.error && (
                    <Notice $error>
                      <ExclamationTriangleIcon width={16} />
                      <span>{run.error}</span>
                    </Notice>
                  )}
                  {run.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {run.photos.map((photo, index) => (
                        <img
                          key={`${photo.url}_${index}`}
                          className="h-[60px] w-[88px] rounded-lg bg-[#f5f5f5] object-cover"
                          src={photo.url}
                          alt={photo.alt || marketing.photoDefaultAlt}
                        />
                      ))}
                    </div>
                  )}
                  {run.postCopy && (
                    <p className="m-0 text-[14px] leading-[1.6] whitespace-pre-wrap text-[#252525]">{run.postCopy}</p>
                  )}
                  {run.trackingUrl && (
                    <>
                      <InlineActions>
                        <SmallButton type="button" onClick={() => void handleCopy(run)}>
                          <ClipboardDocumentIcon width={15} />
                          {copiedRunId === run.id ? marketing.copied : marketing.postCopyAction}
                        </SmallButton>
                        {run.externalPostUrl && (
                          <SmallButton
                            type="button"
                            onClick={() => window.open(run.externalPostUrl, "_blank", "noopener,noreferrer")}
                          >
                            <LinkIcon width={15} /> {marketing.externalPost}
                          </SmallButton>
                        )}
                      </InlineActions>
                      <div className="grid gap-[5px] rounded-[10px] bg-[#fafafa] p-3">
                        <TrackingLabel>{marketing.trackingUrl}</TrackingLabel>
                        <TrackingValue>{run.trackingUrl}</TrackingValue>
                        <TrackingLabel>{marketing.hiddenPostId}</TrackingLabel>
                        <TrackingValue>{run.hiddenPostId}</TrackingValue>
                        <FieldHint>{marketing.markerHint}</FieldHint>
                      </div>
                    </>
                  )}
                  <InlineActions>
                    <SmallButton
                      type="button"
                      $danger
                      disabled={deletingRunId === run.id}
                      onClick={() => void handleDeleteRun(run.id)}
                    >
                      <TrashIcon width={15} />
                      {deletingRunId === run.id ? marketing.deletingRecord : marketing.deleteRun}
                    </SmallButton>
                  </InlineActions>
                  {date && (
                    <div>
                      <TrackingLabel>{marketing.performance}</TrackingLabel>
                      <dl className="m-0 grid grid-cols-[repeat(6,minmax(0,1fr))] gap-2 max-[860px]:grid-cols-[repeat(3,minmax(0,1fr))] max-[480px]:grid-cols-[repeat(2,minmax(0,1fr))]">
                        <Metric><MetricLabel>{marketing.trackedPosts}</MetricLabel><MetricValue>{run.performance.trackedPosts}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.views}</MetricLabel><MetricValue>{run.performance.impressions}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.clicks}</MetricLabel><MetricValue>{run.performance.clicks}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.ctr}</MetricLabel><MetricValue>{ctr}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.signups}</MetricLabel><MetricValue>{run.performance.signups}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.likes}</MetricLabel><MetricValue>{run.performance.likes}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.comments}</MetricLabel><MetricValue>{run.performance.comments}</MetricValue></Metric>
                      </dl>
                    </div>
                  )}
                </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {hasMoreRuns && (
        <div ref={moreRunsRef} className="flex min-h-[44px] justify-center p-1" aria-live="polite">
          {loadingMoreRuns && <Loading><ArrowPathIcon width={18} /> {marketing.loadingMoreRuns}</Loading>}
        </div>
      )}
    </>
  );
}
