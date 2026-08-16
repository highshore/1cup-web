"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  LinkIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";

import { useI18n } from "../../../i18n/I18nProvider";
import {
  createMarketingTemplate,
  deleteMarketingTemplate,
  ensureDefaultMarketingTemplate,
  fetchMarketingCronRuns,
  fetchMarketingCronSettings,
  fetchMarketingTemplates,
  runMarketingCronNow,
  saveMarketingCronSettings,
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
  templateAssignments: Record<string, string>;
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
  templateAssignments: settings.templateAssignments,
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

const FormCard = styled.section`
  background: #ffffff;
  border: 3px solid #050505;
  border-radius: 16px;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  padding: 24px;

  @media (max-width: 620px) {
    padding: 18px;
    box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  }
`;

const FormHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;

  @media (max-width: 620px) {
    margin-bottom: 18px;
  }
`;

const Eyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #050505;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const FormTitle = styled.h2`
  margin: 4px 0 6px;
  color: #050505;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.2;
`;

const Description = styled.p`
  max-width: 720px;
  margin: 0;
  color: rgba(5, 5, 5, 0.64);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.55;
`;

const ScheduleState = styled.div<{ $enabled: boolean }>`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 7px 10px;
  background: ${({ $enabled }) => ($enabled ? "#dff6df" : "#f5f5f5")};
  color: #050505;
  font-size: 12px;
  font-weight: 900;

  @media (max-width: 620px) {
    display: none;
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 16px;

  @media (max-width: 740px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label<{ $full?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 7px;
  grid-column: ${({ $full }) => ($full ? "1 / -1" : "auto")};
  color: #050505;
  font-size: 13px;
  font-weight: 900;
`;

const FieldHint = styled.span`
  color: rgba(5, 5, 5, 0.56);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
`;

const Input = styled.input`
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  padding: 10px 11px;
  background: #ffffff;
  color: #050505;
  font: inherit;
  font-size: 14px;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const Select = styled.select`
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  padding: 10px 11px;
  background: #ffffff;
  color: #050505;
  font: inherit;
  font-size: 14px;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 145px;
  box-sizing: border-box;
  resize: vertical;
  border: 2px solid #050505;
  border-radius: 10px;
  padding: 11px;
  background: #ffffff;
  color: #050505;
  font: inherit;
  font-size: 14px;
  line-height: 1.55;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const TemplatePicker = styled.div`
  display: grid;
  grid-column: 1 / -1;
  gap: 8px;
`;

const PanelTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 14px;
  font-weight: 900;
`;

const PanelDescription = styled.p`
  margin: 4px 0 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
`;

const TemplateSaveRow = styled.div`
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
`;

const CompactField = styled.label`
  display: grid;
  gap: 6px;
  color: #050505;
  font-size: 12px;
  font-weight: 900;
`;

const SchedulePanel = styled.div`
  display: grid;
  gap: 14px;
  grid-column: 1 / -1;
  padding-bottom: 20px;
  border-bottom: 1.5px solid rgba(5, 5, 5, 0.22);
`;

const RuleList = styled.div`
  display: grid;
  gap: 5px;
`;

const RuleTitle = styled.strong`
  color: #050505;
  font-size: 12px;
  font-weight: 900;
`;

const ScheduleHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const ScheduleGrid = styled.div`
  display: grid;
  grid-template-columns: 120px 120px minmax(0, 1fr);
  gap: 12px;

  @media (max-width: 740px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const DayField = styled.div`
  display: grid;
  gap: 7px;

  @media (max-width: 740px) {
    grid-column: 1 / -1;
  }
`;

const DayList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const DayButton = styled.button<{ $active: boolean }>`
  min-width: 32px;
  min-height: 32px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 4px 8px;
  background: ${({ $active }) => ($active ? "#f47a4a" : "#ffffff")};
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const AssignmentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;

  @media (max-width: 740px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 460px) {
    grid-template-columns: 1fr;
  }
`;

const PhotoSection = styled.div`
  display: grid;
  grid-column: 1 / -1;
  gap: 10px;
`;

const HiddenPhotoInput = styled.input`
  display: none;
`;

const PhotoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
`;

const PhotoCard = styled.div`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 8px;
  border: 1.5px solid rgba(5, 5, 5, 0.4);
  border-radius: 10px;
`;

const PhotoPreview = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  background: #f5f5f5;
`;

const PhotoDetails = styled.div`
  min-width: 0;
  display: grid;
  gap: 6px;
`;

const PhotoActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const RunPhotoStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const RunPhoto = styled.img`
  width: 88px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  background: #f5f5f5;
`;

const SwitchRow = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  width: fit-content;
  color: #050505;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
`;

const Switch = styled.input`
  appearance: none;
  position: relative;
  width: 42px;
  height: 24px;
  margin: 0;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #d9d9d9;
  cursor: pointer;
  transition: background 0.16s ease;

  &::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border: 1.5px solid #050505;
    border-radius: 50%;
    background: #ffffff;
    transition: transform 0.16s ease;
  }

  &:checked {
    background: #f47a4a;
  }

  &:checked::after {
    transform: translateX(17px);
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
`;

const Button = styled.button<{ $secondary?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 7px 13px;
  background: ${({ $secondary }) => ($secondary ? "#ffffff" : "#f47a4a")};
  color: #050505;
  box-shadow: 3px 3px 0 #050505;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #050505;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.58;
    box-shadow: none;
  }
`;

const Message = styled.span<{ $error?: boolean }>`
  color: ${({ $error }) => ($error ? "#ae260f" : "#17693a")};
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 32px 0 14px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 20px;
  font-weight: 900;
`;

const Count = styled.span`
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 5px 9px;
  color: #050505;
  font-size: 12px;
  font-weight: 900;
`;

const RunList = styled.div`
  display: grid;
  gap: 16px;
`;

const RunCard = styled.article`
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
`;

const RunTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 14px;
`;

const RunLabel = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 7px;
`;

const ChannelTag = styled.span`
  border-radius: 999px;
  padding: 4px 8px;
  background: #f47a4a;
  color: #050505;
  font-size: 11px;
  font-weight: 900;
`;

const TriggerTag = styled.span`
  color: rgba(5, 5, 5, 0.58);
  font-size: 12px;
  font-weight: 800;
`;

const RunTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.32;
`;

const Status = styled.span<{ $status: MarketingRunStatus }>`
  flex: 0 0 auto;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 6px 9px;
  background: ${({ $status }) => {
    if ($status === "completed") return "#dff6df";
    if ($status === "failed") return "#fee2e2";
    if ($status === "skipped") return "#f5f5f5";
    if ($status === "awaitingPublisher") return "#fff0c2";
    return "#eef2ff";
  }};
  color: #050505;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
`;

const RunMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px 16px;
  padding: 0 18px 15px;
  color: rgba(5, 5, 5, 0.6);
  font-size: 12px;
  font-weight: 700;
`;

const Content = styled.div`
  display: grid;
  gap: 16px;
  border-top: 1px solid rgba(5, 5, 5, 0.16);
  padding: 17px 18px 18px;
`;

const CopyPreview = styled.p`
  margin: 0;
  white-space: pre-wrap;
  color: #252525;
  font-size: 14px;
  line-height: 1.6;
`;

const InlineActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 5px 9px;
  background: #ffffff;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;

  &:hover:not(:disabled) {
    background: #fff1e9;
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

const ModalBackdrop = styled.div`
  position: fixed;
  z-index: 70;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(5, 5, 5, 0.45);
`;

const ModalCard = styled.div`
  display: grid;
  width: min(100%, 430px);
  gap: 14px;
  border: 2px solid #050505;
  border-radius: 16px;
  padding: 20px;
  background: #ffffff;
  box-shadow: 6px 6px 0 #050505;
`;

const ModalActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 9px;
`;

const Tracking = styled.div`
  display: grid;
  gap: 5px;
  padding: 12px;
  border-radius: 10px;
  background: #fafafa;
`;

const TrackingLabel = styled.span`
  color: rgba(5, 5, 5, 0.56);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
`;

const TrackingValue = styled.span`
  overflow-wrap: anywhere;
  color: #050505;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 700;
`;

const Notice = styled.div<{ $error?: boolean }>`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  border: 1.5px solid ${({ $error }) => ($error ? "#c0341d" : "#c68400")};
  border-radius: 10px;
  padding: 10px 11px;
  background: ${({ $error }) => ($error ? "#fff1f0" : "#fff9df")};
  color: #4a2600;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
`;

const MetricsGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin: 0;

  @media (max-width: 860px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 480px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Metric = styled.div`
  min-width: 0;
  border-radius: 10px;
  padding: 10px;
  background: #fafafa;
`;

const MetricLabel = styled.dt`
  overflow: hidden;
  color: rgba(5, 5, 5, 0.55);
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MetricValue = styled.dd`
  margin: 4px 0 0;
  color: #050505;
  font-size: 17px;
  font-weight: 900;
`;

const Empty = styled.div`
  border: 2px dashed rgba(5, 5, 5, 0.48);
  border-radius: 16px;
  padding: 36px 20px;
  color: rgba(5, 5, 5, 0.64);
  font-size: 14px;
  font-weight: 700;
  text-align: center;
`;

const Loading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 180px;
  color: rgba(5, 5, 5, 0.66);
  font-size: 14px;
  font-weight: 800;
`;

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
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      let defaultTemplateId = "";
      try {
        defaultTemplateId = await ensureDefaultMarketingTemplate();
      } catch (error) {
        console.error("Unable to ensure the default Gopas template:", error);
      }
      const [settings, nextRuns, nextTemplates] = await Promise.all([
        fetchMarketingCronSettings(),
        fetchMarketingCronRuns(),
        fetchMarketingTemplates(),
      ]);
      if (!mounted) return;
      const initialTemplateId = settings.templateId || defaultTemplateId;
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
            }
          : toDraft(settings)
      );
      setRuns(nextRuns);
      setTemplates(nextTemplates);
      setLoading(false);
    };

    void load();
    const unsubscribe = subscribeToMarketingCronRuns((nextRuns) => {
      if (mounted) {
        setRuns(nextRuns);
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

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }),
    [locale]
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
          }
        : { ...current, templateId: "" }
    );
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

  const updateTemplateAssignment = (day: number, templateId: string) =>
    setDraft((current) => ({
      ...current,
      templateAssignments: {
        ...current.templateAssignments,
        [String(day)]: templateId,
      },
    }));

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
      await saveMarketingCronSettings({
        enabled: draft.enabled,
        schedule: draft.schedule,
        templateId: draft.templateId,
        templateAssignments: draft.templateAssignments,
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
      });
      setTemplateName("");
      setTemplateDialogOpen(false);
      const nextTemplates = await fetchMarketingTemplates();
      setTemplates(nextTemplates);
      updateDraft("templateId", templateId);
      setMessage({ text: marketing.templateSaved });
    } catch (error) {
      console.error("Unable to create marketing template:", error);
      setMessage({ text: marketing.templateError, error: true });
    } finally {
      setSavingTemplate(false);
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

  const handleRunNow = async () => {
    setRunningNow(true);
    setMessage(null);
    try {
      await runMarketingCronNow();
      const nextRuns = await fetchMarketingCronRuns();
      setRuns(nextRuns);
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
      await copyText(`${run.postCopy}\n\n${run.trackingUrl}${invisibleMarker}`);
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
  const hasAssignmentsForSchedule = draft.schedule.daysOfWeek.every((day) =>
    Boolean(draft.templateAssignments[String(day)])
  );
  const scheduleHasDays = draft.schedule.daysOfWeek.length > 0;
  const canSaveSchedule =
    Boolean(draft.templateId) && !isTemplateDirty && hasAssignmentsForSchedule;

  return (
    <>
      <FormCard>
        <FormHeading>
          <div>
            <Eyebrow><CalendarDaysIcon width={15} /> {marketing.koreapas}</Eyebrow>
            <FormTitle>{marketing.settingsTitle}</FormTitle>
            <Description>{marketing.settingsDescription}</Description>
          </div>
          <ScheduleState $enabled={draft.enabled && scheduleHasDays}>
            <CheckIcon width={14} /> {draft.enabled && scheduleHasDays ? marketing.enabled : marketing.scheduleDisabled}
          </ScheduleState>
        </FormHeading>

        <form onSubmit={handleSave}>
          <FormGrid>
            <SchedulePanel>
              <ScheduleHeading>
                <div>
                  <PanelTitle>{marketing.scheduleTitle}</PanelTitle>
                  <PanelDescription>{marketing.scheduleDescription}</PanelDescription>
                </div>
              </ScheduleHeading>
              <ScheduleGrid>
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
                <DayField>
                  <CompactField as="span">{marketing.scheduleWeekdays}</CompactField>
                  <DayList>
                    {weekdays.map((weekday, day) => (
                      <DayButton
                        key={weekday}
                        type="button"
                        $active={draft.schedule.daysOfWeek.includes(day)}
                        onClick={() => toggleWeekday(day)}
                        aria-pressed={draft.schedule.daysOfWeek.includes(day)}
                      >
                        {weekday}
                      </DayButton>
                    ))}
                  </DayList>
                </DayField>
              </ScheduleGrid>
              <div>
                <PanelTitle>{marketing.templateAssignments}</PanelTitle>
                <PanelDescription>{marketing.templateAssignmentsDescription}</PanelDescription>
              </div>
              <AssignmentGrid>
                {draft.schedule.daysOfWeek.map((day) => (
                  <CompactField key={day}>
                    {weekdays[day]}
                    <Select
                      value={draft.templateAssignments[String(day)] || ""}
                      onChange={(event) => updateTemplateAssignment(day, event.target.value)}
                    >
                      <option value="">{marketing.assignTemplatePlaceholder}</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </Select>
                  </CompactField>
                ))}
              </AssignmentGrid>
              {draft.schedule.daysOfWeek.length === 0 && (
                <FieldHint>{marketing.scheduleDisabledWithoutDays}</FieldHint>
              )}
              {!hasAssignmentsForSchedule && (
                <FieldHint>{marketing.assignTemplatesHint}</FieldHint>
              )}
              <RuleList>
                <PanelTitle>{marketing.otherRulesTitle}</PanelTitle>
                <RuleTitle>{marketing.duplicateRuleTitle}</RuleTitle>
                <PanelDescription>{marketing.duplicateRuleDescription}</PanelDescription>
              </RuleList>
            </SchedulePanel>
            <TemplatePicker>
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
            </TemplatePicker>
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
            <PhotoSection>
              <div>
                <PanelTitle>{marketing.photosTitle}</PanelTitle>
                <PanelDescription>{marketing.photosDescription}</PanelDescription>
              </div>
              <HiddenPhotoInput
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
                <PhotoGrid>
                  {draft.photos.map((photo, index) => (
                    <PhotoCard key={`${photo.url}_${index}`}>
                      <PhotoPreview src={photo.url} alt={photo.alt || marketing.photoDefaultAlt} />
                      <PhotoDetails>
                        <Input
                          aria-label={marketing.photoAlt}
                          value={photo.alt}
                          maxLength={180}
                          placeholder={marketing.photoAltPlaceholder}
                          onChange={(event) => updatePhotoAlt(index, event.target.value)}
                        />
                        <PhotoActions>
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
                        </PhotoActions>
                      </PhotoDetails>
                    </PhotoCard>
                  ))}
                </PhotoGrid>
              )}
            </PhotoSection>
            <TemplateSaveRow>
              {isTemplateDirty && hasTemplateContent && (
                <SmallButton
                  type="button"
                  disabled={savingTemplate}
                  onClick={() => setTemplateDialogOpen(true)}
                >
                  <CheckIcon width={14} />
                  {marketing.saveTemplateChanges}
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
            </TemplateSaveRow>
          </FormGrid>

          <ActionRow>
            <SwitchRow>
              <Switch
                type="checkbox"
                checked={draft.enabled && scheduleHasDays}
                disabled={!scheduleHasDays}
                onChange={(event) => updateDraft("enabled", event.target.checked)}
              />
              {marketing.enabled}
            </SwitchRow>
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
          </ActionRow>
        </form>
      </FormCard>

      {templateDialogOpen && (
        <ModalBackdrop role="presentation" onMouseDown={() => setTemplateDialogOpen(false)}>
          <ModalCard
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
            <ModalActions>
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
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}

      <SectionHeader>
        <SectionTitle>{marketing.runsTitle}</SectionTitle>
        <Count>{marketing.runs.replace("{count}", String(runs.length))}</Count>
      </SectionHeader>

      {loading ? (
        <Loading><ArrowPathIcon width={19} /> {marketing.loading}</Loading>
      ) : runs.length === 0 ? (
        <Empty>{marketing.noRuns}</Empty>
      ) : (
        <RunList>
          {runs.map((run) => {
            const date = run.completedAt || run.startedAt || run.scheduledFor;
            const displayTitle = run.postTitle || marketing.koreapas;
            return (
              <RunCard key={run.id}>
                <RunTop>
                  <div>
                    <RunLabel>
                      <ChannelTag>{marketing.koreapas}</ChannelTag>
                      <TriggerTag>
                        {run.trigger === "manual" ? marketing.triggerManual : marketing.triggerScheduled}
                      </TriggerTag>
                    </RunLabel>
                    <RunTitle>{displayTitle}</RunTitle>
                  </div>
                  <Status $status={run.status}>{getStatusLabel(run.status)}</Status>
                </RunTop>
                <RunMeta>
                  <span>{formatTemplate(marketing.scheduledFor, dateLabel(run.scheduledFor))}</span>
                  {run.completedAt && (
                    <span>{formatTemplate(marketing.completed, dateLabel(run.completedAt))}</span>
                  )}
                  {!run.completedAt && run.startedAt && (
                    <span>{formatTemplate(marketing.started, dateLabel(run.startedAt))}</span>
                  )}
                </RunMeta>
                <Content>
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
                    <RunPhotoStrip>
                      {run.photos.map((photo, index) => (
                        <RunPhoto
                          key={`${photo.url}_${index}`}
                          src={photo.url}
                          alt={photo.alt || marketing.photoDefaultAlt}
                        />
                      ))}
                    </RunPhotoStrip>
                  )}
                  {run.postCopy && <CopyPreview>{run.postCopy}</CopyPreview>}
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
                      <Tracking>
                        <TrackingLabel>{marketing.trackingUrl}</TrackingLabel>
                        <TrackingValue>{run.trackingUrl}</TrackingValue>
                        <TrackingLabel>{marketing.hiddenPostId}</TrackingLabel>
                        <TrackingValue>{run.hiddenPostId}</TrackingValue>
                        <FieldHint>{marketing.markerHint}</FieldHint>
                      </Tracking>
                    </>
                  )}
                  {date && (
                    <div>
                      <TrackingLabel>{marketing.performance}</TrackingLabel>
                      <MetricsGrid>
                        <Metric><MetricLabel>{marketing.trackedPosts}</MetricLabel><MetricValue>{run.performance.trackedPosts}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.impressions}</MetricLabel><MetricValue>{run.performance.impressions}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.clicks}</MetricLabel><MetricValue>{run.performance.clicks}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.signups}</MetricLabel><MetricValue>{run.performance.signups}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.likes}</MetricLabel><MetricValue>{run.performance.likes}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.comments}</MetricLabel><MetricValue>{run.performance.comments}</MetricValue></Metric>
                      </MetricsGrid>
                    </div>
                  )}
                </Content>
              </RunCard>
            );
          })}
        </RunList>
      )}
    </>
  );
}
