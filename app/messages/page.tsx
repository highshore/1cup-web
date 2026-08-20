import { redirect } from "next/navigation";

import ConversationListClient from "../lib/features/chat/components/ConversationListClient";
import { toConversationSummary } from "../lib/features/chat/types";
import { createServerClientRSC } from "../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MessagesPage() {
  const supabase = await createServerClientRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?redirect=%2Fmessages");

  const { error: systemRoomError } = await supabase.rpc(
    "get_or_create_system_conversation",
  );
  if (systemRoomError) throw systemRoomError;

  const { data, error } = await supabase.rpc("chat_conversation_summaries");
  if (error) throw error;

  const conversations = (Array.isArray(data) ? data : [])
    .map(toConversationSummary)
    .filter((summary) => summary !== null);

  return <ConversationListClient initialConversations={conversations} />;
}

