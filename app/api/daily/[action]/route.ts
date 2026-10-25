import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ReviewError, reviewStatus, submitReview } from "../../../lib/features/daily/server/reviews";
import {
  customerForSession,
  DAILY_SESSION_COOKIE,
  DailyAuthError,
  revokeDailySession,
  sendDailyCode,
  sendDailyCodeForSession,
  signInFromLink,
  verifyDailyCode,
  verifyDailyCodeForSession,
} from "../../../lib/features/daily/server/session";

export const runtime = "nodejs";

// POST /api/daily/<action> — the browser's only door into Daily.
//   otp-send   { phone }         send a Daily sign-in code
//   otp-verify { phone, code }   sign in; sets the httpOnly daily_session cookie
//              { session: true } instead of phone: the step-up for a link session, sent
//                               to the signed-in subscriber's own number
//   link-signin { token }        sign in from a Kakao message's button link (link scope);
//                               never replaces a phone session
//   logout                       revoke the session and clear the cookie
//   review-status / review-submit  the signed-in customer's review (verified, pending
//                                until approved)
//   billing-info / checkout-window / checkout-verify / cancel-renewal
//                                Payple payments, forwarded the same way
//   start-info / start-trial     forwarded to the `daily` Edge Function with the
//                                session token, which never reaches page JavaScript

const FORWARDED = new Set([
  "start-info",
  "start-trial",
  "billing-info",
  "checkout-window",
  "checkout-verify",
  "cancel-renewal",
]);

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || null;
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const jar = await cookies();

  try {
    const setSession = ({ token, expiresAt }: { token: string; expiresAt: Date }) =>
      jar.set(DAILY_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      });
    const current = jar.get(DAILY_SESSION_COOKIE)?.value;

    if (action === "otp-send") {
      if (body.session === true) await sendDailyCodeForSession(current, clientIp(req));
      else await sendDailyCode(String(body.phone ?? ""), clientIp(req));
      return NextResponse.json({ success: true });
    }

    if (action === "otp-verify") {
      setSession(
        body.session === true
          ? await verifyDailyCodeForSession(current, String(body.code ?? ""))
          : await verifyDailyCode(String(body.phone ?? ""), String(body.code ?? "")),
      );
      return NextResponse.json({ success: true });
    }

    if (action === "link-signin") {
      // Someone who signed in with a phone code stays as they are, whoever's link this
      // is. A newer link replaces an older link session.
      const signedIn = await customerForSession(current);
      if (signedIn?.verified) return NextResponse.json({ success: true, signedIn: true });
      const session = await signInFromLink(String(body.token ?? ""));
      if (!session) return NextResponse.json({ success: true, signedIn: Boolean(signedIn) });
      if (signedIn) await revokeDailySession(current);
      setSession(session);
      return NextResponse.json({ success: true, signedIn: true });
    }

    if (action === "logout") {
      await revokeDailySession(jar.get(DAILY_SESSION_COOKIE)?.value);
      jar.delete(DAILY_SESSION_COOKIE);
      return NextResponse.json({ success: true });
    }

    if (action === "review-status" || action === "review-submit") {
      // Link sessions may write reviews: every review waits for the founder's approval.
      const customer = await customerForSession(current);
      if (!customer) return NextResponse.json({ success: false, errorCode: "login-required" }, { status: 401 });
      if (action === "review-status") return NextResponse.json({ success: true, ...(await reviewStatus(customer)) });
      await submitReview(customer, {
        rating: Number(body.rating),
        body: String(body.body ?? ""),
        displayName: String(body.displayName ?? ""),
      });
      return NextResponse.json({ success: true });
    }

    if (FORWARDED.has(action)) {
      const token = current;
      if (!token) return NextResponse.json({ success: false, errorCode: "login-required" }, { status: 401 });
      const upstream = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-daily-session": token },
        body: JSON.stringify({ ...body, action }),
        cache: "no-store",
      });
      const payload = await upstream.json().catch(() => ({ success: false }));
      // A session the function no longer accepts is gone for good; drop the cookie.
      if (upstream.status === 401) jar.delete(DAILY_SESSION_COOKIE);
      return NextResponse.json(payload, { status: upstream.status });
    }

    return NextResponse.json({ success: false, errorCode: "unknown-action" }, { status: 404 });
  } catch (error) {
    if (error instanceof DailyAuthError || error instanceof ReviewError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error(`api/daily/${action}:`, error);
    return NextResponse.json({ success: false, message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
