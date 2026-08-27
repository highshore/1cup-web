"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
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
      <ChartCard>
        <ChartHeading><ChartTitle>{title}</ChartTitle></ChartHeading>
        <ChartEmpty>{emptyLabel}</ChartEmpty>
      </ChartCard>
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
    <ChartCard>
      <ChartHeading>
        <ChartTitle>{title}</ChartTitle>
        <ChartValue>{suffix ? `${latest.toFixed(1)}${suffix}` : latest.toLocaleString()}</ChartValue>
      </ChartHeading>
      <ChartSvg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
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
      </ChartSvg>
      <ChartAxis>
        <span>{formatDate(points[0].at)}</span>
        <span>{formatDate(points.at(-1)!.at)}</span>
      </ChartAxis>
    </ChartCard>
  );
};

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

const AnalyticsPanel = styled(FormCard)`
  margin-bottom: 32px;
`;

const AnalyticsHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
`;

const AnalyticsSelect = styled.select`
  min-width: min(100%, 250px);
  min-height: 42px;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  padding: 9px 10px;
  background: #ffffff;
  color: #050505;
  font: inherit;
  font-size: 13px;
  font-weight: 800;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const ChartGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.section`
  min-width: 0;
  border: 1.5px solid #050505;
  border-radius: 12px;
  padding: 14px;
  background: #fcfcfc;
`;

const ChartHeading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
`;

const ChartTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 13px;
  font-weight: 900;
`;

const ChartValue = styled.strong`
  color: #050505;
  font-size: 18px;
  font-weight: 900;
`;

const ChartSvg = styled.svg`
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
`;

const ChartAxis = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  color: rgba(5, 5, 5, 0.56);
  font-size: 11px;
  font-weight: 700;
`;

const ChartEmpty = styled.div`
  display: grid;
  min-height: 142px;
  place-items: center;
  color: rgba(5, 5, 5, 0.56);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
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

const TemplatePickerActions = styled.div`
  display: flex;
  flex-wrap: wrap;
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

const RunTopActions = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
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

const SmallButton = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 5px 9px;
  background: ${({ $danger }) => ($danger ? "#fff1f0" : "#ffffff")};
  color: ${({ $danger }) => ($danger ? "#9d1c10" : "#050505")};
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 900;

  &:hover:not(:disabled) {
    background: ${({ $danger }) => ($danger ? "#fee2e2" : "#fff1e9")};
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

const RunListFooter = styled.div`
  display: flex;
  justify-content: center;
  min-height: 44px;
  padding: 4px;
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
      <AnalyticsPanel>
        <AnalyticsHeader>
          <div>
            <Eyebrow><ChartBarIcon width={15} /> {marketing.performanceAnalytics}</Eyebrow>
            <FormTitle>{marketing.performanceAnalyticsTitle}</FormTitle>
            <Description>{marketing.performanceAnalyticsDescription}</Description>
          </div>
          <CompactField>
            {marketing.performanceTemplateSelect}
            <AnalyticsSelect
              value={selectedPerformanceTemplateId}
              onChange={(event) => setSelectedPerformanceTemplateId(event.target.value)}
            >
              <option value="all">{marketing.allTemplates}</option>
              {performanceTemplateOptions.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </AnalyticsSelect>
          </CompactField>
        </AnalyticsHeader>
        <ChartGrid>
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
        </ChartGrid>
      </AnalyticsPanel>
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
            </TemplatePicker>
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
              {draft.schedule.daysOfWeek.length === 0 && (
                <FieldHint>{marketing.scheduleDisabledWithoutDays}</FieldHint>
              )}
              <RuleList>
                <PanelTitle>{marketing.otherRulesTitle}</PanelTitle>
                <RuleTitle>{marketing.duplicateRuleTitle}</RuleTitle>
                <PanelDescription>{marketing.duplicateRuleDescription}</PanelDescription>
              </RuleList>
            </SchedulePanel>
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
            const isExpanded = expandedRunIds.has(run.id);
            const ctr = run.performance.impressions
              ? `${((run.performance.clicks / run.performance.impressions) * 100).toFixed(1)}%`
              : "—";
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
                  <RunTopActions>
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
                  </RunTopActions>
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
                {isExpanded && (
                <Content id={`marketing-run-${run.id}`}>
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
                      <MetricsGrid>
                        <Metric><MetricLabel>{marketing.trackedPosts}</MetricLabel><MetricValue>{run.performance.trackedPosts}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.views}</MetricLabel><MetricValue>{run.performance.impressions}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.clicks}</MetricLabel><MetricValue>{run.performance.clicks}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.ctr}</MetricLabel><MetricValue>{ctr}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.signups}</MetricLabel><MetricValue>{run.performance.signups}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.likes}</MetricLabel><MetricValue>{run.performance.likes}</MetricValue></Metric>
                        <Metric><MetricLabel>{marketing.comments}</MetricLabel><MetricValue>{run.performance.comments}</MetricValue></Metric>
                      </MetricsGrid>
                    </div>
                  )}
                </Content>
                )}
              </RunCard>
            );
          })}
        </RunList>
      )}
      {hasMoreRuns && (
        <RunListFooter ref={moreRunsRef} aria-live="polite">
          {loadingMoreRuns && <Loading><ArrowPathIcon width={18} /> {marketing.loadingMoreRuns}</Loading>}
        </RunListFooter>
      )}
    </>
  );
}
