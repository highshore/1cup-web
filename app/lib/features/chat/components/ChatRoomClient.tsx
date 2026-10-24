"use client";

import {
  EllipsisHorizontalIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useI18n } from "../../../i18n/I18nProvider";
import { supabase } from "../../../supabase/client";
import {
  blockMember,
  fetchOlderMessages,
  getMessagingStatus,
  sendTextMessage,
  unblockMember,
} from "../services/chat_service";
import {
  type ChatMessage,
  type ChatRoomInitialData,
  type MessagingStatus,
  getSystemAction,
  getSystemTitle,
  toChatMessage,
} from "../types";

const headerNameClass =
  "overflow-hidden text-[#0f172a] text-[0.96rem] font-extrabold text-ellipsis whitespace-nowrap";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageFromBroadcast(payload: unknown): ChatMessage | null {
  if (!isRecord(payload)) return null;

  const directRecord = payload.record ?? payload.new;
  if (directRecord) return toChatMessage(directRecord);

  if (isRecord(payload.payload)) {
    return toChatMessage(payload.payload.record ?? payload.payload.new ?? payload.payload);
  }

  if (isRecord(payload.data)) {
    return toChatMessage(payload.data.record ?? payload.data.new ?? payload.data);
  }

  return null;
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const timeDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return timeDifference || a.id.localeCompare(b.id);
  });
}

function dateKey(value: string, locale: "en" | "ko"): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}

function timeLabel(value: string, locale: "en" | "ko"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function makeTemporaryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `temporary-${crypto.randomUUID()}`;
  }
  return `temporary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ChatRoomClient({ initialData }: { initialData: ChatRoomInitialData }) {
  const { locale, t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>(() => sortMessages(initialData.messages));
  const [draft, setDraft] = useState("");
  const [messagingStatus, setMessagingStatus] = useState<MessagingStatus | null>(
    initialData.conversationType === "system" ? "unavailable" : null,
  );
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(initialData.messages.length === 50);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);

  const isSystem = initialData.conversationType === "system";
  const otherMember = initialData.otherMember;
  const headerName = isSystem ? "☕ 1 Cup English" : otherMember?.displayName || t.chat.memberFallback;
  const isSendEnabled =
    !isSystem &&
    messagingStatus === "available" &&
    !isSending &&
    draft.trim().length > 0 &&
    draft.trim().length <= 4000;

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
  }, []);

  const mergeIncomingMessage = useCallback(
    (incoming: ChatMessage) => {
      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === incoming.id)) return currentMessages;

        const optimisticIndex = currentMessages.findIndex(
          (message) =>
            message.optimistic &&
            !message.failed &&
            message.senderId === incoming.senderId &&
            message.body === incoming.body,
        );

        if (optimisticIndex >= 0) {
          return sortMessages(
            currentMessages.map((message, index) => (index === optimisticIndex ? incoming : message)),
          );
        }

        return sortMessages([...currentMessages, incoming]);
      });
      scrollToLatest();
    },
    [scrollToLatest],
  );

  useEffect(() => {
    scrollToLatest();
  }, [scrollToLatest]);

  useEffect(() => {
    if (isSystem) return;

    let active = true;
    getMessagingStatus(initialData.conversationId)
      .then((status) => {
        if (active) setMessagingStatus(status);
      })
      .catch(() => {
        if (active) setMessagingStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, [initialData.conversationId, isSystem]);

  useEffect(() => {
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
        .channel(`conversation:${initialData.conversationId}`, {
          config: { private: true },
        })
        .on("broadcast", { event: "INSERT" }, (event) => {
          const incoming = messageFromBroadcast(event.payload);
          if (incoming?.conversationId === initialData.conversationId) {
            mergeIncomingMessage(incoming);
          }
        })
        .subscribe();
    }

    void subscribe();
    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [initialData.conversationId, mergeIncomingMessage]);

  const loadOlderMessages = async () => {
    const firstPersistedMessage = messages.find((message) => !message.optimistic);
    if (!firstPersistedMessage || isLoadingOlder || !hasMore) return;

    setIsLoadingOlder(true);
    setError("");
    const viewport = viewportRef.current;
    const previousHeight = viewport?.scrollHeight ?? 0;
    const previousTop = viewport?.scrollTop ?? 0;

    try {
      const olderMessages = await fetchOlderMessages(initialData.conversationId, {
        id: firstPersistedMessage.id,
        createdAt: firstPersistedMessage.createdAt,
      });
      setMessages((currentMessages) => sortMessages([...olderMessages, ...currentMessages]));
      setHasMore(olderMessages.length === 50);
      requestAnimationFrame(() => {
        if (viewport) viewport.scrollTop = previousTop + viewport.scrollHeight - previousHeight;
      });
    } catch {
      setError(t.chat.loadOlderFailed);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const submitMessage = async () => {
    const body = draft.trim();
    if (!body || body.length > 4000 || !otherMember || !isSendEnabled) return;

    const temporaryId = makeTemporaryId();
    const optimisticMessage: ChatMessage = {
      id: temporaryId,
      conversationId: initialData.conversationId,
      senderId: initialData.currentUserId,
      type: "text",
      body,
      metadata: {},
      createdAt: new Date().toISOString(),
      optimistic: true,
    };

    setDraft("");
    setError("");
    setIsSending(true);
    setMessages((currentMessages) => sortMessages([...currentMessages, optimisticMessage]));
    scrollToLatest();

    try {
      const savedMessage = await sendTextMessage({
        conversationId: initialData.conversationId,
        senderId: initialData.currentUserId,
        body,
      });
      mergeIncomingMessage(savedMessage);
    } catch {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === temporaryId ? { ...message, optimistic: false, failed: true } : message,
        ),
      );
      setError(t.chat.sendFailed);
      setMessagingStatus("unavailable");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const changeBlockStatus = async () => {
    if (!otherMember) return;

    setError("");
    setIsMenuOpen(false);
    try {
      if (messagingStatus === "blocked_by_me") {
        await unblockMember(initialData.currentUserId, otherMember.id);
        setMessagingStatus("available");
      } else {
        await blockMember(initialData.currentUserId, otherMember.id);
        setMessagingStatus("blocked_by_me");
      }
    } catch {
      setError(t.chat.blockActionFailed);
    }
  };

  const statusNotice = useMemo(() => {
    if (isSystem) return t.chat.systemRoomDescription;
    if (messagingStatus === "blocked_by_me") return t.chat.blockedByYou;
    if (messagingStatus === "unavailable") return t.chat.messagingUnavailable;
    return null;
  }, [isSystem, messagingStatus, t]);

  return (
    <main className="w-full max-w-page min-h-[calc(100vh-120px)] mx-auto pt-[1.4rem] px-gutter pb-14 max-[640px]:min-h-[calc(100vh-100px)] max-[640px]:pt-[0.8rem] max-[640px]:px-gutter-mobile max-[640px]:pb-5">
      <section className="grid grid-rows-[auto_minmax(420px,1fr)_auto] min-h-[min(720px,calc(100vh-175px))] overflow-hidden border border-[#e2e8f0] rounded-[20px] bg-[#f8fafc] shadow-[0_16px_38px_rgba(15,23,42,0.08)] max-[640px]:min-h-[calc(100vh-120px)] max-[640px]:rounded-2xl">
        <header className="flex min-h-[72px] items-center gap-3 border-b border-[#e2e8f0] bg-[rgba(255,255,255,0.95)] py-[0.8rem] px-4">
          <div
            className={`grid w-[42px] h-[42px] flex-none place-items-center overflow-hidden rounded-full font-extrabold ${
              isSystem
                ? "bg-[#fef3c7] text-[#92400e] text-[1.2rem]"
                : "bg-[#e2e8f0] text-[#334155] text-[0.95rem]"
            }`}
            aria-hidden="true"
          >
            {isSystem ? (
              "☕"
            ) : otherMember?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="w-full h-full object-cover"
                src={otherMember.photoUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              headerName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            {otherMember ? (
              <Link className="group text-inherit no-underline" href={`/profile/${otherMember.id}`}>
                <div className={`${headerNameClass} underline-offset-[3px] group-hover:underline`}>
                  {headerName}
                </div>
              </Link>
            ) : (
              <div className={headerNameClass}>{headerName}</div>
            )}
            <div className="overflow-hidden mt-[0.13rem] text-[#64748b] text-[0.76rem] text-ellipsis whitespace-nowrap">
              {isSystem ? t.chat.systemRoomLabel : t.chat.profileLinkHint}
            </div>
          </div>
          {!isSystem && otherMember && (
            <div className="relative">
              <button
                className="grid w-9 h-9 place-items-center border-0 rounded-[10px] bg-transparent text-[#475569] cursor-pointer hover:bg-[#f1f5f9] hover:text-[#0f172a] [&_svg]:w-[21px] [&_svg]:h-[21px]"
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={t.chat.conversationMenu}
                aria-expanded={isMenuOpen}
              >
                <EllipsisHorizontalIcon />
              </button>
              {isMenuOpen && (
                <div className="absolute z-[2] top-[calc(100%+0.35rem)] right-0 min-w-[145px] overflow-hidden border border-[#e2e8f0] rounded-xl bg-white p-[0.3rem] shadow-[0_12px_24px_rgba(15,23,42,0.16)]">
                  <button
                    className={`w-full border-0 rounded-lg bg-transparent py-[0.58rem] px-[0.65rem] text-[0.84rem] font-bold text-left cursor-pointer ${
                      messagingStatus !== "blocked_by_me"
                        ? "text-[#b91c1c] hover:bg-[#fef2f2]"
                        : "text-[#334155] hover:bg-[#f8fafc]"
                    }`}
                    type="button"
                    onClick={() => void changeBlockStatus()}
                  >
                    {messagingStatus === "blocked_by_me" ? t.chat.unblock : t.chat.block}
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        <div className="overflow-y-auto p-4" ref={viewportRef} aria-live="polite">
          {hasMore && (
            <button
              className="block mx-auto mb-4 border border-[#cbd5e1] rounded-full bg-white py-[0.45rem] px-[0.8rem] text-[#475569] text-[0.78rem] font-[750] cursor-pointer [&:hover:not(:disabled)]:border-[#94a3b8] [&:hover:not(:disabled)]:text-[#0f172a] disabled:cursor-wait disabled:opacity-65"
              type="button"
              onClick={() => void loadOlderMessages()}
              disabled={isLoadingOlder}
            >
              {isLoadingOlder ? t.chat.loadingEarlier : t.chat.loadEarlier}
            </button>
          )}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const needsDateDivider = !previous || dateKey(previous.createdAt, locale) !== dateKey(message.createdAt, locale);
            const mine = message.senderId === initialData.currentUserId;
            const systemMessage = message.type !== "text";
            const action = systemMessage ? getSystemAction(message.metadata) : null;
            const systemTitle = systemMessage ? getSystemTitle(message.metadata) : null;

            return (
              <div key={message.id}>
                {needsDateDivider && (
                  <div className="flex items-center justify-center mt-4 mb-3 text-[#64748b] text-[0.72rem] before:content-[''] before:w-[46px] before:h-px before:bg-[#dbe4ee] before:mr-[0.6rem] after:content-[''] after:w-[46px] after:h-px after:bg-[#dbe4ee] after:ml-[0.6rem]">
                    {dateKey(message.createdAt, locale)}
                  </div>
                )}
                <div
                  className={`flex my-[0.35rem] ${
                    systemMessage ? "justify-center" : mine ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={
                      systemMessage
                        ? "flex max-w-[min(86%,620px)] flex-col items-center gap-[0.42rem]"
                        : `flex max-w-[min(78%,570px)] items-end gap-[0.42rem] ${
                            mine ? "flex-row-reverse" : "flex-row"
                          }`
                    }
                  >
                    <div
                      className={`text-[0.9rem] leading-[1.48] whitespace-pre-wrap ${
                        message.failed
                          ? "border border-[#fca5a5]"
                          : systemMessage
                            ? "border border-[#fcd34d]"
                            : "border-0"
                      } ${
                        systemMessage
                          ? "rounded-[14px]"
                          : mine
                            ? "rounded-[16px_16px_4px_16px]"
                            : "rounded-[16px_16px_16px_4px]"
                      } ${
                        message.failed
                          ? "bg-[#fef2f2]"
                          : systemMessage
                            ? "bg-[#fffbeb]"
                            : mine
                              ? "bg-[#0f172a]"
                              : "bg-white"
                      } ${
                        systemMessage ? "py-[0.7rem] px-[0.8rem]" : "py-[0.62rem] px-[0.76rem]"
                      } ${mine ? "text-white" : "text-[#1e293b]"} ${
                        mine || systemMessage
                          ? "shadow-none"
                          : "shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                      }`}
                    >
                      {systemTitle && (
                        <h3 className="mt-0 mx-0 mb-[0.24rem] text-[#78350f] text-[0.86rem] font-[850] leading-[1.35]">
                          {systemTitle}
                        </h3>
                      )}
                      {message.body}
                      {message.failed && (
                        <div className="mt-1 text-[#b91c1c] text-[0.7rem] font-bold">
                          {t.chat.messageFailed}
                        </div>
                      )}
                      {action && (
                        <Link
                          className="inline-flex mt-[0.52rem] rounded-lg bg-[#f59e0b] py-[0.34rem] px-[0.55rem] text-[#451a03] text-[0.76rem] font-extrabold no-underline hover:bg-[#fbbf24] hover:text-[#451a03] hover:no-underline"
                          href={action.url}
                        >
                          {action.label}
                        </Link>
                      )}
                    </div>
                    <time
                      className="flex-none pb-[0.16rem] text-[#94a3b8] text-[0.67rem] tabular-nums whitespace-nowrap"
                      dateTime={message.createdAt}
                    >
                      {timeLabel(message.createdAt, locale)}
                    </time>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isSystem || messagingStatus !== "available" ? (
          <div
            className={`border-t border-[#e2e8f0] py-[0.9rem] px-4 text-[0.84rem] text-center ${
              messagingStatus === "blocked_by_me"
                ? "bg-[#fffbeb] text-[#92400e]"
                : "bg-[#f8fafc] text-[#64748b]"
            }`}
          >
            {statusNotice}
          </div>
        ) : (
          <div className="border-t border-[#e2e8f0] bg-white p-[0.8rem]">
            <form
              className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-[0.65rem]"
              onSubmit={handleSubmit}
            >
              <textarea
                className="min-h-[42px] max-h-[120px] w-full resize-y border border-[#cbd5e1] rounded-xl bg-white py-[0.65rem] px-[0.72rem] text-[#0f172a] text-[0.9rem] leading-[1.35] focus:outline-2 focus:outline-solid focus:outline-[#94a3b8] focus:outline-offset-1 disabled:bg-[#f8fafc] disabled:cursor-not-allowed"
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
                onKeyDown={handleComposerKeyDown}
                placeholder={t.chat.composerPlaceholder}
                aria-label={t.chat.composerPlaceholder}
                maxLength={4000}
                disabled={isSending}
                rows={1}
              />
              <button
                className="grid w-[42px] h-[42px] place-items-center border-0 rounded-xl bg-[#0f172a] text-white cursor-pointer [&:hover:not(:disabled)]:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:w-[18px] [&_svg]:h-[18px]"
                type="submit"
                disabled={!isSendEnabled}
                aria-label={t.chat.send}
              >
                <PaperAirplaneIcon />
              </button>
            </form>
            <div className="mt-[0.45rem] text-[#94a3b8] text-[0.7rem]">{t.chat.composerHint}</div>
          </div>
        )}
        {error && (
          <div className="mt-[0.55rem] mx-0 mb-0 text-[#b91c1c] text-[0.76rem] text-center" role="alert">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}
