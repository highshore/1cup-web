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
  if (error) {
    // supabase-js wraps non-2xx Edge Function responses in a generic
    // "Edge Function returned a non-2xx status code" error. Preserve the actual
    // JSON response from our functions so members see the actionable message/code.
    const context = (error as any)?.context;
    if (context && typeof context.clone === "function") {
      try {
        const response = context.clone();
        const payload = await response.json();
        const message =
          typeof payload?.message === "string" && payload.message.trim()
            ? payload.message.trim()
            : error.message;
        const detailed = new Error(message) as Error & {
          code?: string;
          status?: number;
        };
        if (typeof payload?.errorCode === "string") detailed.code = payload.errorCode;
        if (typeof context.status === "number") detailed.status = context.status;
        throw detailed;
      } catch (parseError) {
        // If we successfully created a detailed error above, keep it. Otherwise fall
        // through to the SDK error when the body is not JSON.
        if (
          parseError instanceof Error &&
          parseError.message !== "Unexpected end of JSON input" &&
          parseError.message !== "Unexpected token '<'"
        ) {
          const maybeDetailed = parseError as Error & { code?: string; status?: number };
          if (maybeDetailed.code || maybeDetailed.status) throw maybeDetailed;
        }
      }
    }
    throw error;
  }
  return data as T;
}
