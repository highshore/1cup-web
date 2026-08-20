export type NotificationAudience =
  | "all_members"
  | "active_subscribers"
  | "selected_members";

export interface AdminNotificationRecipient {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  accountStatus: string | null;
  hasActiveSubscription: boolean;
}

export interface AdminNotificationCampaign {
  id: string;
  audience: NotificationAudience;
  title: string;
  body: string;
  actionLabel: string | null;
  actionUrl: string | null;
  recipientCount: number;
  deliveredCount: number;
  createdAt: string;
}

export interface NotificationTemplateSchedule {
  minute: number;
  hour: number;
  daysOfWeek: number[];
}

export interface AdminNotificationTemplate {
  id: string;
  name: string;
  audience: NotificationAudience;
  recipientIds: string[];
  title: string;
  body: string;
  actionLabel: string | null;
  actionUrl: string | null;
  scheduleEnabled: boolean;
  schedule: NotificationTemplateSchedule;
  nextRunAt: string | null;
  lastRunAt: string | null;
  updatedAt: string;
}

export interface AdminNotificationsData {
  recipients: AdminNotificationRecipient[];
  campaigns: AdminNotificationCampaign[];
  templates: AdminNotificationTemplate[];
}

export interface SendAdminNotificationInput {
  audience: NotificationAudience;
  recipientIds: string[];
  title: string;
  body: string;
  actionLabel: string | null;
  actionUrl: string | null;
}

export interface SendAdminNotificationResult {
  campaignId: string;
  recipientCount: number;
  deliveredCount: number;
}

export interface CreateNotificationTemplateInput extends SendAdminNotificationInput {
  name: string;
  scheduleEnabled: boolean;
  schedule: NotificationTemplateSchedule;
}
