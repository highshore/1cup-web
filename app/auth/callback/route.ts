// OAuth callback — exchange the PKCE code, then reconcile Kakao only when needed.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/profile";
  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) return "/";
  return value;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const target = safeRedirect(searchParams.get("redirect"));
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
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
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

  const { session } = data;
  if (session.provider_token && session.user.app_metadata?.provider === "kakao") {
    // The expensive Kakao reconciliation hook exists for migrated phone-first users.
    // Once an auth identity already resolves to a stable profile (uid != auth uuid),
    // or the trigger has already captured a phone, running that hook every login only
    // adds several DB round-trips and a Kakao API request to the redirect path.
    const { data: currentRows } = await supabase.rpc("current_user_row");
    const currentRow = Array.isArray(currentRows) ? currentRows[0] : currentRows;
    const shouldReconcile =
      !currentRow?.uid ||
      (String(currentRow.uid) === session.user.id && !currentRow.phone);

    if (shouldReconcile) {
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
            signal: AbortSignal.timeout(3_000),
          },
        );
        if (!res.ok) {
          console.error("kakao-login hook failed:", res.status, await res.text());
        }
      } catch (hookError) {
        if (isAbortError(hookError)) {
          console.warn("kakao-login hook exceeded 3s; continuing login without blocking");
        } else {
          console.error("kakao-login hook error:", hookError);
        }
      }
    }
  }

  return response;
}
