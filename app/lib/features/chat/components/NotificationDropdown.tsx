"use client";

import { BellAlertIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { useI18n } from "../../../i18n/I18nProvider";
import { supabase } from "../../../supabase/client";
import {
  getOrCreateSystemConversation,
  getSystemNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
} from "../services/chat_service";
import {
  type ChatMessage,
  getSystemAction,
  getSystemTitle,
  toChatMessage,
} from "../types";

const Wrap = styled.div`
  display: contents;
`;

const Trigger = styled.button<{ $isTransparent: boolean; $open: boolean }>`
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  width: var(--nav-action-size);
  height: var(--nav-action-size);
  min-height: var(--nav-action-size);
  flex: 0 0 var(--nav-action-size);
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: ${({ $isTransparent, $open }) =>
    $open
      ? $isTransparent
        ? "rgba(255, 255, 255, 0.18)"
        : "#f47a4a"
      : "transparent"};
  color: ${({ $isTransparent, $open }) =>
    $isTransparent ? "rgba(255, 255, 255, 0.88)" : $open ? "#050505" : "#475569"};
  cursor: pointer;

  &:hover {
    background: ${({ $isTransparent }) =>
      $isTransparent ? "rgba(255, 255, 255, 0.14)" : "#fff1ea"};
    color: ${({ $isTransparent }) => ($isTransparent ? "#ffffff" : "#0f172a")};
  }

  svg {
    width: 19px;
    height: 19px;
  }

`;

const UnreadBadge = styled.span`
  position: absolute;
  top: 2px;
  right: 1px;
  display: grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  padding: 0 3px;
  color: #050505;
  font-size: 0.6rem;
  font-weight: 900;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`;

const Panel = styled.section`
  position: fixed;
  z-index: 60;
  top: 72px;
  left: 50%;
  display: flex;
  width: min(960px, calc(100vw - 2rem));
  max-height: calc(100dvh - 88px);
  flex-direction: column;
  transform: translateX(-50%);
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.92);

  @media (max-width: 640px) {
    top: 68px;
    width: calc(100vw - 2rem);
    max-height: calc(100dvh - 84px);
  }
`;

const PanelHeader = styled.div`
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #050505;
  padding: 0.75rem 0.85rem;
`;

const PanelTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 0.9rem;
  font-weight: 900;
`;

const CloseButton = styled.button`
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1.5px solid #050505;
  border-radius: 8px;
  background: #ffffff;
  color: #050505;
  cursor: pointer;

  &:hover {
    background: #f47a4a;
  }

  svg {
    width: 17px;
    height: 17px;
  }
`;

const NotificationList = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

const Notification = styled.article`
  border-bottom: 1.5px solid rgba(5, 5, 5, 0.24);
  padding: 0.85rem;

  &:last-child {
    border-bottom: 0;
  }
`;

const NotificationHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
`;

const NotificationBody = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.76);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.48;
  white-space: pre-wrap;
`;

const NotificationTitle = styled.h3`
  margin: 0 0 0.22rem;
  color: #050505;
  font-size: 0.84rem;
  font-weight: 900;
  line-height: 1.35;
`;

const NotificationMeta = styled.time`
  display: block;
  margin-top: 0.35rem;
  color: rgba(5, 5, 5, 0.5);
  font-size: 0.7rem;
`;

const MarkReadButton = styled.button`
  flex: 0 0 auto;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: #ffffff;
  padding: 0.24rem 0.38rem;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.69rem;
  font-weight: 800;

  &:hover {
    background: #f47a4a;
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const ActionLink = styled(Link)`
  display: inline-flex;
  margin-top: 0.52rem;
  border: 1.5px solid #050505;
  border-radius: 8px;
  background: #f47a4a;
  padding: 0.34rem 0.52rem;
  color: #050505;
  font-size: 0.73rem;
  font-weight: 800;
  text-decoration: none;

  &:hover {
    background: #f88d63;
  }
`;

const PanelState = styled.div`
  padding: 2.2rem 1rem;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.82rem;
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
    const nested = toChatMessage(
      payload.payload.record ?? payload.payload.new ?? payload.payload,
    );
    if (nested) return nested;
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

export default function NotificationDropdown({
  isTransparent,
}: {
  isTransparent: boolean;
}) {
  const { locale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const notificationIdsRef = useRef<Set<string>>(new Set());

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const triggerLabel = unreadCount > 0
    ? t.chat.unreadNotifications.replace("{count}", String(unreadCount))
    : t.nav.notifications;

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setIsUnavailable(false);
    try {
      const systemConversationId = conversationId ?? await getOrCreateSystemConversation();
      const messages = await getSystemNotifications(systemConversationId);
      const count = await getUnreadNotificationCount();
      setConversationId(systemConversationId);
      setNotifications(messages);
      notificationIdsRef.current = new Set(messages.map((message) => message.id));
      setUnreadCount(count);
    } catch {
      // The bell must remain harmless while a database migration is rolling out.
      setIsUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    let active = true;

    async function loadBadge() {
      try {
        const systemConversationId = await getOrCreateSystemConversation();
        const count = await getUnreadNotificationCount();
        if (!active) return;
        setConversationId(systemConversationId);
        setUnreadCount(count);
      } catch {
        // A unavailable notification backend must never block the navbar.
      }
    }

    void loadBadge();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadNotifications();
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    if (!conversationId) return;

    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed || !session) return;

      await supabase.realtime.setAuth(session.access_token);
      if (disposed) return;

      channel = supabase
        .channel(`conversation:${conversationId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, (event) => {
          const incoming = messageFromBroadcast(event.payload);
          if (incoming?.conversationId !== conversationId) return;
          if (notificationIdsRef.current.has(incoming.id)) return;

          notificationIdsRef.current.add(incoming.id);
          setNotifications((current) =>
            [...current, incoming].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
                a.id.localeCompare(b.id),
            ),
          );
          if (incoming.type === "system" || incoming.type === "meetup") {
            setUnreadCount((count) => count + 1);
          }
        })
        .subscribe();
    }

    void subscribe();
    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent | FocusEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeWhenOutside, true);
    document.addEventListener("focusin", closeWhenOutside, true);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside, true);
      document.removeEventListener("focusin", closeWhenOutside, true);
    };
  }, []);

  const handleMarkRead = async (notification: ChatMessage) => {
    if (notification.readAt) return;
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((message) =>
          message.id === notification.id
            ? { ...message, readAt: new Date().toISOString() }
            : message,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setIsUnavailable(true);
    }
  };

  return (
    <Wrap ref={wrapRef}>
      <Trigger
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        title={t.nav.notifications}
        $isTransparent={isTransparent}
        $open={isOpen}
      >
        <BellAlertIcon />
        {unreadCount > 0 && <UnreadBadge aria-hidden="true">{badgeLabel}</UnreadBadge>}
      </Trigger>
      {isOpen && (
        <Panel aria-label={t.nav.notifications}>
          <PanelHeader>
            <PanelTitle>{t.chat.notificationsTitle}</PanelTitle>
            <CloseButton type="button" onClick={() => setIsOpen(false)} aria-label={t.chat.closeNotifications}>
              <XMarkIcon />
            </CloseButton>
          </PanelHeader>
          {isLoading ? (
            <PanelState>{t.chat.notificationsLoading}</PanelState>
          ) : isUnavailable ? (
            <PanelState>{t.chat.notificationsUnavailable}</PanelState>
          ) : notifications.length === 0 ? (
            <PanelState>{t.chat.notificationsEmpty}</PanelState>
          ) : (
            <NotificationList>
              {notifications.map((notification) => {
                const action = getSystemAction(notification.metadata);
                const title = getSystemTitle(notification.metadata);
                return (
                  <Notification key={notification.id}>
                    <NotificationHeader>
                      {title && <NotificationTitle>{title}</NotificationTitle>}
                      {!notification.readAt && (
                        <MarkReadButton
                          type="button"
                          onClick={() => void handleMarkRead(notification)}
                        >
                          {t.chat.markRead}
                        </MarkReadButton>
                      )}
                    </NotificationHeader>
                    <NotificationBody>{notification.body}</NotificationBody>
                    <NotificationMeta dateTime={notification.createdAt}>
                      {formatNotificationTime(notification.createdAt, locale)}
                    </NotificationMeta>
                    {action && (
                      <ActionLink
                        href={action.url}
                        onClick={() => {
                          void handleMarkRead(notification);
                          setIsOpen(false);
                        }}
                      >
                        {action.label}
                      </ActionLink>
                    )}
                  </Notification>
                );
              })}
            </NotificationList>
          )}
        </Panel>
      )}
    </Wrap>
  );
}
