import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "onecup-kakao-oauth-state";
const REDIRECT_COOKIE = "onecup-kakao-oauth-redirect";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/profile";
  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) return "/";
  return value;
}

function getKakaoClientId() {
  return (
    process.env.NEXT_KAKAO_CLIENT_ID ??
    process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ??
    process.env.KAKAO_CLIENT_ID ??
    null
  );
}

function getKakaoClientSecret() {
  return (
    process.env.NEXT_KAKAO_CLIENT_SECRET ??
    process.env.NEXT_PUBLIC_KAKAO_CLIENT_SECRET ??
    process.env.KAKAO_CLIENT_SECRET ??
    null
  );
}

function getKakaoRedirectUri(origin: string) {
  return (
    process.env.NEXT_KAKAO_REDIRECT_URI ??
    process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ??
    process.env.KAKAO_REDIRECT_URI ??
    `${origin}/kakao_callback`
  );
}

function authError(origin: string, message: string) {
  const url = new URL("/auth", origin);
  url.searchParams.set("error", message);
  const response = NextResponse.redirect(url, 302);
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(REDIRECT_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

type KakaoTokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const oauthError =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  if (oauthError) return authError(origin, oauthError);

  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value ?? null;
  if (!code) return authError(origin, "카카오 로그인 코드가 없습니다.");
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    console.error("Direct Kakao OAuth state validation failed");
    return authError(origin, "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해주세요.");
  }

  const clientId = getKakaoClientId();
  const clientSecret = getKakaoClientSecret();
  if (!clientId) {
    console.error(
      "Direct Kakao OAuth callback is missing NEXT_KAKAO_CLIENT_ID/NEXT_PUBLIC_KAKAO_CLIENT_ID/KAKAO_CLIENT_ID",
    );
    return authError(origin, "카카오 로그인 설정을 확인해주세요.");
  }

  const redirectUri = getKakaoRedirectUri(origin);
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (clientSecret) tokenParams.set("client_secret", clientSecret);

  let tokenData: KakaoTokenResponse;
  try {
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: tokenParams,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    tokenData = (await tokenResponse.json()) as KakaoTokenResponse;
    if (!tokenResponse.ok || !tokenData.id_token || !tokenData.access_token) {
      console.error(
        "Kakao token exchange failed:",
        tokenResponse.status,
        tokenData.error ?? tokenData.error_description ?? "missing id/access token",
      );
      return authError(origin, "카카오 인증에 실패했습니다. 다시 시도해주세요.");
    }
  } catch (error) {
    console.error("Kakao token exchange request failed:", error);
    return authError(origin, "카카오 인증 서버에 연결하지 못했습니다. 다시 시도해주세요.");
  }

  const target = safeRedirect(request.cookies.get(REDIRECT_COOKIE)?.value ?? null);
  const response = NextResponse.redirect(new URL(target, origin), 302);
  response.headers.set("Cache-Control", "no-store");

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

  // Kakao owns the browser-facing OAuth flow. Supabase receives the verified
  // Kakao OIDC token only from this server route and mints the normal Supabase
  // session cookies, so the browser never needs to navigate to *.supabase.co.
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "kakao",
    token: tokenData.id_token,
    access_token: tokenData.access_token,
  });
  if (error || !data.session) {
    console.error("Supabase Kakao ID-token sign-in failed:", error?.message);
    return authError(origin, "로그인 세션을 만들지 못했습니다. 다시 시도해주세요.");
  }

  // Preserve the existing migration reconciliation for members whose original
  // account was phone-first. The Kakao access token is already available here,
  // so this also stays server-to-server.
  const { data: currentRows } = await supabase.rpc("current_user_row");
  const currentRow = Array.isArray(currentRows) ? currentRows[0] : currentRows;
  const shouldReconcile =
    !currentRow?.uid ||
    (String(currentRow.uid) === data.session.user.id && !currentRow.phone);

  if (shouldReconcile) {
    try {
      const reconciliation = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/kakao-login`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kakaoAccessToken: tokenData.access_token }),
          signal: AbortSignal.timeout(3_000),
        },
      );
      if (!reconciliation.ok) {
        console.error(
          "kakao-login reconciliation failed:",
          reconciliation.status,
          await reconciliation.text(),
        );
      }
    } catch (error) {
      console.warn("kakao-login reconciliation did not complete; continuing login", error);
    }
  }

  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(REDIRECT_COOKIE);
  return response;
}
