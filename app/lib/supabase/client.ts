// Browser-side Supabase client. All browser traffic stays on the first-party
// 1cupenglish.com origin and is reverse-proxied to Supabase by Next/Vercel.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROJECT_REF = "hetiycbotgjeluteicyk";
const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

let browserClient: SupabaseClient | null = null;

function getBrowserClient(): SupabaseClient {
  if (!browserClient) {
    if (typeof window === "undefined") {
      throw new Error("The browser Supabase client can only be created in the browser.");
    }

    browserClient = createBrowserClient(
      window.location.origin,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        // Keep the existing cookie/storage key even though the transport hostname
        // changes from *.supabase.co to 1cupenglish.com. This keeps browser and
        // server SSR clients on the same session instead of silently forking it.
        auth: { storageKey: AUTH_STORAGE_KEY },
        cookieOptions: { name: AUTH_STORAGE_KEY },
      },
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

// Edge Functions are browser-facing through the same-origin proxy as well.
export const FUNCTIONS_URL = "/functions/v1";

export async function invokeFunction<T = unknown>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body ?? {} });
  if (error) throw error;
  return data as T;
}
