"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { appLayout } from "../lib/constants/app_layout";
import { useAuth } from "../lib/contexts/auth_context";
import {
  getOrCreateSystemConversation,
  getSystemNotifications,
  markNotificationRead,
} from "../lib/features/chat/services/chat_service";
import {
  type ChatMessage,
  getSystemAction,
  getSystemTitle,
  toChatMessage,
} from "../lib/features/chat/types";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";

const Page = styled.main`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
  padding: 1.5rem ${appLayout.pageGutterDesktop} 2.5rem;

  @media (max-width: 768px) {
    padding: 1rem 0 2rem;
  }
`;

const NotificationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Notification = styled.article<{ $unread: boolean }>`
  border: 2px solid ${({ $unread }) => ($unread ? "#050505" : "rgba(5, 5, 5, 0.22)")};
  border-radius: 12px;
  background: ${({ $unread }) => ($unread ? "#fff5ef" : "#ffffff")};
  padding: 1rem;
  box-shadow: ${({ $unread }) => ($unread ? "3px 3px 0 #f47a4a" : "none")};
`;

const NotificationHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

const NotificationTitle = styled.h2`
  margin: 0 0 0.28rem;
  color: #050505;
  font-size: 0.95rem;
  font-weight: 900;
  line-height: 1.35;
`;

const NotificationBody = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.76);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.55;
  white-space: pre-wrap;
`;

const NotificationMeta = styled.time`
  display: block;
  margin-top: 0.55rem;
  color: rgba(5, 5, 5, 0.5);
  font-size: 0.74rem;
`;

const MarkReadButton = styled.button`
  flex: 0 0 auto;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: #ffffff;
  padding: 0.3rem 0.45rem;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  &:hover { background: #f47a4a; }
`;

const ActionLink = styled(Link)`
  display: inline-flex;
  margin-top: 0.68rem;
  border: 1.5px solid #050505;
  border-radius: 8px;
  background: #f47a4a;
  padding: 0.38rem 0.58rem;
  color: #050505;
  font-size: 0.76rem;
  font-weight: 800;
  text-decoration: none;
  &:hover { background: #f88d63; }
`;

const State = styled.div`
  border: 1.5px solid rgba(5, 5, 5, 0.2);
  border-radius: 12px;
  background: #ffffff;
  padding: 2.5rem 1rem;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.45;
  text-align: center;
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageFromBroadcast(payload: unknown): ChatMessage | null {
  if (!isRecord(payload)) return null;
  const direct = toChatMessage(payload.record ?? payload.new);
  if (direct) return direct;
  if (isRecord(payload.payload)) {
    return toChatMessage(payload.payload.record ?? payload.payload.new ?? payload.payload);
  }
  if (isRecord(payload.data)) {
    return toChatMessage(payload.data.record ?? payload.data.new ?? payload.data);
  }
  return null;
}

function formatNotificationTime(value: string, locale: "en" | "ko"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationsClient() {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { locale, t } = useI18n();
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const notificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthLoading && !currentUser) router.replace("/auth?redirect=/notifications");
  }, [currentUser, isAuthLoading, router]);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setIsUnavailable(false);
    try {
      const systemConversationId = await getOrCreateSystemConversation();
      const messages = await getSystemNotifications(systemConversationId);
      setConversationId(systemConversationId);
      setNotifications([...messages].reverse());
      notificationIdsRef.current = new Set(messages.map((message) => message.id));
    } catch {
      setIsUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (!conversationId) return;
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      if (disposed) return;

      channel = supabase
        .channel(`notification-page:${conversationId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, (event) => {
          const incoming = messageFromBroadcast(event.payload);
          if (incoming?.conversationId !== conversationId || notificationIdsRef.current.has(incoming.id)) return;
          notificationIdsRef.current.add(incoming.id);
          setNotifications((current) => [incoming, ...current]);
        })
        .subscribe();
    }

    void subscribe();
    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleMarkRead = async (notification: ChatMessage) => {
    if (notification.readAt) return;
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((message) =>
        message.id === notification.id
          ? { ...message, readAt: new Date().toISOString() }
          : message,
      ));
      window.dispatchEvent(new Event("notifications:updated"));
    } catch {
      setIsUnavailable(true);
    }
  };

  if (isAuthLoading || !currentUser) {
    return <Page><State>{t.common.loading}</State></Page>;
  }

  return (
    <Page>
      {isLoading ? (
        <State>{t.chat.notificationsLoading}</State>
      ) : isUnavailable ? (
        <State>{t.chat.notificationsUnavailable}</State>
      ) : notifications.length === 0 ? (
        <State>{t.chat.notificationsEmpty}</State>
      ) : (
        <NotificationList>
          {notifications.map((notification) => {
            const action = getSystemAction(notification.metadata);
            const title = getSystemTitle(notification.metadata);
            return (
              <Notification key={notification.id} $unread={!notification.readAt}>
                <NotificationHeader>
                  <div>
                    {title && <NotificationTitle>{title}</NotificationTitle>}
                    <NotificationBody>{notification.body}</NotificationBody>
                  </div>
                  {!notification.readAt && (
                    <MarkReadButton type="button" onClick={() => void handleMarkRead(notification)}>
                      {t.chat.markRead}
                    </MarkReadButton>
                  )}
                </NotificationHeader>
                <NotificationMeta dateTime={notification.createdAt}>
                  {formatNotificationTime(notification.createdAt, locale)}
                </NotificationMeta>
                {action && (
                  <ActionLink href={action.url} onClick={() => void handleMarkRead(notification)}>
                    {action.label}
                  </ActionLink>
                )}
              </Notification>
            );
          })}
        </NotificationList>
      )}
    </Page>
  );
}
