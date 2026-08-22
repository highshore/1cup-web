"use client";

import {
  ArrowRightOnRectangleIcon,
  BellAlertIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { useAuth } from "../../../contexts/auth_context";
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
  position: relative;
  display: inline-flex;
`;

const ProfileTrigger = styled.button<{
  $isTransparent: boolean;
  $open: boolean;
  $active: boolean;
}>`
  position: relative;
  box-sizing: border-box;
  width: var(--nav-action-size);
  height: var(--nav-action-size);
  min-height: var(--nav-action-size);
  flex: 0 0 var(--nav-action-size);
  overflow: visible;
  border: 2px solid
    ${({ $active, $isTransparent }) =>
      $active
        ? "#22c55e"
        : $isTransparent
          ? "rgba(255,255,255,0.78)"
          : "#cbd5e1"};
  border-radius: 50%;
  background: #ffffff;
  padding: 0;
  box-shadow: ${({ $open }) => ($open ? "0 0 0 3px rgba(244,122,74,0.25)" : "none")};
  cursor: pointer;

  &:hover {
    box-shadow: 0 0 0 3px rgba(244,122,74,0.18);
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const AvatarInner = styled.span`
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #ffffff;
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AvatarFallback = styled.span`
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 850;
`;

const SubscriptionDot = styled.span`
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #22c55e;
`;

const UnreadBadge = styled.span`
  position: absolute;
  z-index: 2;
  top: -6px;
  right: -7px;
  display: grid;
  min-width: 19px;
  height: 19px;
  place-items: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  padding: 0 4px;
  color: #050505;
  font-size: 0.61rem;
  font-weight: 950;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`;

const AccountMenu = styled.div`
  position: absolute;
  z-index: 65;
  top: calc(100% + 10px);
  right: 0;
  width: min(248px, calc(100vw - 1.5rem));
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 13px;
  background: #ffffff;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.92);
`;

const AccountSummary = styled.div`
  border-bottom: 1.5px solid rgba(5, 5, 5, 0.16);
  padding: 0.78rem 0.85rem;
`;

const AccountName = styled.div`
  overflow: hidden;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AccountEmail = styled.div`
  overflow: hidden;
  margin-top: 0.1rem;
  color: rgba(5, 5, 5, 0.5);
  font-size: 0.69rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 0.66rem;
  border: 0;
  border-bottom: 1px solid rgba(5, 5, 5, 0.08);
  background: #ffffff;
  padding: 0.65rem 0.85rem;
  color: ${({ $danger }) => ($danger ? "#b42318" : "#050505")};
  font: inherit;
  font-size: 0.79rem;
  font-weight: 800;
  text-align: left;
  cursor: pointer;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: ${({ $danger }) => ($danger ? "#fff1f0" : "#fff5ef")};
  }

  svg {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
  }
`;

const MenuLabel = styled.span`
  min-width: 0;
  flex: 1;
`;

const MenuCount = styled.span`
  display: grid;
  min-width: 23px;
  height: 21px;
  place-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  padding: 0 5px;
  color: #050505;
  font-size: 0.65rem;
  font-weight: 950;
`;

const Panel = styled.section`
  position: fixed;
  z-index: 70;
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

  &:hover { background: #f47a4a; }
  svg { width: 17px; height: 17px; }
`;

const NotificationList = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

const Notification = styled.article`
  border-bottom: 1.5px solid rgba(5, 5, 5, 0.24);
  padding: 0.85rem;
  &:last-child { border-bottom: 0; }
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
  &:hover { background: #f47a4a; }
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
  &:hover { background: #f88d63; }
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
  const { currentUser, hasActiveSubscription, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const notificationIdsRef = useRef<Set<string>>(new Set());

  const labels = locale === "ko"
    ? { account: "계정 메뉴", profile: "프로필", logout: "로그아웃" }
    : { account: "Account menu", profile: "Profile", logout: "Log out" };
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const triggerLabel = unreadCount > 0
    ? `${labels.account}, ${t.chat.unreadNotifications.replace("{count}", String(unreadCount))}`
    : labels.account;
  const avatarInitial = currentUser?.displayName?.charAt(0).toUpperCase()
    ?? currentUser?.email?.charAt(0).toUpperCase()
    ?? "U";

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setIsUnavailable(false);
    try {
      const systemConversationId =
        conversationId ?? (await getOrCreateSystemConversation());
      const [messages, count] = await Promise.all([
        getSystemNotifications(systemConversationId),
        getUnreadNotificationCount(),
      ]);
      setConversationId(systemConversationId);
      setNotifications(messages);
      notificationIdsRef.current = new Set(messages.map((message) => message.id));
      setUnreadCount(count);
    } catch {
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
        // Notifications are optional navbar enrichment; never block navigation.
      }
    }
    void loadBadge();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isNotificationsOpen) void loadNotifications();
  }, [isNotificationsOpen, loadNotifications]);

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
        .channel(`conversation:${conversationId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, (event) => {
          const incoming = messageFromBroadcast(event.payload);
          if (incoming?.conversationId !== conversationId) return;
          if (notificationIdsRef.current.has(incoming.id)) return;
          notificationIdsRef.current.add(incoming.id);
          setNotifications((current) =>
            [...current, incoming].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                || a.id.localeCompare(b.id),
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
      if (event.key !== "Escape") return;
      if (isNotificationsOpen) setIsNotificationsOpen(false);
      else setIsMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isNotificationsOpen]);

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent | FocusEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setIsMenuOpen(false);
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

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <Wrap ref={wrapRef}>
      <ProfileTrigger
        type="button"
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-label={triggerLabel}
        aria-expanded={isMenuOpen}
        title={currentUser?.displayName || currentUser?.email || labels.account}
        $isTransparent={isTransparent}
        $open={isMenuOpen}
        $active={hasActiveSubscription === true}
      >
        <AvatarInner>
          {currentUser?.photoURL ? (
            <AvatarImage src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <AvatarFallback>{avatarInitial}</AvatarFallback>
          )}
        </AvatarInner>
        {hasActiveSubscription === true && <SubscriptionDot aria-hidden="true" />}
        {unreadCount > 0 && <UnreadBadge aria-hidden="true">{badgeLabel}</UnreadBadge>}
      </ProfileTrigger>

      {isMenuOpen && (
        <AccountMenu role="menu" aria-label={labels.account}>
          <AccountSummary>
            <AccountName>{currentUser?.displayName || labels.profile}</AccountName>
            {currentUser?.email && <AccountEmail>{currentUser.email}</AccountEmail>}
          </AccountSummary>
          <MenuItem
            type="button"
            role="menuitem"
            onClick={() => {
              setIsMenuOpen(false);
              setIsNotificationsOpen(true);
            }}
          >
            <BellAlertIcon />
            <MenuLabel>{t.nav.notifications}</MenuLabel>
            {unreadCount > 0 && <MenuCount>{badgeLabel}</MenuCount>}
          </MenuItem>
          <MenuItem
            type="button"
            role="menuitem"
            onClick={() => {
              setIsMenuOpen(false);
              router.push("/profile");
            }}
          >
            <UserCircleIcon />
            <MenuLabel>{labels.profile}</MenuLabel>
          </MenuItem>
          <MenuItem type="button" role="menuitem" $danger onClick={() => void handleLogout()}>
            <ArrowRightOnRectangleIcon />
            <MenuLabel>{labels.logout}</MenuLabel>
          </MenuItem>
        </AccountMenu>
      )}

      {isNotificationsOpen && (
        <Panel aria-label={t.nav.notifications}>
          <PanelHeader>
            <PanelTitle>{t.chat.notificationsTitle}</PanelTitle>
            <CloseButton
              type="button"
              onClick={() => setIsNotificationsOpen(false)}
              aria-label={t.chat.closeNotifications}
            >
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
                          setIsNotificationsOpen(false);
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
