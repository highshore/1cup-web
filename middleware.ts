// Refreshes the Supabase auth session on every request that carries one.
//
// A request with no auth cookie does no auth work at all, so public reads — Meetup,
// Leaderboard, Blog, public profiles — still cannot be made slow or offline by the auth
// provider. What changed is that being signed in no longer depends on which page you
// happen to be reading.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isSupabaseAuthCookie = (name: string) =>
  name.startsWith("sb-") && name.includes("-auth-token");

// Only the first of these means the session is genuinely gone. refresh_token_already_used
// is what a rotation race looks like: the browser refreshed, rotating the token, and a
// server request that was already in flight presented the previous one. The reuse window
// is 10 seconds, so this is ordinary rather than rare — and clearing every auth cookie
// over it signs out a member whose session is perfectly healthy. If the session really is
// dead, the next request says refresh_token_not_found and this fires then.
const isDeadSessionError = (error: { code?: string } | null) =>
  error?.code === "refresh_token_not_found";

// The point of skipping was to keep anonymous traffic from making an auth-server call
// per page and per asset. It was written as a list of public routes, which quietly made
// it something else: /meetup, /leaderboard and /blog are where signed-in members spend
// their time, so a member could browse for an hour and never have their session
// refreshed. An access token lasts an hour, and the first request after that renders
// them signed out.
//
// The condition that was actually wanted is "is anyone signed in", and a request either
// carries an auth cookie or it does not. Anonymous visitors still cost nothing, on every
// route rather than a hand-maintained few, and a member's session is refreshed wherever
// they happen to be.
function canSkipAuthRefresh(request: NextRequest) {
  return !request.cookies.getAll().some(({ name }) => isSupabaseAuthCookie(name));
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
        setAll(list, headers) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims validates the JWT signature locally (after the signing key is cached)
  // instead of making a network /auth/v1/user request for every page navigation.
  // This matters especially when the same member is signed in on desktop + mobile:
  // each browser keeps its own valid Supabase session and should not contend on a
  // redundant auth-server validation request for every asset and route.
  const { error } = await supabase.auth.getClaims();
  if (error?.code === "refresh_token_already_used") {
    // Left in the log rather than acted on: if these turn out to be frequent, the reuse
    // interval is too tight for how often the client and the edge both refresh.
    console.warn("[auth] refresh token rotation race, session left intact", {
      path: request.nextUrl.pathname,
    });
  }
  if (isDeadSessionError(error)) {
    console.warn("[auth] refresh token gone, clearing cookies", {
      path: request.nextUrl.pathname,
      code: error?.code,
    });
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
    // Skip static images, fonts, audio and video. The previous matcher still ran
    // auth validation for homepage/blog MP4s, creating a burst of needless /user
    // calls during mobile sign-in and simultaneous-device browsing.
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mp3|wav|ogg|m4a|woff|woff2|ttf|otf)$).*)",
  ],
};
