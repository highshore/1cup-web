// OAuth callback — exchanges the PKCE `?code=` for a session.
//
// @supabase/ssr uses the PKCE flow, so the provider redirects back with a one-time
// `code` that has to be traded for a session. Nothing was doing that: redirectTo
// pointed at the /auth page, which only reads an existing session, so a Kakao sign-in
// landed on /auth?code=… and sat there. Doing the exchange here (rather than in the
// browser) also writes the session cookies the way Server Components expect, and it is
// the only place the Kakao access token is available.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Same rule as the /auth page: only same-origin paths, never bounce back to /auth.
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/profile";
  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const target = safeRedirect(searchParams.get("redirect"));

  // Provider-side failure (user cancelled, consent denied, …).
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent("로그인 코드가 없습니다.")}`);
  }

  const response = NextResponse.redirect(`${origin}${target}`);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    console.error("OAuth code exchange failed:", error?.message);
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent("로그인에 실패했습니다. 다시 시도해주세요.")}`,
    );
  }

  // Kakao's id_token carries `phone_verified` but not the number, so the
  // handle_new_user trigger cannot recognise a member who signed up by phone and has
  // no kakao_id on file. The provider access token can read the number from
  // kapi.kakao.com — hand it to the kakao-login hook, which links this identity to the
  // existing profile. Best-effort: the person is signed in either way.
  const { session } = data;
  if (session.provider_token && session.user.app_metadata?.provider === "kakao") {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/kakao-login`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kakaoAccessToken: session.provider_token }),
        },
      );
      if (!res.ok) console.error("kakao-login hook failed:", res.status, await res.text());
    } catch (e) {
      console.error("kakao-login hook error:", e);
    }
  }

  return response;
}
