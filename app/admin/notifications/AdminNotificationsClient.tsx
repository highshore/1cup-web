"use client";

import { BellAlertIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  createNotificationTemplateClient,
  deleteNotificationTemplateClient,
  getAdminNotificationsClient,
  saveNotificationTemplateScheduleClient,
  sendAdminNotificationClient,
} from "../../lib/features/notifications/services/admin_notification_client";
import type {
  AdminNotificationCampaign,
  AdminNotificationRecipient,
  AdminNotificationsData,
  AdminNotificationTemplate,
  NotificationAudience,
  NotificationTemplateSchedule,
} from "../../lib/features/notifications/types";

type DivProps = HTMLAttributes<HTMLDivElement>;
type SectionProps = HTMLAttributes<HTMLElement>;
type SpanProps = HTMLAttributes<HTMLSpanElement>;
type ParagraphProps = HTMLAttributes<HTMLParagraphElement>;
type HeadingProps = HTMLAttributes<HTMLHeadingElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
type InputProps = InputHTMLAttributes<HTMLInputElement>;

function Page({ className = "", ...rest }: SectionProps) {
  return (
    <main
      {...rest}
      className={`w-[min(1400px,calc(100%-2.5rem))] mx-auto pb-10 ${className}`}
    />
  );
}

function Heading({ className = "", ...rest }: SectionProps) {
  return <header {...rest} className={`mx-0 mt-0 mb-[1.35rem] ${className}`} />;
}

function Eyebrow({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`inline-flex items-center gap-[0.4rem] mx-0 mt-0 mb-[0.48rem] text-[#050505] text-[0.76rem] font-black tracking-[0.075em] uppercase [&_svg]:w-4 [&_svg]:h-4 ${className}`}
    />
  );
}

function Title({ className = "", ...rest }: HeadingProps) {
  return (
    <h1
      {...rest}
      className={`m-0 text-[#050505] text-[clamp(1.75rem,4vw,2.2rem)] font-black tracking-[-0.025em] ${className}`}
    />
  );
}

function Description({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`max-w-[680px] mx-0 mt-[0.62rem] mb-0 text-[rgba(5,5,5,0.64)] text-[0.88rem] font-semibold leading-[1.55] ${className}`}
    />
  );
}

function Layout({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[minmax(0,1.34fr)_minmax(300px,0.66fr)] items-start gap-5 max-[850px]:grid-cols-1 ${className}`}
    />
  );
}

function Card({ className = "", ...rest }: SectionProps) {
  return (
    <section
      {...rest}
      className={`overflow-hidden border-[3px] border-[#050505] rounded-[16px] bg-white shadow-[6px_6px_0_rgba(5,5,5,0.9)] ${className}`}
    />
  );
}

function CardHeader({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`px-[1.35rem] pt-[1.35rem] ${className}`} />;
}

function CardTitle({ className = "", ...rest }: HeadingProps) {
  return <h2 {...rest} className={`m-0 text-[#050505] text-[1rem] font-black ${className}`} />;
}

function CardDescription({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-[0.38rem] mb-0 text-[rgba(5,5,5,0.6)] text-[0.78rem] font-semibold leading-[1.5] ${className}`}
    />
  );
}

function CardBody({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`px-[1.35rem] pt-[1.15rem] pb-[1.35rem] ${className}`} />;
}

function Field({
  as: As = "label",
  className = "",
  ...rest
}: { as?: "div" | "label" } & LabelHTMLAttributes<HTMLElement>) {
  return (
    <As
      {...rest}
      className={`grid gap-[0.42rem] mt-4 text-[#050505] text-[0.8rem] font-black ${className}`}
    />
  );
}

const controlClasses =
  "w-full min-h-[42px] box-border border-2 border-[#050505] rounded-[10px] bg-white px-[0.72rem] py-[0.62rem] text-[#050505] text-[0.88rem] focus:outline-solid focus:outline-[3px] focus:outline-[#f47a4a]";

function Input({ className = "", ...rest }: InputProps) {
  return <input {...rest} className={`${controlClasses} ${className}`} />;
}

function Select({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={`${controlClasses} ${className}`} />;
}

function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full min-h-[126px] box-border resize-y border-2 border-[#050505] rounded-[10px] bg-white px-[0.72rem] py-[0.68rem] text-[#050505] text-[0.88rem] leading-[1.5] focus:outline-solid focus:outline-[3px] focus:outline-[#f47a4a] ${className}`}
    />
  );
}

function FieldHint({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-[-0.08rem] mb-0 text-[rgba(5,5,5,0.56)] text-[0.71rem] font-semibold ${className}`}
    />
  );
}

function TemplateBar({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-[0.62rem] items-end max-[560px]:grid-cols-1 ${className}`}
    />
  );
}

function QuietButton({ className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`min-h-[42px] border-2 border-[#050505] rounded-[10px] bg-white px-[0.7rem] py-[0.58rem] shadow-[2px_2px_0_#050505] text-[#050505] cursor-pointer text-[0.77rem] font-black [&:hover:not(:disabled)]:[transform:translate(-1px,-1px)] [&:hover:not(:disabled)]:bg-[#fff1ea] [&:hover:not(:disabled)]:shadow-[3px_3px_0_#050505] disabled:cursor-not-allowed disabled:opacity-[0.55] ${className}`}
    />
  );
}

function SchedulePanel({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`mt-4 border-[1.5px] border-[#050505] rounded-[12px] bg-[#fff8f4] p-[0.82rem] ${className}`}
    />
  );
}

function ScheduleHeader({ className = "", ...rest }: DivProps) {
  return (
    <div {...rest} className={`flex items-center justify-between gap-[0.7rem] ${className}`} />
  );
}

function ScheduleTitle({ className = "", ...rest }: HeadingProps) {
  return <h3 {...rest} className={`m-0 text-[#050505] text-[0.82rem] font-black ${className}`} />;
}

function SwitchLabel({ className = "", ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...rest}
      className={`inline-flex items-center gap-[0.42rem] text-[#050505] text-[0.74rem] font-black whitespace-nowrap [&_input]:w-4 [&_input]:h-4 [&_input]:accent-[#f47a4a] ${className}`}
    />
  );
}

function ScheduleFields({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[1fr_1fr] gap-[0.62rem] mt-[0.68rem] ${className}`}
    />
  );
}

function WeekdayRow({ className = "", ...rest }: DivProps) {
  return (
    <div {...rest} className={`grid grid-cols-7 gap-[0.28rem] mt-[0.68rem] ${className}`} />
  );
}

function WeekdayButton({
  $active,
  className = "",
  ...rest
}: { $active: boolean } & ButtonProps) {
  return (
    <button
      {...rest}
      className={`min-h-[31px] border-[1.5px] border-[#050505] rounded-[7px] text-[#050505] cursor-pointer text-[0.67rem] font-black ${
        $active ? "bg-[#f47a4a]" : "bg-white"
      } ${className}`}
    />
  );
}

function ScheduleActions({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`flex gap-2 mt-[0.72rem] ${className}`} />;
}

function AudienceGrid({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-3 gap-[0.55rem] mt-[0.58rem] max-[600px]:grid-cols-1 ${className}`}
    />
  );
}

function AudienceOption({
  $selected,
  className = "",
  ...rest
}: { $selected: boolean } & ButtonProps) {
  return (
    <button
      {...rest}
      className={`min-h-[88px] border-2 border-[#050505] rounded-[12px] p-[0.68rem] text-[#050505] cursor-pointer text-left hover:bg-[#fff8f4] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2 ${
        $selected ? "bg-[#fff1ea] shadow-[3px_3px_0_#f47a4a]" : "bg-white shadow-none"
      } ${className}`}
    />
  );
}

function AudienceName({ className = "", ...rest }: SpanProps) {
  return <span {...rest} className={`block text-[0.8rem] font-black ${className}`} />;
}

function AudienceCount({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`block mt-1 text-[rgba(5,5,5,0.58)] text-[0.72rem] font-bold ${className}`}
    />
  );
}

function TwoColumns({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[540px]:grid-cols-1 ${className}`}
    />
  );
}

function MemberPicker({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`mt-[0.85rem] overflow-hidden border-[1.5px] border-[#050505] rounded-[12px] ${className}`}
    />
  );
}

function SearchWrap({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`relative border-b-[1.5px] border-[#050505] [&_svg]:absolute [&_svg]:top-1/2 [&_svg]:left-[0.7rem] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:translate-y-[-50%] [&_svg]:text-[rgba(5,5,5,0.52)] ${className}`}
    />
  );
}

function SearchInput({ className = "", ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={`w-full min-h-[42px] box-border border-0 rounded-none bg-white py-[0.62rem] pr-[0.72rem] pl-[2.1rem] text-[#050505] text-[0.88rem] focus:outline-none ${className}`}
    />
  );
}

function RecipientList({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`max-h-[235px] overflow-y-auto ${className}`} />;
}

function RecipientRow({ className = "", ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...rest}
      className={`flex items-center gap-[0.7rem] min-h-[48px] border-b border-[rgba(5,5,5,0.14)] px-[0.72rem] py-[0.55rem] cursor-pointer last:border-b-0 hover:bg-[#fff8f4] [&_input]:w-4 [&_input]:h-4 [&_input]:accent-[#f47a4a] ${className}`}
    />
  );
}

function Avatar({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`grid w-7 h-7 flex-none place-items-center overflow-hidden rounded-full bg-[#f47a4a] text-[#050505] text-[0.7rem] font-[850] [&_img]:w-full [&_img]:h-full [&_img]:object-cover ${className}`}
    />
  );
}

function RecipientName({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`min-w-0 overflow-hidden text-[#050505] text-[0.81rem] font-extrabold text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function EmptyMembers({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`m-0 px-3 py-5 text-[rgba(5,5,5,0.54)] text-[0.8rem] text-center ${className}`}
    />
  );
}

function Preview({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`mt-4 border-2 border-dashed border-[#050505] rounded-[12px] bg-[#fff1ea] p-[0.85rem] ${className}`}
    />
  );
}

function PreviewLabel({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-0 mb-[0.44rem] text-[#050505] text-[0.7rem] font-black tracking-[0.05em] uppercase ${className}`}
    />
  );
}

function PreviewTitle({ className = "", ...rest }: HeadingProps) {
  return <h3 {...rest} className={`m-0 text-[#050505] text-[0.86rem] font-black ${className}`} />;
}

function PreviewBody({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-[0.28rem] mb-0 text-[rgba(5,5,5,0.72)] text-[0.81rem] leading-[1.5] whitespace-pre-wrap ${className}`}
    />
  );
}

function PreviewAction({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`inline-flex mt-[0.55rem] border-[1.5px] border-[#050505] rounded-[7px] bg-[#f47a4a] px-[0.46rem] py-[0.3rem] text-[#050505] text-[0.71rem] font-[850] ${className}`}
    />
  );
}

function SubmitRow({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex items-center justify-between gap-[0.8rem] mt-[1.1rem] ${className}`}
    />
  );
}

function SendButton({ className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`min-h-[42px] border-2 border-[#050505] rounded-[10px] bg-[#f47a4a] px-[0.9rem] py-[0.66rem] shadow-[3px_3px_0_#050505] text-[#050505] cursor-pointer text-[0.82rem] font-black [&:hover:not(:disabled)]:[transform:translate(-1px,-1px)] [&:hover:not(:disabled)]:bg-[#f88d63] [&:hover:not(:disabled)]:shadow-[4px_4px_0_#050505] disabled:cursor-not-allowed disabled:opacity-[0.55] disabled:shadow-none ${className}`}
    />
  );
}

function InlineStatus({
  $error,
  className = "",
  ...rest
}: { $error?: boolean } & ParagraphProps) {
  return (
    <p
      {...rest}
      className={`m-0 text-[0.78rem] font-extrabold leading-[1.4] ${
        $error ? "text-[#991b1b]" : "text-[#0f6b32]"
      } ${className}`}
    />
  );
}

function DeliveryNote({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`m-0 px-[1.2rem] py-[0.82rem] border-t-2 border-[#050505] bg-[#fff8f4] text-[rgba(5,5,5,0.6)] text-[0.74rem] font-semibold leading-[1.45] ${className}`}
    />
  );
}

function HistoryList({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`grid gap-[0.72rem] ${className}`} />;
}

function HistoryItem({ className = "", ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      {...rest}
      className={`border-[1.5px] border-[#050505] rounded-[12px] bg-white p-[0.85rem] ${className}`}
    />
  );
}

function HistoryTitle({ className = "", ...rest }: HeadingProps) {
  return <h3 {...rest} className={`m-0 text-[#050505] text-[0.86rem] font-black ${className}`} />;
}

function HistoryBody({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`line-clamp-3 mx-0 mt-[0.3rem] mb-0 text-[rgba(5,5,5,0.62)] text-[0.78rem] leading-[1.45] ${className}`}
    />
  );
}

function HistoryMeta({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-[0.58rem] mb-0 text-[rgba(5,5,5,0.52)] text-[0.69rem] font-bold ${className}`}
    />
  );
}

function LoadingState({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid min-h-[260px] place-items-center text-[rgba(5,5,5,0.6)] text-[0.88rem] font-extrabold ${className}`}
    />
  );
}

function displayName(recipient: AdminNotificationRecipient, fallback: string): string {
  return recipient.displayName?.trim() || fallback;
}

function initials(value: string): string {
  return value.slice(0, 1).toUpperCase() || "1";
}

export default function AdminNotificationsClient() {
  const { t, locale } = useI18n();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const copy = t.admin.notifications;

  const [data, setData] = useState<AdminNotificationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audience, setAudience] = useState<NotificationAudience>("all_members");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateScheduleEnabled, setTemplateScheduleEnabled] = useState(false);
  const [templateSchedule, setTemplateSchedule] = useState<NotificationTemplateSchedule>({
    hour: 19,
    minute: 0,
    daysOfWeek: [],
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setData(await getAdminNotificationsClient(copy.loadError));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : copy.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }
    void load();
  }, [accountStatus, authLoading, currentUser, load, router]);

  const recipients = useMemo(() => data?.recipients ?? [], [data]);
  const templates = data?.templates ?? [];
  const activeMemberCount = useMemo(
    () =>
      recipients.filter(
        (recipient) =>
          recipient.accountStatus !== "admin" && recipient.hasActiveSubscription,
      ).length,
    [recipients],
  );
  const allMemberCount = useMemo(
    () => recipients.filter((recipient) => recipient.accountStatus !== "admin").length,
    [recipients],
  );
  const matchingRecipients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) =>
      `${recipient.displayName ?? ""} ${recipient.id}`.toLocaleLowerCase().includes(query),
    );
  }, [recipients, search]);

  const recipientCount =
    audience === "all_members"
      ? allMemberCount
      : audience === "active_subscribers"
        ? activeMemberCount
        : selectedIds.length;

  const audienceOptions: Array<{
    id: NotificationAudience;
    label: string;
    count: number;
  }> = [
    { id: "all_members", label: copy.allMembers, count: allMemberCount },
    { id: "active_subscribers", label: copy.activeSubscribers, count: activeMemberCount },
    { id: "selected_members", label: copy.selectedMembers, count: selectedIds.length },
  ];

  const toggleRecipient = (recipientId: string) => {
    setSelectedIds((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId],
    );
  };

  const selectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((candidate) => candidate.id === templateId);
    if (!template) return;
    setAudience(template.audience);
    setSelectedIds(template.recipientIds);
    setTitle(template.title);
    setBody(template.body);
    setActionLabel(template.actionLabel ?? "");
    setActionUrl(template.actionUrl ?? "");
    setTemplateScheduleEnabled(template.scheduleEnabled);
    setTemplateSchedule(template.schedule);
  };

  const toggleWeekday = (day: number) => {
    setTemplateSchedule((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day].sort((a, b) => a - b),
    }));
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    if (!name || !title.trim() || !body.trim() || (audience === "selected_members" && selectedIds.length === 0)) {
      setSendError(copy.templateRequired);
      return;
    }
    setIsSavingTemplate(true);
    setSendError(null);
    try {
      const templateId = await createNotificationTemplateClient(
        {
          name,
          audience,
          recipientIds: selectedIds,
          title,
          body,
          actionLabel: actionLabel.trim() || null,
          actionUrl: actionUrl.trim() || null,
          scheduleEnabled: templateScheduleEnabled,
          schedule: templateSchedule,
        },
        copy.templateError,
      );
      setTemplateName("");
      setSelectedTemplateId(templateId);
      setSendSuccess(copy.templateSaved);
      await load();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : copy.templateError);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const saveTemplateSchedule = async () => {
    if (!selectedTemplateId) {
      setSendError(copy.selectTemplateFirst);
      return;
    }
    setIsSavingTemplate(true);
    setSendError(null);
    try {
      await saveNotificationTemplateScheduleClient(
        {
          templateId: selectedTemplateId,
          scheduleEnabled: templateScheduleEnabled,
          schedule: templateSchedule,
        },
        copy.scheduleError,
      );
      setSendSuccess(copy.scheduleSaved);
      await load();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : copy.scheduleError);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplateId || !window.confirm(copy.deleteTemplateConfirm)) return;
    setIsSavingTemplate(true);
    setSendError(null);
    try {
      await deleteNotificationTemplateClient(selectedTemplateId, copy.templateError);
      setSelectedTemplateId("");
      setTemplateScheduleEnabled(false);
      setTemplateSchedule({ hour: 19, minute: 0, daysOfWeek: [] });
      await load();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : copy.templateError);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const submit = async () => {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    const normalizedActionLabel = actionLabel.trim();
    const normalizedActionUrl = actionUrl.trim();
    setSendError(null);
    setSendSuccess(null);

    if (!normalizedTitle || !normalizedBody || recipientCount === 0) {
      setSendError(copy.requiredFields);
      return;
    }
    if (normalizedTitle.length > 120 || normalizedBody.length > 4000) {
      setSendError(copy.lengthError);
      return;
    }
    if (
      Boolean(normalizedActionLabel) !== Boolean(normalizedActionUrl) ||
      (normalizedActionUrl &&
        (!normalizedActionUrl.startsWith("/") || normalizedActionUrl.startsWith("//")))
    ) {
      setSendError(copy.actionError);
      return;
    }

    if (!window.confirm(copy.sendConfirm.replace("{count}", String(recipientCount)))) return;

    setIsSending(true);
    try {
      const result = await sendAdminNotificationClient(
        {
          audience,
          recipientIds: audience === "selected_members" ? selectedIds : [],
          title: normalizedTitle,
          body: normalizedBody,
          actionLabel: normalizedActionLabel || null,
          actionUrl: normalizedActionUrl || null,
        },
        copy.sendError,
      );
      if (typeof result.deliveredCount !== "number") throw new Error(copy.sendError);

      setTitle("");
      setBody("");
      setActionLabel("");
      setActionUrl("");
      setSelectedIds([]);
      setSendSuccess(copy.sent.replace("{count}", String(result.deliveredCount)));
      await load();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : copy.sendError);
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  if (authLoading || (!data && isLoading && !loadError)) {
    return <LoadingState>{copy.loading}</LoadingState>;
  }

  if (!currentUser || accountStatus !== "admin") {
    return <LoadingState>{copy.loading}</LoadingState>;
  }

  return (
    <Page>
      <Heading>
        <Eyebrow>
          <BellAlertIcon />
          {copy.eyebrow}
        </Eyebrow>
        <Title>{copy.pageTitle}</Title>
        <Description>{copy.pageDescription}</Description>
      </Heading>

      {loadError ? (
        <Card>
          <CardBody>
            <InlineStatus $error>{loadError}</InlineStatus>
            <SendButton type="button" onClick={() => void load()}>{copy.retry}</SendButton>
          </CardBody>
        </Card>
      ) : (
        <Layout>
          <Card>
            <CardHeader>
              <CardTitle>{copy.composeTitle}</CardTitle>
              <CardDescription>{copy.composeDescription}</CardDescription>
            </CardHeader>
            <CardBody>
              <Field as="div">
                {copy.templateLabel}
                <TemplateBar>
                  <Select value={selectedTemplateId} onChange={(event) => selectTemplate(event.target.value)}>
                    <option value="">{copy.templatePlaceholder}</option>
                    {templates.map((template: AdminNotificationTemplate) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </Select>
                  <QuietButton type="button" disabled={!selectedTemplateId || isSavingTemplate} onClick={() => void deleteTemplate()}>
                    {copy.deleteTemplate}
                  </QuietButton>
                </TemplateBar>
              </Field>
              <Field>
                {copy.titleLabel}
                <Input
                  value={title}
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={copy.titlePlaceholder}
                />
              </Field>
              <Field>
                {copy.messageLabel}
                <Textarea
                  value={body}
                  maxLength={4000}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={copy.messagePlaceholder}
                />
                <FieldHint>{copy.messageHint}</FieldHint>
              </Field>

              <Field as="div">
                {copy.audienceLabel}
                <AudienceGrid>
                  {audienceOptions.map((option) => (
                    <AudienceOption
                      key={option.id}
                      type="button"
                      $selected={audience === option.id}
                      onClick={() => setAudience(option.id)}
                    >
                      <AudienceName>{option.label}</AudienceName>
                      <AudienceCount>{copy.recipientCount.replace("{count}", String(option.count))}</AudienceCount>
                    </AudienceOption>
                  ))}
                </AudienceGrid>
              </Field>

              {audience === "selected_members" && (
                <MemberPicker>
                  <SearchWrap>
                    <MagnifyingGlassIcon />
                    <SearchInput
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={copy.searchMembers}
                    />
                  </SearchWrap>
                  <RecipientList>
                    {matchingRecipients.length === 0 ? (
                      <EmptyMembers>{copy.noMembers}</EmptyMembers>
                    ) : (
                      matchingRecipients.map((recipient) => {
                        const name = displayName(recipient, copy.memberFallback);
                        return (
                          <RecipientRow key={recipient.id}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(recipient.id)}
                              onChange={() => toggleRecipient(recipient.id)}
                            />
                            <Avatar>
                              {recipient.photoUrl ? (
                                <img src={recipient.photoUrl} alt="" />
                              ) : (
                                initials(name)
                              )}
                            </Avatar>
                            <RecipientName>{name}</RecipientName>
                          </RecipientRow>
                        );
                      })
                    )}
                  </RecipientList>
                </MemberPicker>
              )}

              <TwoColumns>
                <Field>
                  {copy.actionLabel}
                  <Input
                    value={actionLabel}
                    maxLength={80}
                    onChange={(event) => setActionLabel(event.target.value)}
                    placeholder={copy.actionLabelPlaceholder}
                  />
                </Field>
                <Field>
                  {copy.actionUrl}
                  <Input
                    value={actionUrl}
                    maxLength={500}
                    onChange={(event) => setActionUrl(event.target.value)}
                    placeholder={copy.actionUrlPlaceholder}
                  />
                </Field>
              </TwoColumns>

              <SchedulePanel>
                <ScheduleHeader>
                  <ScheduleTitle>{copy.templateSchedule}</ScheduleTitle>
                  <SwitchLabel>
                    <input
                      type="checkbox"
                      checked={templateScheduleEnabled}
                      onChange={(event) => setTemplateScheduleEnabled(event.target.checked)}
                    />
                    {copy.scheduleEnabled}
                  </SwitchLabel>
                </ScheduleHeader>
                <ScheduleFields>
                  <Field>
                    {copy.scheduleHour}
                    <Select
                      value={templateSchedule.hour}
                      onChange={(event) => setTemplateSchedule((current) => ({ ...current, hour: Number(event.target.value) }))}
                    >
                      {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hour.toString().padStart(2, "0")}</option>)}
                    </Select>
                  </Field>
                  <Field>
                    {copy.scheduleMinute}
                    <Select
                      value={templateSchedule.minute}
                      onChange={(event) => setTemplateSchedule((current) => ({ ...current, minute: Number(event.target.value) }))}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute) => <option key={minute} value={minute}>{minute.toString().padStart(2, "0")}</option>)}
                    </Select>
                  </Field>
                </ScheduleFields>
                <WeekdayRow>
                  {copy.weekdays.map((day, index) => (
                    <WeekdayButton
                      key={day}
                      type="button"
                      $active={templateSchedule.daysOfWeek.includes(index)}
                      onClick={() => toggleWeekday(index)}
                      aria-pressed={templateSchedule.daysOfWeek.includes(index)}
                    >
                      {day}
                    </WeekdayButton>
                  ))}
                </WeekdayRow>
                <ScheduleActions>
                  <QuietButton type="button" disabled={!selectedTemplateId || isSavingTemplate} onClick={() => void saveTemplateSchedule()}>
                    {copy.saveSchedule}
                  </QuietButton>
                </ScheduleActions>
              </SchedulePanel>

              <Field>
                {copy.newTemplateName}
                <TemplateBar>
                  <Input
                    value={templateName}
                    maxLength={120}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder={copy.newTemplatePlaceholder}
                  />
                  <QuietButton type="button" disabled={isSavingTemplate || !templateName.trim()} onClick={() => void saveTemplate()}>
                    {isSavingTemplate ? copy.savingTemplate : copy.saveTemplate}
                  </QuietButton>
                </TemplateBar>
              </Field>

              <Preview aria-live="polite">
                <PreviewLabel>{copy.preview}</PreviewLabel>
                <PreviewTitle>{title.trim() || copy.titlePlaceholder}</PreviewTitle>
                <PreviewBody>{body.trim() || copy.messagePlaceholder}</PreviewBody>
                {actionLabel.trim() && <PreviewAction>{actionLabel.trim()}</PreviewAction>}
              </Preview>

              <SubmitRow>
                <div>
                  {sendError && <InlineStatus $error>{sendError}</InlineStatus>}
                  {sendSuccess && <InlineStatus>{sendSuccess}</InlineStatus>}
                </div>
                <SendButton type="button" onClick={() => void submit()} disabled={isSending}>
                  {isSending ? copy.sending : copy.send.replace("{count}", String(recipientCount))}
                </SendButton>
              </SubmitRow>
            </CardBody>
            <DeliveryNote>{copy.deliveryNote}</DeliveryNote>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.historyTitle}</CardTitle>
              <CardDescription>{copy.historyDescription}</CardDescription>
            </CardHeader>
            <CardBody>
              {(data?.campaigns ?? []).length === 0 ? (
                <EmptyMembers>{copy.historyEmpty}</EmptyMembers>
              ) : (
                <HistoryList>
                  {(data?.campaigns ?? []).map((campaign: AdminNotificationCampaign) => (
                    <HistoryItem key={campaign.id}>
                      <HistoryTitle>{campaign.title}</HistoryTitle>
                      <HistoryBody>{campaign.body}</HistoryBody>
                      <HistoryMeta>
                        {copy.historyMeta
                          .replace("{audience}", copy.audienceLabels[campaign.audience])
                          .replace("{delivered}", String(campaign.deliveredCount))
                          .replace("{total}", String(campaign.recipientCount))}
                      </HistoryMeta>
                      <HistoryMeta>{formatDate(campaign.createdAt)}</HistoryMeta>
                    </HistoryItem>
                  ))}
                </HistoryList>
              )}
            </CardBody>
          </Card>
        </Layout>
      )}
    </Page>
  );
}
