import "server-only";

import { admin } from "../../../supabase/server";

export type SystemMessageType = "system" | "meetup";

export async function sendSystemMessage({
  userId,
  type,
  body,
  metadata = {},
}: {
  userId: string;
  type: SystemMessageType;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await admin().rpc("send_system_message", {
    p_user_id: userId,
    p_type: type,
    p_body: body,
    p_metadata: metadata,
  });

  if (error) throw error;
  if (typeof data !== "string") {
    throw new Error("The server returned an invalid system message.");
  }
  return data;
}

