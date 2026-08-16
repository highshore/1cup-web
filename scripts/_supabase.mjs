// Shared service-role Supabase client for the operational scripts in this folder.
// Service role bypasses RLS, so these scripts can read/write anything — keep them
// local-only and never ship this key to the browser.
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
// (`vercel env pull .env.local` fills the rest, but both Supabase values are marked
// Sensitive in Vercel and have to be copied from the Supabase dashboard).
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const SUPABASE_URL = url;
