// Browser-side Supabase client (replaces app/lib/firebase/firebase.ts on the client).
// Uses @supabase/ssr so the auth session is stored in cookies and shared with the server.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Built lazily. createBrowserClient throws when the env vars are missing, and the root
// layout pulls this module into every page, so constructing it at import time made
// `next build` fail while prerendering — even for pages that never touch Supabase.
// Deferring to first use keeps the build independent of runtime secrets while still
// failing loudly if a real request comes in without configuration.
let browserClient: SupabaseClient | null = null;

function getBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}

// Proxy so call sites keep using `supabase.from(...)` unchanged.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getBrowserClient(), prop, receiver);
  },
});

// Edge Functions base URL (replaces Firebase httpsCallable region client).
export const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

// Invoke a deployed Edge Function with the caller's session (replaces httpsCallable).
export async function invokeFunction<T = unknown>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body ?? {} });
  if (error) throw error;
  return data as T;
}
