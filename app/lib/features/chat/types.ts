export type ConversationType = "dm" | "system" | "group";
export type ChatMessageType = "text" | "system" | "meetup";
export type MessagingStatus = "available" | "blocked_by_me" | "unavailable";

export type ChatMetadata = Record<string, unknown>;

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: ChatMessageType;
  body: string;
  metadata: ChatMetadata;
  createdAt: string;
  readAt?: string | null;
  optimistic?: boolean;
  failed?: boolean;
}

export interface ConversationSummary {
  conversationId: string;
  conversationType: Extract<ConversationType, "dm" | "system">;
  conversationCreatedAt: string;
  conversationUpdatedAt: string;
  otherUserId: string | null;
  otherDisplayName: string | null;
  otherPhotoUrl: string | null;
  latestMessage: Pick<ChatMessage, "id" | "body" | "type" | "metadata" | "createdAt"> | null;
}

export interface ChatRoomInitialData {
  conversationId: string;
  conversationType: Extract<ConversationType, "dm" | "system">;
  currentUserId: string;
  otherMember: {
    id: string;
    displayName: string;
    photoUrl: string | null;
  } | null;
  messages: ChatMessage[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableStringValue(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : null;
}

function isMessageType(value: unknown): value is ChatMessageType {
  return value === "text" || value === "system" || value === "meetup";
}

function isConversationType(value: unknown): value is ConversationType {
  return value === "dm" || value === "system" || value === "group";
}

export function toChatMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;

  const id = stringValue(value.id);
  const conversationId = stringValue(value.conversation_id);
  const body = stringValue(value.body);
  const createdAt = stringValue(value.created_at);
  const senderId = nullableStringValue(value.sender_id);
  const type = value.type;

  if (!id || !conversationId || !body || !createdAt || !isMessageType(type)) {
    return null;
  }

  return {
    id,
    conversationId,
    senderId,
    type,
    body,
    metadata: isRecord(value.metadata) ? value.metadata : {},
    createdAt,
  };
}

export function toConversationSummary(value: unknown): ConversationSummary | null {
  if (!isRecord(value)) return null;

  const conversationId = stringValue(value.conversation_id);
  const conversationCreatedAt = stringValue(value.conversation_created_at);
  const conversationUpdatedAt = stringValue(value.conversation_updated_at);

  if (
    !conversationId ||
    !conversationCreatedAt ||
    !conversationUpdatedAt ||
    !isConversationType(value.conversation_type) ||
    value.conversation_type === "group"
  ) {
    return null;
  }

  const latestMessageId = stringValue(value.latest_message_id);
  const latestBody = stringValue(value.latest_body);
  const latestCreatedAt = stringValue(value.latest_created_at);
  const latestType = value.latest_type;
  const hasLatestMessage =
    Boolean(latestMessageId) &&
    Boolean(latestBody) &&
    Boolean(latestCreatedAt) &&
    isMessageType(latestType);

  return {
    conversationId,
    conversationType: value.conversation_type,
    conversationCreatedAt,
    conversationUpdatedAt,
    otherUserId: nullableStringValue(value.other_user_id),
    otherDisplayName: nullableStringValue(value.other_display_name),
    otherPhotoUrl: nullableStringValue(value.other_photo_url),
    latestMessage: hasLatestMessage
      ? {
          id: latestMessageId!,
          body: latestBody!,
          type: latestType,
          metadata: isRecord(value.latest_metadata) ? value.latest_metadata : {},
          createdAt: latestCreatedAt!,
        }
      : null,
  };
}

export function isMessagingStatus(value: unknown): value is MessagingStatus {
  return value === "available" || value === "blocked_by_me" || value === "unavailable";
}

export function getSystemAction(metadata: ChatMetadata): {
  label: string;
  url: string;
} | null {
  const label = stringValue(metadata.actionLabel);
  const url = stringValue(metadata.actionUrl);

  if (!label || !url || !url.startsWith("/")) return null;
  return { label, url };
}

export function getSystemTitle(metadata: ChatMetadata): string | null {
  const title = stringValue(metadata.title)?.trim();
  return title || null;
}
