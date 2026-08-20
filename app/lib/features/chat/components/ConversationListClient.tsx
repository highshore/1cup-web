"use client";

import Link from "next/link";
import styled from "styled-components";

import { appLayout } from "../../../constants/app_layout";
import { useI18n } from "../../../i18n/I18nProvider";
import type { ConversationSummary } from "../types";

const Page = styled.main`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
  padding: 1.75rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 640px) {
    padding: 1.2rem ${appLayout.pageGutterMobile} 3rem;
  }
`;

const Header = styled.header`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.15rem;
`;

const Title = styled.h1`
  margin: 0;
  color: #0f172a;
  font-size: clamp(1.65rem, 4vw, 2.1rem);
  font-weight: 850;
  letter-spacing: -0.04em;
`;

const Subtitle = styled.p`
  margin: 0.35rem 0 0;
  color: #64748b;
  font-size: 0.94rem;
`;

const ConversationPanel = styled.section`
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.07);
`;

const ConversationLink = styled(Link)`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  border-bottom: 1px solid #edf2f7;
  padding: 1rem 1.1rem;
  color: inherit;
  text-decoration: none;
  transition: background-color 140ms ease;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: #f8fafc;
  }

  @media (max-width: 640px) {
    gap: 0.7rem;
    padding: 0.9rem;
  }
`;

const Avatar = styled.div<{ $system?: boolean }>`
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: ${({ $system }) => ($system ? "#fef3c7" : "#e2e8f0")};
  color: ${({ $system }) => ($system ? "#92400e" : "#334155")};
  font-size: ${({ $system }) => ($system ? "1.35rem" : "1rem")};
  font-weight: 800;
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ConversationBody = styled.div`
  min-width: 0;
`;

const ConversationName = styled.div`
  overflow: hidden;
  color: #0f172a;
  font-size: 0.96rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Preview = styled.div`
  overflow: hidden;
  margin-top: 0.24rem;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Timestamp = styled.time`
  align-self: start;
  padding-top: 0.15rem;
  color: #94a3b8;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
`;

const EmptyState = styled.div`
  padding: 3.5rem 1.2rem;
  color: #64748b;
  text-align: center;
`;

function formatConversationTime(value: string, locale: "en" | "ko"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        month: "short",
        day: "numeric",
      }).format(date);
}

export default function ConversationListClient({
  initialConversations,
}: {
  initialConversations: ConversationSummary[];
}) {
  const { locale, t } = useI18n();

  return (
    <Page>
      <Header>
        <div>
          <Title>{t.chat.title}</Title>
          <Subtitle>{t.chat.listSubtitle}</Subtitle>
        </div>
      </Header>

      <ConversationPanel>
        {initialConversations.length === 0 ? (
          <EmptyState>{t.chat.empty}</EmptyState>
        ) : (
          initialConversations.map((conversation) => {
            const isSystem = conversation.conversationType === "system";
            const displayName = isSystem
              ? "☕ 1 Cup English"
              : conversation.otherDisplayName || t.chat.memberFallback;
            const preview = conversation.latestMessage?.body || t.chat.noMessages;
            const timestamp = conversation.latestMessage?.createdAt || conversation.conversationUpdatedAt;

            return (
              <ConversationLink
                key={conversation.conversationId}
                href={`/messages/${conversation.conversationId}`}
              >
                <Avatar $system={isSystem} aria-hidden="true">
                  {isSystem ? (
                    "☕"
                  ) : conversation.otherPhotoUrl ? (
                    <AvatarImage
                      src={conversation.otherPhotoUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </Avatar>
                <ConversationBody>
                  <ConversationName>{displayName}</ConversationName>
                  <Preview>{preview}</Preview>
                </ConversationBody>
                <Timestamp dateTime={timestamp}>
                  {formatConversationTime(timestamp, locale)}
                </Timestamp>
              </ConversationLink>
            );
          })
        )}
      </ConversationPanel>
    </Page>
  );
}

