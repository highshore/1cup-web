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

import { useAuth } from "../../../contexts/auth_context";
import { useI18n } from "../../../i18n/I18nProvider";
import { supabase } from "../../../supabase/client";
import {
  getOrCreateSystemConversation,
  getUnreadNotificationCount,
} from "../services/chat_service";
import { type ChatMessage, toChatMessage } from "../types";

const menuItemClass = (danger?: boolean) =>
  `flex w-full min-h-[44px] items-center gap-[0.66rem] border-0 border-b border-solid border-[rgba(5,5,5,0.08)] bg-white py-[0.65rem] px-[0.85rem] text-[0.79rem] font-extrabold text-left cursor-pointer last:border-b-0 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:flex-[0_0_18px] ${
    danger ? "text-[#b42318] hover:bg-[#fff1f0]" : "text-[#050505] hover:bg-[#fff5ef]"
  }`;

const menuCountClass =
  "grid min-w-[23px] h-[21px] place-items-center border-[1.5px] border-solid border-[#050505] rounded-full bg-[#f47a4a] py-0 px-[5px] text-[#050505] text-[0.65rem] font-[950]";

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
    <div className="relative inline-flex" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-label={triggerLabel}
        aria-expanded={isMenuOpen}
        title={currentUser?.displayName || labels.account}
        className={`relative box-border w-[var(--nav-action-size)] h-[var(--nav-action-size)] min-h-[var(--nav-action-size)] flex-[0_0_var(--nav-action-size)] overflow-visible border-2 border-solid rounded-full bg-white p-0 cursor-pointer hover:shadow-[0_0_0_3px_rgba(244,122,74,0.18)] focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2 ${
          hasActiveSubscription === true
            ? "border-[#22c55e]"
            : isTransparent
              ? "border-[rgba(255,255,255,0.78)]"
              : "border-[#cbd5e1]"
        } ${isMenuOpen ? "shadow-[0_0_0_3px_rgba(244,122,74,0.25)]" : "shadow-none"}`}
      >
        <span className="flex w-full h-full items-center justify-center overflow-hidden rounded-full bg-white">
          {currentUser?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="w-full h-full object-cover"
              src={currentUser.photoURL}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-[#0f172a] text-[0.95rem] font-[850]">{avatarInitial}</span>
          )}
        </span>
        {hasActiveSubscription === true && (
          <span
            className="absolute right-[-1px] bottom-[-1px] w-[11px] h-[11px] border-2 border-solid border-white rounded-full bg-[#22c55e]"
            aria-hidden="true"
          />
        )}
        {unreadCount > 0 && (
          <span
            className="absolute z-[2] top-[-6px] right-[-7px] grid min-w-[19px] h-[19px] place-items-center border-2 border-solid border-[#050505] rounded-full bg-[#f47a4a] py-0 px-1 text-[#050505] text-[0.61rem] font-[950] leading-none tabular-nums"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {isMenuOpen && (
        <div
          className="absolute z-[65] top-[calc(100%+10px)] right-0 w-[min(248px,calc(100vw-1.5rem))] overflow-hidden border-2 border-solid border-[#050505] rounded-[13px] bg-white shadow-[4px_4px_0_rgba(5,5,5,0.92)]"
          role="menu"
          aria-label={labels.account}
        >
          <button type="button" role="menuitem" className={menuItemClass()} onClick={() => { setIsMenuOpen(false); router.push("/notifications"); }}>
            <BellAlertIcon />
            <span className="min-w-0 flex-1">{t.nav.notifications}</span>
            {unreadCount > 0 && <span className={menuCountClass}>{badgeLabel}</span>}
          </button>
          <button type="button" role="menuitem" className={menuItemClass()} onClick={() => { setIsMenuOpen(false); router.push("/speaking-test"); }}>
            <MicrophoneIcon />
            <span className="min-w-0 flex-1">{t.nav.speakingTest}</span>
          </button>
          <button type="button" role="menuitem" className={menuItemClass()} onClick={() => { setIsMenuOpen(false); router.push("/vocabulary"); }}>
            <BookOpenIcon />
            <span className="min-w-0 flex-1">{t.nav.vocabulary}</span>
          </button>
          {accountStatus === "admin" && (
            <button type="button" role="menuitem" className={menuItemClass()} onClick={() => { setIsMenuOpen(false); router.push("/admin"); }}>
              <WrenchScrewdriverIcon />
              <span className="min-w-0 flex-1">{t.nav.admin}</span>
            </button>
          )}
          <button type="button" role="menuitem" className={menuItemClass()} onClick={() => { setIsMenuOpen(false); router.push("/profile"); }}>
            <UserCircleIcon />
            <span className="min-w-0 flex-1">{labels.profile}</span>
          </button>
          <button type="button" role="menuitem" className={menuItemClass(true)} onClick={() => void handleLogout()}>
            <ArrowRightOnRectangleIcon />
            <span className="min-w-0 flex-1">{labels.logout}</span>
          </button>
        </div>
      )}
    </div>
  );
}
