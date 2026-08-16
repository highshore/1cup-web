// Shared CORS + response helpers for all Edge Functions.
// Mirrors the allowlist the old Cloud Functions used (functions/src/index.ts).
const ALLOWED = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://onecup.dev",
  "https://1cupenglish.com",
  "https://one-cup-eng.web.app",
  "https://one-cup-eng.firebaseapp.com",
];

// Vercel preview deployments of this project: the per-deploy URLs
// (one-cup-<hash>-1-cup-english.vercel.app) and the per-branch aliases
// (one-cup-eng-git-<branch>-1-cup-english.vercel.app). Without this, every browser
// call from a preview fails CORS even though the request itself is fine.
const PREVIEW_ORIGIN = /^https:\/\/one-cup[a-z0-9-]*-1-cup-english\.vercel\.app$/;

// Escape hatch for one-off origins, e.g. `supabase secrets set
// EXTRA_ALLOWED_ORIGINS="https://foo.vercel.app,https://bar.example"`.
const EXTRA = (Deno.env.get("EXTRA_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowed(origin: string): boolean {
  return ALLOWED.includes(origin) || EXTRA.includes(origin) || PREVIEW_ORIGIN.test(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  // Echo the origin only when it is allowed; otherwise fall back to the production
  // site, which simply makes the browser reject the response.
  const allow = origin && isAllowed(origin) ? origin : "https://1cupenglish.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) });
  }
  return null;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}
