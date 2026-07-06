// Browser-side Supabase client (replaces app/lib/firebase/firebase.ts on the client).
// Uses @supabase/ssr so the auth session is stored in cookies and shared with the server.
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Edge Functions base URL (replaces Firebase httpsCallable region client).
export const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

// Invoke a deployed Edge Function with the caller's session (replaces httpsCallable).
export async function invokeFunction<T = unknown>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body ?? {} });
  if (error) throw error;
  return data as T;
}
