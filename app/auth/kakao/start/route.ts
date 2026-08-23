import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "onecup-kakao-oauth-state";
const REDIRECT_COOKIE = "onecup-kakao-oauth-redirect";
const OAUTH_TTL_SECONDS = 10 * 60;

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) return "/";
  return value;
}

function getKakaoClientId() {
  return process.env.NEXT_KAKAO_CLIENT_ID ?? process.env.KAKAO_CLIENT_ID ?? null;
}

function getKakaoRedirectUri(origin: string) {
  return (
    process.env.NEXT_KAKAO_REDIRECT_URI ??
    process.env.KAKAO_REDIRECT_URI ??
    `${origin}/kakao_callback`
  );
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const clientId = getKakaoClientId();

  if (!clientId) {
    console.error("Direct Kakao OAuth is missing NEXT_KAKAO_CLIENT_ID/KAKAO_CLIENT_ID");
    const retry = new URL("/auth", origin);
    retry.searchParams.set("error", "카카오 로그인 설정을 확인해주세요.");
    return NextResponse.redirect(retry, 302);
  }

  const redirectUri = getKakaoRedirectUri(origin);
  const target = safeRedirect(request.nextUrl.searchParams.get("redirect"));
  const state = crypto.randomUUID().replaceAll("-", "");

  // Deliberately bypass the browser-facing Supabase Auth hostname. The browser
  // talks only to 1cupenglish.com and Kakao; Supabase is contacted server-side
  // after Kakao returns an authorization code.
  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set(
    "scope",
    "openid,profile_nickname,profile_image,account_email,phone_number",
  );

  const response = NextResponse.redirect(authorizeUrl, 302);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_TTL_SECONDS,
  };
  response.cookies.set(STATE_COOKIE, state, cookieOptions);
  response.cookies.set(REDIRECT_COOKIE, target, cookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
