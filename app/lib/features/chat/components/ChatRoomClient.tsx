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
import styled from "styled-components";

import { appLayout } from "../../../constants/app_layout";
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

const Page = styled.main`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  min-height: calc(100vh - 120px);
  margin: 0 auto;
  padding: 1.4rem ${appLayout.pageGutterDesktop} 3.5rem;

  @media (max-width: 640px) {
    min-height: calc(100vh - 100px);
    padding: 0.8rem ${appLayout.pageGutterMobile} 1.25rem;
  }
`;

const ChatShell = styled.section`
  display: grid;
  grid-template-rows: auto minmax(420px, 1fr) auto;
  min-height: min(720px, calc(100vh - 175px));
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #f8fafc;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08);

  @media (max-width: 640px) {
    min-height: calc(100vh - 120px);
    border-radius: 16px;
  }
`;

const Header = styled.header`
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.8rem 1rem;
`;

const HeaderAvatar = styled.div<{ $system?: boolean }>`
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: ${({ $system }) => ($system ? "#fef3c7" : "#e2e8f0")};
  color: ${({ $system }) => ($system ? "#92400e" : "#334155")};
  font-size: ${({ $system }) => ($system ? "1.2rem" : "0.95rem")};
  font-weight: 800;
`;

const HeaderAvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const HeaderText = styled.div`
  min-width: 0;
  flex: 1;
`;

const HeaderName = styled.div`
  overflow: hidden;
  color: #0f172a;
  font-size: 0.96rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HeaderSub = styled.div`
  overflow: hidden;
  margin-top: 0.13rem;
  color: #64748b;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProfileLink = styled(Link)`
  color: inherit;
  text-decoration: none;

  &:hover ${HeaderName} {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const MenuWrap = styled.div`
  position: relative;
`;

const MenuButton = styled.button`
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #475569;
  cursor: pointer;

  &:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  svg {
    width: 21px;
    height: 21px;
  }
`;

const Menu = styled.div`
  position: absolute;
  z-index: 2;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 145px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.3rem;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.16);
`;

const MenuAction = styled.button<{ $danger?: boolean }>`
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 0.58rem 0.65rem;
  color: ${({ $danger }) => ($danger ? "#b91c1c" : "#334155")};
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${({ $danger }) => ($danger ? "#fef2f2" : "#f8fafc")};
  }
`;

const MessageViewport = styled.div`
  overflow-y: auto;
  padding: 1rem;
`;

const LoadEarlierButton = styled.button`
  display: block;
  margin: 0 auto 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.45rem 0.8rem;
  color: #475569;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 750;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: #94a3b8;
    color: #0f172a;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.65;
  }
`;

const DateDivider = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1rem 0 0.75rem;
  color: #64748b;
  font-size: 0.72rem;

  &::before,
  &::after {
    width: 46px;
    height: 1px;
    background: #dbe4ee;
    content: "";
  }

  &::before {
    margin-right: 0.6rem;
  }

  &::after {
    margin-left: 0.6rem;
  }
`;

const MessageRow = styled.div<{ $mine: boolean; $system: boolean }>`
  display: flex;
  justify-content: ${({ $mine, $system }) => ($system ? "center" : $mine ? "flex-end" : "flex-start")};
  margin: 0.35rem 0;
`;

const MessageStack = styled.div<{ $mine: boolean; $system: boolean }>`
  display: flex;
  max-width: min(78%, 570px);
  align-items: flex-end;
  gap: 0.42rem;
  flex-direction: ${({ $mine }) => ($mine ? "row-reverse" : "row")};

  ${({ $system }) =>
    $system && `
      max-width: min(86%, 620px);
      flex-direction: column;
      align-items: center;
    `}
`;

const Bubble = styled.div<{ $mine: boolean; $system: boolean; $failed?: boolean }>`
  border: ${({ $system, $failed }) =>
    $failed ? "1px solid #fca5a5" : $system ? "1px solid #fcd34d" : "0"};
  border-radius: ${({ $mine, $system }) =>
    $system ? "14px" : $mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px"};
  background: ${({ $mine, $system, $failed }) =>
    $failed ? "#fef2f2" : $system ? "#fffbeb" : $mine ? "#0f172a" : "#ffffff"};
  padding: ${({ $system }) => ($system ? "0.7rem 0.8rem" : "0.62rem 0.76rem")};
  color: ${({ $mine }) => ($mine ? "#ffffff" : "#1e293b")};
  font-size: 0.9rem;
  line-height: 1.48;
  white-space: pre-wrap;
  box-shadow: ${({ $mine, $system }) =>
    $mine || $system ? "none" : "0 1px 2px rgba(15, 23, 42, 0.06)"};
`;

const FailedText = styled.div`
  margin-top: 0.25rem;
  color: #b91c1c;
  font-size: 0.7rem;
  font-weight: 700;
`;

const Timestamp = styled.time`
  flex: 0 0 auto;
  padding-bottom: 0.16rem;
  color: #94a3b8;
  font-size: 0.67rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const SystemActionLink = styled(Link)`
  display: inline-flex;
  margin-top: 0.52rem;
  border-radius: 8px;
  background: #f59e0b;
  padding: 0.34rem 0.55rem;
  color: #451a03;
  font-size: 0.76rem;
  font-weight: 800;
  text-decoration: none;

  &:hover {
    background: #fbbf24;
  }
`;

const SystemMessageTitle = styled.h3`
  margin: 0 0 0.24rem;
  color: #78350f;
  font-size: 0.86rem;
  font-weight: 850;
  line-height: 1.35;
`;

const ComposerArea = styled.div`
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 0.8rem;
`;

const ComposerForm = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.65rem;
`;

const ComposerInput = styled.textarea`
  min-height: 42px;
  max-height: 120px;
  width: 100%;
  resize: vertical;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.65rem 0.72rem;
  color: #0f172a;
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.35;

  &:focus {
    outline: 2px solid #94a3b8;
    outline-offset: 1px;
  }

  &:disabled {
    background: #f8fafc;
    cursor: not-allowed;
  }
`;

const SendButton = styled.button`
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 0;
  border-radius: 12px;
  background: #0f172a;
  color: #ffffff;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #020617;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const ComposerHint = styled.div`
  margin-top: 0.45rem;
  color: #94a3b8;
  font-size: 0.7rem;
`;

const Notice = styled.div<{ $warning?: boolean }>`
  border-top: 1px solid #e2e8f0;
  background: ${({ $warning }) => ($warning ? "#fffbeb" : "#f8fafc")};
  padding: 0.9rem 1rem;
  color: ${({ $warning }) => ($warning ? "#92400e" : "#64748b")};
  font-size: 0.84rem;
  text-align: center;
`;

const InlineError = styled.div`
  margin: 0.55rem 0 0;
  color: #b91c1c;
  font-size: 0.76rem;
  text-align: center;
`;

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
    <Page>
      <ChatShell>
        <Header>
          <HeaderAvatar $system={isSystem} aria-hidden="true">
            {isSystem ? (
              "☕"
            ) : otherMember?.photoUrl ? (
              <HeaderAvatarImage
                src={otherMember.photoUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              headerName.charAt(0).toUpperCase()
            )}
          </HeaderAvatar>
          <HeaderText>
            {otherMember ? (
              <ProfileLink href={`/profile/${otherMember.id}`}>
                <HeaderName>{headerName}</HeaderName>
              </ProfileLink>
            ) : (
              <HeaderName>{headerName}</HeaderName>
            )}
            <HeaderSub>{isSystem ? t.chat.systemRoomLabel : t.chat.profileLinkHint}</HeaderSub>
          </HeaderText>
          {!isSystem && otherMember && (
            <MenuWrap>
              <MenuButton
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={t.chat.conversationMenu}
                aria-expanded={isMenuOpen}
              >
                <EllipsisHorizontalIcon />
              </MenuButton>
              {isMenuOpen && (
                <Menu>
                  <MenuAction
                    type="button"
                    $danger={messagingStatus !== "blocked_by_me"}
                    onClick={() => void changeBlockStatus()}
                  >
                    {messagingStatus === "blocked_by_me" ? t.chat.unblock : t.chat.block}
                  </MenuAction>
                </Menu>
              )}
            </MenuWrap>
          )}
        </Header>

        <MessageViewport ref={viewportRef} aria-live="polite">
          {hasMore && (
            <LoadEarlierButton type="button" onClick={() => void loadOlderMessages()} disabled={isLoadingOlder}>
              {isLoadingOlder ? t.chat.loadingEarlier : t.chat.loadEarlier}
            </LoadEarlierButton>
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
                {needsDateDivider && <DateDivider>{dateKey(message.createdAt, locale)}</DateDivider>}
                <MessageRow $mine={mine} $system={systemMessage}>
                  <MessageStack $mine={mine} $system={systemMessage}>
                    <Bubble $mine={mine} $system={systemMessage} $failed={message.failed}>
                      {systemTitle && <SystemMessageTitle>{systemTitle}</SystemMessageTitle>}
                      {message.body}
                      {message.failed && <FailedText>{t.chat.messageFailed}</FailedText>}
                      {action && <SystemActionLink href={action.url}>{action.label}</SystemActionLink>}
                    </Bubble>
                    <Timestamp dateTime={message.createdAt}>{timeLabel(message.createdAt, locale)}</Timestamp>
                  </MessageStack>
                </MessageRow>
              </div>
            );
          })}
        </MessageViewport>

        {isSystem || messagingStatus !== "available" ? (
          <Notice $warning={messagingStatus === "blocked_by_me"}>{statusNotice}</Notice>
        ) : (
          <ComposerArea>
            <ComposerForm onSubmit={handleSubmit}>
              <ComposerInput
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
                onKeyDown={handleComposerKeyDown}
                placeholder={t.chat.composerPlaceholder}
                aria-label={t.chat.composerPlaceholder}
                maxLength={4000}
                disabled={isSending}
                rows={1}
              />
              <SendButton type="submit" disabled={!isSendEnabled} aria-label={t.chat.send}>
                <PaperAirplaneIcon />
              </SendButton>
            </ComposerForm>
            <ComposerHint>{t.chat.composerHint}</ComposerHint>
          </ComposerArea>
        )}
        {error && <InlineError role="alert">{error}</InlineError>}
      </ChatShell>
    </Page>
  );
}
