"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

const pageClass =
  "w-full max-w-page mx-auto pt-6 px-gutter pb-10 max-[768px]:pt-4 max-[768px]:px-0 max-[768px]:pb-8";

const stateClass =
  "rounded-xl border-[1.5px] border-[rgba(5,5,5,0.2)] bg-white px-4 py-10 text-center text-[0.9rem] font-bold leading-[1.45] text-[rgba(5,5,5,0.6)]";

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
    return (
      <main className={pageClass}>
        <div className={stateClass}>{t.common.loading}</div>
      </main>
    );
  }

  return (
    <main className={pageClass}>
      {isLoading ? (
        <div className={stateClass}>{t.chat.notificationsLoading}</div>
      ) : isUnavailable ? (
        <div className={stateClass}>{t.chat.notificationsUnavailable}</div>
      ) : notifications.length === 0 ? (
        <div className={stateClass}>{t.chat.notificationsEmpty}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => {
            const action = getSystemAction(notification.metadata);
            const title = getSystemTitle(notification.metadata);
            const unread = !notification.readAt;
            return (
              <article
                key={notification.id}
                className={`rounded-xl border-2 p-4 ${
                  unread
                    ? "border-[#050505] bg-[#fff5ef] shadow-[3px_3px_0_#f47a4a]"
                    : "border-[rgba(5,5,5,0.22)] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {title && (
                      <h2 className="m-0 mb-[0.28rem] text-[0.95rem] font-black leading-[1.35] text-[#050505]">
                        {title}
                      </h2>
                    )}
                    <p className="m-0 whitespace-pre-wrap text-[0.88rem] font-semibold leading-[1.55] text-[rgba(5,5,5,0.76)]">
                      {notification.body}
                    </p>
                  </div>
                  {unread && (
                    <button
                      type="button"
                      className="flex-none cursor-pointer rounded-[7px] border-[1.5px] border-[#050505] bg-white px-[0.45rem] py-[0.3rem] text-[0.72rem] font-extrabold text-[#050505] hover:bg-[#f47a4a]"
                      onClick={() => void handleMarkRead(notification)}
                    >
                      {t.chat.markRead}
                    </button>
                  )}
                </div>
                <time
                  dateTime={notification.createdAt}
                  className="mt-[0.55rem] block text-[0.74rem] text-[rgba(5,5,5,0.5)]"
                >
                  {formatNotificationTime(notification.createdAt, locale)}
                </time>
                {action && (
                  <Link
                    href={action.url}
                    className="mt-[0.68rem] inline-flex rounded-lg border-[1.5px] border-[#050505] bg-[#f47a4a] px-[0.58rem] py-[0.38rem] text-[0.76rem] font-extrabold text-[#050505] no-underline hover:bg-[#f88d63] hover:no-underline"
                    onClick={() => void handleMarkRead(notification)}
                  >
                    {action.label}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
