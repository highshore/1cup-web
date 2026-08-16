// Service-role Supabase client (bypasses RLS, like the old Firebase Admin SDK).
// Also exposes the user-scoped client for auth checks.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Resolve the calling user from the Authorization: Bearer <jwt> header.
export async function callerUid(req: Request): Promise<string | null> {
  const authz = req.headers.get("Authorization");
  if (!authz) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authz } }, auth: { persistSession: false } },
  );
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  // public.users.uid is the Firebase-style id; resolve via the auth_id link column.
  const a = admin();
  const { data: row } = await a.from("users").select("uid").eq("auth_id", data.user.id).maybeSingle();
  return row?.uid ?? data.user.id;
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
