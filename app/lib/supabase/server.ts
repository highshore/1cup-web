// Server-side Supabase clients (replaces app/lib/firebase/firebaseAdmin.ts).
//   - createServerClientRSC(): request-scoped, respects the user's session (RLS applies).
//   - admin(): service-role, bypasses RLS (use ONLY in trusted server code / route handlers).
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// User-scoped client for Server Components / Route Handlers. Reads the session cookie.
export async function createServerClientRSC() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* called from a Server Component — middleware refreshes instead */ }
        },
      },
    },
  );
}

// Service-role client — bypasses RLS, like the old Firebase Admin SDK. Server-only.
export function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
