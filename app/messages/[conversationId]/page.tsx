import { notFound, redirect } from "next/navigation";

import ChatRoomClient from "../../lib/features/chat/components/ChatRoomClient";
import { toChatMessage } from "../../lib/features/chat/types";
import { createServerClientRSC } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

type ConversationRow = {
  id: string;
  type: string;
};

type MemberRow = {
  user_id: string;
};

type PublicUserRow = {
  uid: string;
  display_name: string | null;
  photo_url: string | null;
};

export default async function ConversationPage({ params }: RouteContext) {
  const { conversationId } = await params;
  const supabase = await createServerClientRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?redirect=${encodeURIComponent(`/messages/${conversationId}`)}`);
  }

  const { data: currentUserId, error: currentUserError } = await supabase.rpc(
    "current_uid",
  );
  if (currentUserError || typeof currentUserId !== "string") redirect("/auth?redirect=%2Fmessages");

  const { data: rawConversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, type")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError || !rawConversation) notFound();
  const conversation = rawConversation as unknown as ConversationRow;
  if (conversation.type !== "dm" && conversation.type !== "system") notFound();

  const { data: rawMessages, error: messagesError } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, body, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (messagesError) throw messagesError;

  let otherMember: {
    id: string;
    displayName: string;
    photoUrl: string | null;
  } | null = null;

  if (conversation.type === "dm") {
    const { data: rawMembers, error: membersError } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);
    if (membersError) throw membersError;

    const otherMemberId = (rawMembers as unknown as MemberRow[] | null)
      ?.find((member) => member.user_id !== currentUserId)?.user_id;

    if (!otherMemberId) notFound();

    const { data: rawMemberProfile, error: memberProfileError } = await supabase
      .from("public_users")
      .select("uid, display_name, photo_url")
      .eq("uid", otherMemberId)
      .maybeSingle();
    if (memberProfileError) throw memberProfileError;

    const memberProfile = rawMemberProfile as unknown as PublicUserRow | null;
    otherMember = {
      id: otherMemberId,
      displayName: memberProfile?.display_name || `Member ${otherMemberId.slice(0, 6)}`,
      photoUrl: memberProfile?.photo_url || null,
    };
  }

  const messages = (rawMessages ?? [])
    .map(toChatMessage)
    .filter((message) => message !== null)
    .reverse();

  return (
    <ChatRoomClient
      initialData={{
        conversationId,
        conversationType: conversation.type,
        currentUserId,
        otherMember,
        messages,
      }}
    />
  );
}

