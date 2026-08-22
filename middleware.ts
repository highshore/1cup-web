// Refreshes the Supabase auth session on every request so Server Components and
// Route Handlers see a valid session (required by @supabase/ssr).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isSupabaseAuthCookie = (name: string) =>
  name.startsWith("sb-") && name.includes("-auth-token");

const isInvalidRefreshTokenError = (error: { code?: string } | null) =>
  error?.code === "refresh_token_not_found" ||
  error?.code === "refresh_token_already_used";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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

  // Touch the session so expired tokens refresh into the cookies. If a browser
  // carries a refresh token that Supabase has already invalidated, clear only
  // the Supabase auth cookies and let the request continue as signed out. This
  // prevents public pages from appearing broken because of a stale session.
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
  // run on everything except static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
