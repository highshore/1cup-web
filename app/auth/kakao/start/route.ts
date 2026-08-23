import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "onecup-kakao-oauth-state";
const REDIRECT_COOKIE = "onecup-kakao-oauth-redirect";
const OAUTH_TTL_SECONDS = 10 * 60;

// Public REST API key of the Kakao application currently configured in Supabase Auth.
const SUPABASE_KAKAO_CLIENT_ID = "0caeab11362abda9d367a521bd18bc3d";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) return "/";
  return value;
}

function getKakaoClientId() {
  return process.env.KAKAO_DIRECT_CLIENT_ID ?? SUPABASE_KAKAO_CLIENT_ID;
}

function getKakaoRedirectUri(origin: string) {
  return process.env.KAKAO_DIRECT_REDIRECT_URI ?? `${origin}/kakao_callback`;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const clientId = getKakaoClientId();
  const redirectUri = getKakaoRedirectUri(origin);
  const target = safeRedirect(request.nextUrl.searchParams.get("redirect"));
  const state = crypto.randomUUID().replaceAll("-", "");

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
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
