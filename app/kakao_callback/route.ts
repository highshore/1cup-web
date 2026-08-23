import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "onecup-kakao-oauth-state";
const REDIRECT_COOKIE = "onecup-kakao-oauth-redirect";
const SUPABASE_KAKAO_CLIENT_ID = "0caeab11362abda9d367a521bd18bc3d";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) return "/";
  return value;
}

function getKakaoClientId() {
  return process.env.KAKAO_DIRECT_CLIENT_ID ?? SUPABASE_KAKAO_CLIENT_ID;
}

function getKakaoClientSecret() {
  return process.env.KAKAO_DIRECT_CLIENT_SECRET ?? null;
}

function getKakaoRedirectUri(origin: string) {
  return process.env.KAKAO_DIRECT_REDIRECT_URI ?? `${origin}/kakao_callback`;
}

function authError(origin: string, message: string) {
  const url = new URL("/auth", origin);
  url.searchParams.set("error", message);
  const response = NextResponse.redirect(url, 302);
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(REDIRECT_COOKIE);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function readAudience(idToken: string): string[] | null {
  try {
    const encoded = idToken.split(".")[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      aud?: string | string[];
    };
    if (typeof payload.aud === "string") return [payload.aud];
    if (Array.isArray(payload.aud)) {
      return payload.aud.filter((value) => typeof value === "string");
    }
    return null;
  } catch {
    return null;
  }
}

type KakaoTokenResponse = {
  access_token?: string;
  id_token?: string;
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
  if (!clientSecret) {
    console.error("Direct Kakao OAuth is missing KAKAO_DIRECT_CLIENT_SECRET");
    return authError(origin, "카카오 로그인 서버 설정이 완료되지 않았습니다.");
  }

  const redirectUri = getKakaoRedirectUri(origin);
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  let tokenData: KakaoTokenResponse;
  try {
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
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

  const tokenAudience = readAudience(tokenData.id_token);
  if (!tokenAudience?.includes(clientId)) {
    console.error("Kakao ID-token audience does not match direct OAuth client", {
      tokenAudience,
      clientId,
    });
    return authError(origin, "카카오 앱 설정이 일치하지 않습니다. 관리자에게 문의해주세요.");
  }

  const target = safeRedirect(request.cookies.get(REDIRECT_COOKIE)?.value ?? null);
  const response = NextResponse.redirect(new URL(target, origin), 302);
  response.headers.set("Cache-Control", "private, no-store");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list, headers) {
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

  // Supabase is contacted only server-to-server here. The user's browser never
  // needs to establish TLS to the project's *.supabase.co hostname during login.
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "kakao",
    token: tokenData.id_token,
    access_token: tokenData.access_token,
  });
  if (error || !data.session) {
    const audienceMismatch = error?.message?.toLowerCase().includes("audience") ?? false;
    console.error("Supabase Kakao ID-token sign-in failed", {
      message: error?.message,
      tokenAudience,
      directKakaoClientId: clientId,
    });
    return authError(
      origin,
      audienceMismatch
        ? "카카오 앱과 로그인 서버의 설정이 일치하지 않습니다. 다시 시도해주세요."
        : "로그인 세션을 만들지 못했습니다. 다시 시도해주세요.",
    );
  }

  // Preserve PR20's migrated-account reconciliation behavior.
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
        console.error("kakao-login reconciliation failed:", reconciliation.status);
      }
    } catch (error) {
      console.warn("kakao-login reconciliation did not complete; continuing login", error);
    }
  }

  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(REDIRECT_COOKIE);
  return response;
}
