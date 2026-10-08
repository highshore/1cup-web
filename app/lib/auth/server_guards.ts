// Server-side page guards. These run before any HTML is sent, so a signed-out visitor or
// a non-admin is redirected without first seeing a loading screen (or the page itself)
// flash past. middleware.ts has already refreshed the session cookie by the time a Server
// Component runs, so reading it here does not race the browser's own token refresh.
//
// These gate navigation only. Data access is still enforced by RLS and the Edge Functions.
import { redirect } from "next/navigation";

import { createServerClientRSC } from "../supabase/server";

// Only same-site paths are carried through sign-in, so the return target can never send
// someone to another origin ("//evil.example" and absolute URLs are dropped).
function authUrl(returnTo?: string) {
  const sameSite = returnTo?.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\");
  return sameSite ? `/auth?redirect=${encodeURIComponent(returnTo!)}` : "/auth";
}

async function readSession() {
  const supabase = await createServerClientRSC();
  // getClaims verifies the JWT locally once the signing key is cached, the same check
  // middleware uses, instead of an Auth-server round trip per navigation.
  const { data } = await supabase.auth.getClaims();
  const authId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, authId };
}

// Same profile lookup the browser AuthProvider uses, so both sides agree on who this is.
async function currentUserRow(supabase: Awaited<ReturnType<typeof createServerClientRSC>>) {
  const { data: rows, error } = await supabase.rpc("current_user_row");
  if (error) console.error("[auth] current_user_row failed in server guard:", error.message);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return (row ?? null) as { uid?: string; account_status?: string } | null;
}

/** Redirects to /auth (returning to `returnTo` after sign-in) unless signed in. No DB call. */
export async function requireSignedIn(returnTo: string) {
  const { authId } = await readSession();
  if (!authId) redirect(authUrl(returnTo));
}

/** Like requireSignedIn, and resolves the member's app uid (users.uid), which differs
 *  from the auth id for migrated accounts. Falls back to the auth id, as AuthProvider does. */
export async function requireSignedInUid(returnTo: string): Promise<string> {
  const { supabase, authId } = await readSession();
  if (!authId) redirect(authUrl(returnTo));
  const row = await currentUserRow(supabase);
  return row?.uid ?? authId;
}

/** Redirects signed-out visitors to /auth and signed-in non-admins to /. */
export async function requireAdmin() {
  const { supabase, authId } = await readSession();
  if (!authId) redirect(authUrl());
  const row = await currentUserRow(supabase);
  if (row?.account_status !== "admin") redirect("/");
}
