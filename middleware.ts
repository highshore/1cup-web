// Refreshes the Supabase auth session where server-side auth is actually needed.
// Public read pages deliberately bypass auth refresh so a stale/slow auth provider
// can never make Meetup, Leaderboard, Blog, or public-profile reads look offline.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isSupabaseAuthCookie = (name: string) =>
  name.startsWith("sb-") && name.includes("-auth-token");

const isInvalidRefreshTokenError = (error: { code?: string } | null) =>
  error?.code === "refresh_token_not_found" ||
  error?.code === "refresh_token_already_used";

const PUBLIC_GET_PREFIXES = [
  "/meetup",
  "/leaderboard",
  "/blog",
  "/api/public-profile/",
  "/api/meetup/events",
  "/api/meetup/leaderboards",
  "/auth",
] as const;

function canSkipAuthRefresh(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const pathname = request.nextUrl.pathname;
  return PUBLIC_GET_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (canSkipAuthRefresh(request)) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.getUser();
  if (isInvalidRefreshTokenError(error)) {
    const staleAuthCookies = request.cookies
      .getAll()
      .filter(({ name }) => isSupabaseAuthCookie(name));

    staleAuthCookies.forEach(({ name }) => request.cookies.delete(name));
    response = NextResponse.next({ request });
    staleAuthCookies.forEach(({ name }) =>
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      }),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
