import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  answerQuiz,
  CommunityError,
  deleteSentence,
  expressionBook,
  inviteCodeOwner,
  inviteInfo,
  isInviteCode,
  lessonCommunity,
  saveSentence,
  toggleCup,
} from "../../../lib/features/daily/server/community";
import { ReviewError, reviewStatus, submitReview } from "../../../lib/features/daily/server/reviews";
import {
  customerForSession,
  DAILY_SESSION_COOKIE,
  DailyAuthError,
  revokeDailySession,
  signInFromLink,
} from "../../../lib/features/daily/server/session";

export const runtime = "nodejs";

// Who invited this browser: kept until its first payment, which carries the code.
const INVITE_COOKIE = "daily_invite";
const INVITE_DAYS = 30;

// POST /api/daily/<action> — the browser's only door into Daily.
//   (sign-in itself is Kakao Login: GET /api/daily/kakao, finished in /kakao_callback)
//   link-signin { token }        sign in from a Kakao message's button link (link scope);
//                               never replaces a Kakao Login session
//   logout                       revoke the session and clear the cookie
//   session-info                 whether this browser is signed in (the navbar's account link)
//   review-status / review-submit  the signed-in customer's review on /daily/review
//                                (pending until approved; needs 소속·직종 and promo
//                                consent; earns 14 days once)
//   lesson-community { token }   a lesson page's sentences, quiz numbers, PICK, progress
//   sentence-save / sentence-delete { token, ... }   the reader's own sentence
//   sentence-cup { sentenceId }  ☕ on someone's sentence, or take it back
//   quiz-answer { token, choice }  the first answer counts
//   expression-book              내 학습 기록 and the streak
//   invite-info / invite-create  the reader's invite code (made only on invite-create)
//                                and what it earned
//   invite-current               the invite code this browser holds, if any
//   invite-capture { code }      remembers who invited this browser, for its first
//                                payment; an empty code forgets it
//   client-error { path, ... }   what the Daily error screen caught, into the logs
//   billing-info / checkout-window / checkout-verify / cancel-renewal
//                                Payple payments, forwarded the same way
//   account-info / account-update / resume-renewal / refund-request / account-delete
//                                the account page, forwarded the same way
//   start-info / start-trial     forwarded to the `daily` Edge Function with the
//                                session token, which never reaches page JavaScript

const FORWARDED = new Set([
  "start-info",
  "start-trial",
  "billing-info",
  "checkout-window",
  "checkout-verify",
  "cancel-renewal",
  "account-info",
  "account-update",
  "resume-renewal",
  "switch-level",
  "refund-request",
  "account-delete",
]);

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

    if (action === "link-signin") {
      // Someone who signed in with Kakao stays as they are, whoever's link this is. A newer link replaces an older link session.
      const signedIn = await customerForSession(current);
      if (signedIn?.verified) return NextResponse.json({ success: true, signedIn: true });
      const session = await signInFromLink(String(body.token ?? ""));
      if (!session) return NextResponse.json({ success: true, signedIn: Boolean(signedIn) });
      if (signedIn) await revokeDailySession(current);
      setSession(session);
      return NextResponse.json({ success: true, signedIn: true });
    }

    if (action === "session-info") {
      const customer = await customerForSession(current);
      return NextResponse.json({ success: true, signedIn: Boolean(customer), verified: customer?.verified ?? false });
    }

    if (action === "logout") {
      await revokeDailySession(jar.get(DAILY_SESSION_COOKIE)?.value);
      jar.delete(DAILY_SESSION_COOKIE);
      return NextResponse.json({ success: true });
    }

    if (action === "review-status" || action === "review-submit") {
      // Link sessions may read the review status; sending one needs Kakao Login.
      const customer = await customerForSession(current);
      if (!customer) return NextResponse.json({ success: false, errorCode: "login-required" }, { status: 401 });
      if (action === "review-status") return NextResponse.json({ success: true, ...(await reviewStatus(customer)) });
      // A review records promotional consent, sets 소속·직종 and earns days: like other
      // consent and account changes, not from a forwardable message link.
      if (!customer.verified) {
        return NextResponse.json({ success: false, errorCode: "verify-required", message: "후기를 보내려면 다시 한번 로그인해 주세요." }, { status: 403 });
      }
      const survey = (body.survey ?? {}) as Record<string, unknown>;
      const reward = await submitReview(customer, {
        rating: Number(body.rating),
        body: String(body.body ?? ""),
        workplace: String(body.workplace ?? ""),
        jobCategory: String(body.jobCategory ?? ""),
        promoConsent: body.promoConsent === true,
        survey: {
          recommend: Number(survey.recommend),
          suggestion: String(survey.suggestion ?? ""),
        },
      });
      return NextResponse.json({ success: true, reward });
    }

    // The invite code on the signup and subscribe pages: what this browser holds, and
    // keeping (or clearing) the one typed or arriving in a link.
    if (action === "invite-current") {
      return NextResponse.json({ success: true, code: jar.get(INVITE_COOKIE)?.value ?? null });
    }

    if (action === "invite-capture") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (code === "") {
        jar.delete(INVITE_COOKIE);
        return NextResponse.json({ success: true, kept: false });
      }
      const owner = isInviteCode(code) ? await inviteCodeOwner(code) : null;
      if (!owner) return NextResponse.json({ success: false, errorCode: "invite-invalid", message: "없는 초대 코드예요. 다시 확인해 주세요." }, { status: 400 });
      const viewer = await customerForSession(current);
      if (viewer?.id === owner) {
        return NextResponse.json({ success: false, errorCode: "invite-own", message: "내 초대 코드는 쓸 수 없어요." }, { status: 400 });
      }
      jar.set(INVITE_COOKIE, code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: INVITE_DAYS * 24 * 60 * 60,
      });
      return NextResponse.json({ success: true, kept: true });
    }

    // The Daily error screen reports what broke, so a crash someone only saw on their
    // phone shows up in the logs. Paths only: a lesson link's token is cut out.
    if (action === "client-error") {
      const clip = (value: unknown, length: number) => String(value ?? "").slice(0, length);
      console.error(
        "daily client error:",
        JSON.stringify({
          path: clip(body.path, 120).replace(/^(\/daily\/[lr]\/)[^/?#]+/, "$1:token").split("?")[0],
          message: clip(body.message, 500),
          stack: clip(body.stack, 2000),
          digest: clip(body.digest, 40),
          agent: clip(req.headers.get("user-agent"), 200),
        }),
      );
      return NextResponse.json({ success: true });
    }

    if (action === "lesson-community") {
      const viewer = await customerForSession(current);
      return NextResponse.json({ success: true, ...(await lessonCommunity(String(body.token ?? ""), viewer)) });
    }

    if (["sentence-save", "sentence-delete", "sentence-cup", "quiz-answer", "expression-book", "invite-info", "invite-create"].includes(action)) {
      const viewer = await customerForSession(current);
      const token = String(body.token ?? "");
      if (action === "sentence-save") await saveSentence(token, viewer, { body: body.body });
      else if (action === "sentence-delete") await deleteSentence(token, viewer);
      else if (action === "sentence-cup") return NextResponse.json({ success: true, cupped: await toggleCup(body.sentenceId, viewer) });
      else if (action === "quiz-answer") return NextResponse.json({ success: true, ...(await answerQuiz(token, viewer, body.choice)) });
      else {
        if (!viewer) return NextResponse.json({ success: false, errorCode: "login-required" }, { status: 401 });
        if (action === "expression-book") return NextResponse.json({ success: true, ...(await expressionBook(viewer)) });
        return NextResponse.json({ success: true, ...(await inviteInfo(viewer, action === "invite-create")) });
      }
      return NextResponse.json({ success: true });
    }

    if (FORWARDED.has(action)) {
      const token = current;
      if (!token) return NextResponse.json({ success: false, errorCode: "login-required" }, { status: 401 });
      const upstream = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-daily-session": token },
        // A first checkout carries the invite this browser arrived with (terms 제5조의2).
        body: JSON.stringify({
          ...body,
          action,
          ...(action === "checkout-window" && jar.get(INVITE_COOKIE)?.value ? { inviteCode: jar.get(INVITE_COOKIE)?.value } : {}),
          // Only forward attribution cookies after the visitor explicitly permitted ad measurement.
          // Browser-controlled fields are overwritten here, never trusted from the request body.
          ...(action === "checkout-verify" ? {
            adMeasurementConsent: jar.get("daily_ads_measure_consent")?.value === "yes",
            oppref: (jar.get("__oppref")?.value ?? "").slice(0, 512),
            obref: (jar.get("__obref")?.value ?? "").slice(0, 512),
          } : {}),
        }),
        cache: "no-store",
      });
      const payload = await upstream.json().catch(() => ({ success: false }));
      // A session the function no longer accepts is gone for good, and so is one whose
      // account was just deleted; drop the cookie.
      if (upstream.status === 401 || (action === "account-delete" && upstream.ok)) jar.delete(DAILY_SESSION_COOKIE);
      return NextResponse.json(payload, { status: upstream.status });
    }

    return NextResponse.json({ success: false, errorCode: "unknown-action" }, { status: 404 });
  } catch (error) {
    if (error instanceof DailyAuthError || error instanceof ReviewError || error instanceof CommunityError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error(`api/daily/${action}:`, error);
    return NextResponse.json({ success: false, message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
