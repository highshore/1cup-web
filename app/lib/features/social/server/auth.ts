// Server-only: resolves the signed-in admin for /api/admin/social.
import { createServerClientRSC } from "../../../supabase/server";
import { SocialPostError } from "./daily_posts";

export async function requireAdminUid(): Promise<string> {
  const client = await createServerClientRSC();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) throw new SocialPostError("Authentication is required.", 401);

  const { data, error } = await client.rpc("current_user_row");
  if (error) throw new SocialPostError("Unable to verify administrator access.", 500);
  const profile = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const uid = typeof profile?.uid === "string" ? profile.uid : "";
  if (!uid || profile?.account_status !== "admin") throw new SocialPostError("Administrator access is required.", 403);
  return uid;
}
