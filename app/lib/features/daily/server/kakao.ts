// Kakao Login for Daily customers. Server-only.
//
// It uses the same Kakao application and registered redirect URI (/kakao_callback) as
// 1cup's own Kakao login, but never touches Supabase Auth or public.users: Kakao only
// supplies the account's verified phone number and nickname, and the Daily customer
// and session are made from those exactly as after a phone code. /kakao_callback hands
// a request over here when it carries the Daily state cookie set by /api/daily/kakao.
import { NextRequest, NextResponse } from "next/server";
import { DAILY_SESSION_COOKIE, DailyAuthError, signInVerifiedPhone } from "./session";

export const DAILY_KAKAO_STATE_COOKIE = "daily-kakao-oauth-state";
export const DAILY_KAKAO_NEXT_COOKIE = "daily-kakao-oauth-next";
const OAUTH_TTL_SECONDS = 10 * 60;

// The 1cup Kakao application (see app/auth/kakao/start/route.ts).
const KAKAO_CLIENT_ID = process.env.KAKAO_DIRECT_CLIENT_ID || "0caeab11362abda9d367a521bd18bc3d";

function redirectUri(origin: string) {
  return process.env.KAKAO_DIRECT_REDIRECT_URI || `${origin}/kakao_callback`;
}

/** Only Daily pages, so the login cannot be turned into an open redirect. */
export function safeDailyNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/daily") || value.startsWith("//")) return "/daily/account";
  return value;
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export function startDailyKakaoLogin(request: NextRequest): NextResponse {
  const state = crypto.randomUUID().replaceAll("-", "");
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", KAKAO_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri(request.nextUrl.origin));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "profile_nickname,phone_number");
  const response = NextResponse.redirect(url, 302);
  response.cookies.set(DAILY_KAKAO_STATE_COOKIE, state, cookieOptions(OAUTH_TTL_SECONDS));
  response.cookies.set(DAILY_KAKAO_NEXT_COOKIE, safeDailyNext(request.nextUrl.searchParams.get("next")), cookieOptions(OAUTH_TTL_SECONDS));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

interface KakaoMe {
  kakao_account?: {
    phone_number?: string;
    profile?: { nickname?: string };
  };
}

/**
 * Finishes a Daily Kakao login, or returns null when this callback is not one (no Daily
 * state cookie, or it does not match), so 1cup's own Kakao login carries on.
 */
export async function finishDailyKakaoLogin(request: NextRequest): Promise<NextResponse | null> {
  const expected = request.cookies.get(DAILY_KAKAO_STATE_COOKIE)?.value;
  const returned = request.nextUrl.searchParams.get("state");
  if (!expected || !returned || expected !== returned) return null;

  const origin = request.nextUrl.origin;
  const next = safeDailyNext(request.cookies.get(DAILY_KAKAO_NEXT_COOKIE)?.value);
  const back = (reason?: string) => {
    const url = new URL(next, origin);
    if (reason) url.searchParams.set("kakao", reason);
    const response = NextResponse.redirect(url, 302);
    response.cookies.delete(DAILY_KAKAO_STATE_COOKIE);
    response.cookies.delete(DAILY_KAKAO_NEXT_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  // The person closed or refused the Kakao consent screen.
  if (!code || request.nextUrl.searchParams.get("error")) return back("cancelled");
  const secret = process.env.KAKAO_DIRECT_CLIENT_SECRET;
  if (!secret) {
    console.error("daily kakao login: KAKAO_DIRECT_CLIENT_SECRET is not set");
    return back("failed");
  }

  try {
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: KAKAO_CLIENT_ID,
        client_secret: secret,
        redirect_uri: redirectUri(origin),
        code,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const token = (await tokenResponse.json()) as { access_token?: string; error?: string };
    if (!tokenResponse.ok || !token.access_token) {
      console.error("daily kakao token exchange failed:", tokenResponse.status, token.error);
      return back("failed");
    }

    const meResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const me = (await meResponse.json()) as KakaoMe;
    const phone = me.kakao_account?.phone_number;
    // The phone number is the Daily identity; without consent to share it, fall back
    // to the phone code.
    if (!meResponse.ok || !phone) return back("no-phone");

    const session = await signInVerifiedPhone(phone, me.kakao_account?.profile?.nickname ?? null);
    const response = back();
    response.cookies.set(DAILY_SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (e) {
    console.error("daily kakao login failed:", e instanceof DailyAuthError ? e.message : e);
    return back(e instanceof DailyAuthError && e.status === 400 ? "no-phone" : "failed");
  }
}
