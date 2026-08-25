"use client";

import {
  ArrowRightOnRectangleIcon,
  BellAlertIcon,
  BookOpenIcon,
  MicrophoneIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { useAuth } from "../../../contexts/auth_context";
import { useI18n } from "../../../i18n/I18nProvider";
import { supabase } from "../../../supabase/client";
import {
  getOrCreateSystemConversation,
  getUnreadNotificationCount,
} from "../services/chat_service";
import { type ChatMessage, toChatMessage } from "../types";

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
  border: 2px solid ${({ $active, $isTransparent }) =>
    $active ? "#22c55e" : $isTransparent ? "rgba(255,255,255,0.78)" : "#cbd5e1"};
  border-radius: 50%;
  background: #ffffff;
  padding: 0;
  box-shadow: ${({ $open }) => ($open ? "0 0 0 3px rgba(244,122,74,0.25)" : "none")};
  cursor: pointer;

  &:hover { box-shadow: 0 0 0 3px rgba(244,122,74,0.18); }
  &:focus-visible { outline: 3px solid #f47a4a; outline-offset: 2px; }
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

  &:last-child { border-bottom: 0; }
  &:hover { background: ${({ $danger }) => ($danger ? "#fff1f0" : "#fff5ef")}; }
  svg { width: 18px; height: 18px; flex: 0 0 18px; }
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

export default function NotificationDropdown({ isTransparent }: { isTransparent: boolean }) {
  const { locale, t } = useI18n();
  const { currentUser, hasActiveSubscription, accountStatus, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const labels = locale === "ko"
    ? { account: "계정 메뉴", profile: "프로필", logout: "로그아웃" }
    : { account: "Account menu", profile: "Profile", logout: "Log out" };
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const triggerLabel = unreadCount > 0
    ? `${labels.account}, ${t.chat.unreadNotifications.replace("{count}", String(unreadCount))}`
    : labels.account;
  const avatarInitial = currentUser?.displayName?.charAt(0).toUpperCase() ?? "U";

  const loadBadge = useCallback(async () => {
    try {
      const [systemConversationId, count] = await Promise.all([
        getOrCreateSystemConversation(),
        getUnreadNotificationCount(),
      ]);
      setConversationId(systemConversationId);
      setUnreadCount(count);
    } catch {
      // Notifications are optional navbar enrichment; never block navigation.
    }
  }, []);

  useEffect(() => { void loadBadge(); }, [loadBadge]);

  useEffect(() => {
    const refreshBadge = () => void loadBadge();
    window.addEventListener("notifications:updated", refreshBadge);
    return () => window.removeEventListener("notifications:updated", refreshBadge);
  }, [loadBadge]);

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
        .channel(`notification-badge:${conversationId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, (event) => {
          const incoming = messageFromBroadcast(event.payload);
          if (incoming?.conversationId !== conversationId) return;
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
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

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
        title={currentUser?.displayName || labels.account}
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
          <MenuItem type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); router.push("/notifications"); }}>
            <BellAlertIcon />
            <MenuLabel>{t.nav.notifications}</MenuLabel>
            {unreadCount > 0 && <MenuCount>{badgeLabel}</MenuCount>}
          </MenuItem>
          <MenuItem type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); router.push("/speaking-test"); }}>
            <MicrophoneIcon />
            <MenuLabel>{t.nav.speakingTest}</MenuLabel>
          </MenuItem>
          <MenuItem type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); router.push("/vocabulary"); }}>
            <BookOpenIcon />
            <MenuLabel>{t.nav.vocabulary}</MenuLabel>
          </MenuItem>
          {accountStatus === "admin" && (
            <MenuItem type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); router.push("/admin"); }}>
              <WrenchScrewdriverIcon />
              <MenuLabel>{t.nav.admin}</MenuLabel>
            </MenuItem>
          )}
          <MenuItem type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); router.push("/profile"); }}>
            <UserCircleIcon />
            <MenuLabel>{labels.profile}</MenuLabel>
          </MenuItem>
          <MenuItem type="button" role="menuitem" $danger onClick={() => void handleLogout()}>
            <ArrowRightOnRectangleIcon />
            <MenuLabel>{labels.logout}</MenuLabel>
          </MenuItem>
        </AccountMenu>
      )}
    </Wrap>
  );
}
