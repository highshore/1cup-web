import { supabase } from "../../../supabase/client";
import {
  type ChatMessage,
  type ConversationSummary,
  type MessagingStatus,
  isMessagingStatus,
  toChatMessage,
  toConversationSummary,
} from "../types";

export const CHAT_MESSAGE_PAGE_SIZE = 50;

export type MessageCursor = Pick<ChatMessage, "id" | "createdAt">;

function requireMessage(value: unknown): ChatMessage {
  const message = toChatMessage(value);
  if (!message) throw new Error("The server returned an invalid message.");
  return message;
}

export async function getOrCreateDM(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_dm", {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("The server returned an invalid conversation.");
  return data;
}

export async function getOrCreateSystemConversation(): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_system_conversation");
  if (error) throw error;
  if (typeof data !== "string") throw new Error("The server returned an invalid conversation.");
  return data;
}

export async function getSystemNotifications(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, body, metadata, created_at")
    .eq("conversation_id", conversationId)
    .in("type", ["system", "meetup"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw error;

  const messages = (data ?? [])
    .map(toChatMessage)
    .filter((message): message is ChatMessage => message !== null)
    .reverse();

  if (messages.length === 0) return messages;

  const { data: reads, error: readsError } = await supabase
    .from("notification_reads")
    .select("message_id, read_at")
    .in(
      "message_id",
      messages.map((message) => message.id),
    );
  if (readsError) throw readsError;

  const readAtByMessageId = new Map(
    (reads ?? []).flatMap((row) =>
      typeof row.message_id === "string" && typeof row.read_at === "string"
        ? [[row.message_id, row.read_at] as const]
        : [],
    ),
  );

  return messages.map((message) => ({
    ...message,
    readAt: readAtByMessageId.get(message.id) ?? null,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc("notification_unread_count");
  if (error) throw error;
  return typeof data === "number" && Number.isFinite(data) ? Math.max(0, data) : 0;
}

export async function markNotificationRead(messageId: string): Promise<void> {
  const { error } = await supabase.from("notification_reads").insert({
    message_id: messageId,
  });
  if (error && error.code !== "23505") throw error;
}

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc("chat_conversation_summaries");
  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(toConversationSummary)
    .filter((summary): summary is ConversationSummary => summary !== null);
}

export async function getMessagingStatus(conversationId: string): Promise<MessagingStatus> {
  const { data, error } = await supabase.rpc("get_dm_messaging_status", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return isMessagingStatus(data) ? data : "unavailable";
}

export async function blockMember(currentUserId: string, otherUserId: string): Promise<void> {
  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: currentUserId,
    blocked_user_id: otherUserId,
  });
  if (error) throw error;
}

export async function unblockMember(currentUserId: string, otherUserId: string): Promise<void> {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", currentUserId)
    .eq("blocked_user_id", otherUserId);
  if (error) throw error;
}

export async function sendTextMessage({
  conversationId,
  senderId,
  body,
}: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type: "text",
      body,
    })
    .select("id, conversation_id, sender_id, type, body, metadata, created_at")
    .single();
  if (error) throw error;
  return requireMessage(data);
}

export async function fetchOlderMessages(
  conversationId: string,
  cursor: MessageCursor | null,
): Promise<ChatMessage[]> {
  let query = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, body, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_MESSAGE_PAGE_SIZE);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .map(toChatMessage)
    .filter((message): message is ChatMessage => message !== null)
    .reverse();
}
