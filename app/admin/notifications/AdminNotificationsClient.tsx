"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";

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

const Page = styled.main`
  width: min(1400px, calc(100% - 2.5rem));
  margin: 0 auto;
  padding: 0 0 2.5rem;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.34fr) minmax(300px, 0.66fr);
  align-items: start;
  gap: 1.25rem;

  @media (max-width: 850px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.section`
  overflow: hidden;
  border: 3px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
`;

const CardHeader = styled.div`
  padding: 1.35rem 1.35rem 0;
`;

const CardTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1rem;
  font-weight: 900;
`;

const CardDescription = styled.p`
  margin: 0.38rem 0 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.5;
`;

const CardBody = styled.div`
  padding: 1.15rem 1.35rem 1.35rem;
`;

const Field = styled.label`
  display: grid;
  gap: 0.42rem;
  margin-top: 1rem;
  color: #050505;
  font-size: 0.8rem;
  font-weight: 900;
`;

const Input = styled.input`
  width: 100%;
  min-height: 42px;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.62rem 0.72rem;
  color: #050505;
  font: inherit;
  font-size: 0.88rem;

  &:focus {
    outline: 3px solid #f47a4a;
  }
`;

const Select = styled.select`
  width: 100%;
  min-height: 42px;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.62rem 0.72rem;
  color: #050505;
  font: inherit;
  font-size: 0.88rem;

  &:focus {
    outline: 3px solid #f47a4a;
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 126px;
  box-sizing: border-box;
  resize: vertical;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.68rem 0.72rem;
  color: #050505;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.5;

  &:focus {
    outline: 3px solid #f47a4a;
  }
`;

const FieldHint = styled.p`
  margin: -0.08rem 0 0;
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.71rem;
  font-weight: 600;
`;

const TemplateBar = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.62rem;
  align-items: end;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const QuietButton = styled.button`
  min-height: 42px;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.58rem 0.7rem;
  box-shadow: 2px 2px 0 #050505;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.77rem;
  font-weight: 900;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    background: #fff1ea;
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

const SchedulePanel = styled.div`
  margin-top: 1rem;
  border: 1.5px solid #050505;
  border-radius: 12px;
  background: #fff8f4;
  padding: 0.82rem;
`;

const ScheduleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
`;

const ScheduleTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 900;
`;

const SwitchLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  color: #050505;
  font-size: 0.74rem;
  font-weight: 900;
  white-space: nowrap;

  input {
    width: 1rem;
    height: 1rem;
    accent-color: #f47a4a;
  }
`;

const ScheduleFields = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.62rem;
  margin-top: 0.68rem;
`;

const WeekdayRow = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.28rem;
  margin-top: 0.68rem;
`;

const WeekdayButton = styled.button<{ $active: boolean }>`
  min-height: 31px;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: ${({ $active }) => ($active ? "#f47a4a" : "#ffffff")};
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.67rem;
  font-weight: 900;
`;

const ScheduleActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.72rem;
`;

const AudienceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 0.58rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const AudienceOption = styled.button<{ $selected: boolean }>`
  min-height: 88px;
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${({ $selected }) => ($selected ? "#fff1ea" : "#ffffff")};
  padding: 0.68rem;
  color: #050505;
  box-shadow: ${({ $selected }) => ($selected ? "3px 3px 0 #f47a4a" : "none")};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: #fff8f4;
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const AudienceName = styled.span`
  display: block;
  font-size: 0.8rem;
  font-weight: 900;
`;

const AudienceCount = styled.span`
  display: block;
  margin-top: 0.25rem;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.72rem;
  font-weight: 700;
`;

const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem;

  @media (max-width: 540px) {
    grid-template-columns: 1fr;
  }
`;

const MemberPicker = styled.div`
  margin-top: 0.85rem;
  overflow: hidden;
  border: 1.5px solid #050505;
  border-radius: 12px;
`;

const SearchWrap = styled.div`
  position: relative;
  border-bottom: 1.5px solid #050505;

  svg {
    position: absolute;
    top: 50%;
    left: 0.7rem;
    width: 1rem;
    height: 1rem;
    transform: translateY(-50%);
    color: rgba(5, 5, 5, 0.52);
  }
`;

const SearchInput = styled(Input)`
  border: 0;
  border-radius: 0;
  padding-left: 2.1rem;

  &:focus {
    outline: none;
  }
`;

const RecipientList = styled.div`
  max-height: 235px;
  overflow-y: auto;
`;

const RecipientRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 48px;
  border-bottom: 1px solid rgba(5, 5, 5, 0.14);
  padding: 0.55rem 0.72rem;
  cursor: pointer;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: #fff8f4;
  }

  input {
    width: 1rem;
    height: 1rem;
    accent-color: #f47a4a;
  }
`;

const Avatar = styled.span`
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  font-size: 0.7rem;
  font-weight: 850;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const RecipientName = styled.span`
  min-width: 0;
  overflow: hidden;
  color: #050505;
  font-size: 0.81rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyMembers = styled.p`
  margin: 0;
  padding: 1.25rem 0.75rem;
  color: rgba(5, 5, 5, 0.54);
  font-size: 0.8rem;
  text-align: center;
`;

const Preview = styled.div`
  margin-top: 1rem;
  border: 2px dashed #050505;
  border-radius: 12px;
  background: #fff1ea;
  padding: 0.85rem;
`;

const PreviewLabel = styled.p`
  margin: 0 0 0.44rem;
  color: #050505;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const PreviewTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 0.86rem;
  font-weight: 900;
`;

const PreviewBody = styled.p`
  margin: 0.28rem 0 0;
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.81rem;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const PreviewAction = styled.span`
  display: inline-flex;
  margin-top: 0.55rem;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: #f47a4a;
  padding: 0.3rem 0.46rem;
  color: #050505;
  font-size: 0.71rem;
  font-weight: 850;
`;

const SubmitRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-top: 1.1rem;
`;

const SendButton = styled.button`
  min-height: 42px;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #f47a4a;
  padding: 0.66rem 0.9rem;
  box-shadow: 3px 3px 0 #050505;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 900;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    background: #f88d63;
    box-shadow: 4px 4px 0 #050505;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    box-shadow: none;
  }
`;

const InlineStatus = styled.p<{ $error?: boolean }>`
  margin: 0;
  color: ${({ $error }) => ($error ? "#991b1b" : "#0f6b32")};
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1.4;
`;

const DeliveryNote = styled.p`
  margin: 0;
  padding: 0.82rem 1.2rem;
  border-top: 2px solid #050505;
  background: #fff8f4;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.45;
`;

const HistoryList = styled.div`
  display: grid;
  gap: 0.72rem;
`;

const HistoryItem = styled.article`
  border: 1.5px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.85rem;
`;

const HistoryTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 0.86rem;
  font-weight: 900;
`;

const HistoryBody = styled.p`
  display: -webkit-box;
  margin: 0.3rem 0 0;
  overflow: hidden;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.78rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
`;

const HistoryMeta = styled.p`
  margin: 0.58rem 0 0;
  color: rgba(5, 5, 5, 0.52);
  font-size: 0.69rem;
  font-weight: 700;
`;

const LoadingState = styled.div`
  display: grid;
  min-height: 260px;
  place-items: center;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.88rem;
  font-weight: 800;
`;

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
