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
  // public.users.uid is the Firebase-style id. One person can own several auth users
  // (phone OTP and Kakao each create their own), so resolve through the identity link
  // table first and only fall back to the legacy users.auth_id column.
  const a = admin();
  const { data: link } = await a
    .from("user_auth_identities")
    .select("uid")
    .eq("auth_id", data.user.id)
    .maybeSingle();
  if (link?.uid) return link.uid as string;
  const { data: row } = await a.from("users").select("uid").eq("auth_id", data.user.id).maybeSingle();
  return row?.uid ?? data.user.id;
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

// Same length or not, compare every byte. A plain === on a secret leaks its prefix
// through response timing, and these actions charge cards.
function secretsMatch(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// pg_cron invokes scheduled Edge Function actions with a bearer token. Those actions
// must not be reachable by arbitrary public callers just because the same function also
// serves a public webhook or user request.
//
// Two secrets are accepted, and the second one is the point. Tying scheduler auth to
// SUPABASE_SERVICE_ROLE_KEY alone meant the platform key and the schedulers had to be
// changed in lockstep: on 2026-08-23 that key was moved to the new sb_secret_ format,
// the pg_cron jobs kept presenting the legacy JWT, and every scheduled action started
// answering 403. Nothing surfaced it — recurring billing was rejected for two days and
// two members went uncharged. SCHEDULER_SECRET decouples the two, so a future key
// migration cannot silently cut the schedulers off again.
//
// Only these two names are consulted. Walking a bundle like SUPABASE_SECRET_KEYS to find
// something that fits would risk honouring a publishable key, which is public.
const SCHEDULER_SECRET_ENV_NAMES = [
  "SCHEDULER_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function hasServiceRoleAuthorization(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const presented = header.slice("Bearer ".length);
  if (presented.length === 0) return false;

  // Check all of them rather than returning on the first hit, so how long this takes
  // says nothing about which secret matched.
  let authorized = false;
  for (const name of SCHEDULER_SECRET_ENV_NAMES) {
    const expected = Deno.env.get(name);
    if (!expected) continue;
    if (secretsMatch(presented, expected)) authorized = true;
  }
  return authorized;
}
