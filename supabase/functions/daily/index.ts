// daily — Supabase Edge Function (Deno) for 영어 한잔 Daily.
//
// Actions
//   tick       pg_cron, every 5 minutes. Sends due lessons, Saturday reviews and
//              trial-ended notices. Authorized by the Vault-held daily_scheduler_secret.
//   start-info   Signed-in user. What the signup page needs: whether trials are open to
//                them, the masked phone the lesson would go to, and which tracks they
//                already used or hold.
//   start-trial  Signed-in user. Records consent, uses up the phone's free trial on the
//                track and sends the free lesson immediately.
//   test-send  Admins only. Sends one message of a given kind to a phone number using
//              the latest ready lesson, without touching subscriptions or deliveries.
//              For checking approved templates on a real phone before launch.
//
// Secrets (supabase secrets set …)
//   DAILY_TEMPLATE_LESSON, DAILY_TEMPLATE_REVIEW, DAILY_TEMPLATE_TRIAL_ENDED
//       Approved Alimtalk template codes. Until all three are set, tick sends nothing.
//   DAILY_TRIAL_OPEN     "true" to open trials to everyone. Until then only admins can
//                        start one, so the whole flow can be tested on a real phone.
//   DAILY_SMS_FALLBACK   "false" to turn off the LMS fallback (default on).
//   DAILY_SITE_URL       Base URL in fallback texts (default https://1cupenglish.com).
//   KAKAO_APPKEY, KAKAO_SECRET_KEY, KAKAO_SENDER_KEY  shared with messaging.

import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid, recordSchedulerHeartbeat } from "../_shared/db.ts";
import { krPhone, sendKakaoMessages } from "../_shared/kakao.ts";
import {
  runTick,
  sendTrialLesson,
  templateCodes,
  trialLessonFor,
  type DeliveryKind,
  type Subscription,
  type Track,
} from "./delivery.ts";

async function schedulerAuthorized(req: Request): Promise<boolean> {
  const presented = req.headers.get("x-daily-scheduler-secret");
  if (!presented) return false;
  const { data, error } = await admin().rpc("daily_scheduler_secret");
  if (error || typeof data !== "string" || data.length === 0) {
    console.error("daily scheduler secret unavailable:", error?.message);
    return false;
  }
  return presented === data;
}

async function callerIsAdmin(req: Request): Promise<boolean> {
  const uid = await callerUid(req);
  if (!uid) return false;
  const { data } = await admin().from("users").select("account_status").eq("uid", uid).maybeSingle();
  return data?.account_status === "admin";
}

// Bump together with DAILY_TERMS_VERSION in app/lib/features/daily/constants.ts.
const TERMS_VERSION = "2026-10-25";

interface Caller {
  uid: string;
  isAdmin: boolean;
  phone: string | null;
  name: string | null;
}

async function loadCaller(req: Request): Promise<Caller | null> {
  const uid = await callerUid(req);
  if (!uid) return null;
  const { data } = await admin()
    .from("users")
    .select("account_status, phone, display_name")
    .eq("uid", uid)
    .maybeSingle();
  if (!data || data.account_status === "deleted") return null;
  const phone = krPhone(data.phone);
  return {
    uid,
    isAdmin: data.account_status === "admin",
    phone: /^01[0-9]{8,9}$/.test(phone) ? phone : null,
    name: (data.display_name ?? "").trim() || null,
  };
}

function trialsOpenFor(caller: Caller): boolean {
  return caller.isAdmin || Deno.env.get("DAILY_TRIAL_OPEN") === "true";
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`;
}

async function handleStartInfo(caller: Caller) {
  const db = admin();
  const [{ data: claims }, { data: live }] = await Promise.all([
    caller.phone
      ? db.from("daily_trial_claims").select("track").eq("recipient_phone", caller.phone)
      : Promise.resolve({ data: [] as Array<{ track: string }> }),
    db.from("daily_subscriptions").select("track, status").eq("uid", caller.uid).in("status", ["trial", "active"]),
  ]);
  return {
    open: trialsOpenFor(caller) && templateCodes() !== null,
    phone: caller.phone ? maskPhone(caller.phone) : null,
    name: caller.name,
    usedTrialTracks: (claims ?? []).map((c) => c.track),
    liveTracks: (live ?? []).map((s) => s.track),
  };
}

class StartError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
  }
}

async function handleStartTrial(
  caller: Caller,
  body: { track?: unknown; time?: unknown; name?: unknown; marketing?: unknown; agreements?: unknown; termsVersion?: unknown },
) {
  if (!trialsOpenFor(caller)) throw new StartError("not-open", 403);
  const codes = templateCodes();
  if (!codes) throw new StartError("not-open", 403);

  const track = body.track;
  if (track !== "business" && track !== "tech") throw new StartError("invalid-track");
  const time = typeof body.time === "string" ? body.time : "";
  const match = /^([01][0-9]|2[0-2]):(00|30)$/.exec(time);
  if (!match || time < "06:00" || time > "22:00") throw new StartError("invalid-time");

  // The three required agreements, checked here as well as in the dialog: the record
  // this writes is the proof of consent, so it must not depend on the client alone.
  const agreements = (body.agreements ?? {}) as Record<string, unknown>;
  if (agreements.terms !== true || agreements.privacy !== true || agreements.messages !== true) {
    throw new StartError("consent-required");
  }
  if (body.termsVersion !== TERMS_VERSION) throw new StartError("terms-outdated", 409);

  if (!caller.phone) throw new StartError("no-phone");

  const db = admin();
  const lesson = await trialLessonFor(db, track);
  if (!lesson) throw new StartError("no-lesson", 503);

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 20) : "";
  const { data: sub, error } = await db.rpc("daily_start_trial", {
    p_uid: caller.uid,
    p_track: track,
    p_phone: caller.phone,
    p_name: name || caller.name || "",
    p_delivery_time: `${time}:00`,
    p_marketing: body.marketing === true,
    p_terms_version: TERMS_VERSION,
  });
  if (error) {
    if (error.message.includes("trial-used")) throw new StartError("trial-used", 409);
    if (error.message.includes("already-subscribed")) throw new StartError("already-subscribed", 409);
    throw new Error(`start trial failed: ${error.message}`);
  }

  const subscription = sub as Subscription & { next_send_at: string };
  const sent = await sendTrialLesson(db, subscription, lesson, codes);
  return { subscriptionId: subscription.id, sent, nextSendAt: subscription.next_send_at };
}

async function handleTestSend(body: { phone?: unknown; kind?: unknown; track?: unknown }) {
  const phone = krPhone(typeof body.phone === "string" ? body.phone : "");
  if (!/^01[0-9]{8,9}$/.test(phone)) throw new Error("phone must be a Korean mobile number");
  const kind = (body.kind ?? "lesson") as DeliveryKind;
  if (!["lesson", "review", "trial_ended"].includes(kind)) throw new Error("unknown kind");
  const track = (body.track ?? "business") as Track;
  if (track !== "business" && track !== "tech") throw new Error("unknown track");

  const codes = templateCodes();
  if (!codes) throw new Error("template codes are not configured");

  const { data: lesson } = await admin()
    .from("daily_lessons")
    .select("expression, meaning, examples")
    .eq("track", track)
    .eq("status", "ready")
    .order("publish_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  const expression = lesson?.expression ?? "circle back";
  const meaning = lesson?.meaning ?? "(논의를) 나중에 다시 이어가다";
  const example = lesson?.examples?.[0]?.en ?? "Let's circle back on pricing after the launch.";
  const trackLabel = track === "business" ? "비즈니스 영어" : "테크 영어";

  const params: Record<DeliveryKind, Record<string, string>> = {
    lesson: { name: "테스트", track: trackLabel, expression, meaning, example, token: "test" },
    review: { name: "테스트", count: "1", expressions: `· ${expression}`, token: "test" },
    trial_ended: { name: "테스트", track: trackLabel, token: "test" },
  };
  const code = kind === "lesson" ? codes.lesson : kind === "review" ? codes.review : codes.trialEnded;
  return await sendKakaoMessages([{ recipientNo: phone, templateParameter: params[kind] }], code);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return json(req, { success: false, error: "Method Not Allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(req, { success: false, error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string | undefined;
  try {
    switch (action) {
      case "tick": {
        if (!(await schedulerAuthorized(req))) {
          return json(req, { success: false, error: "permission-denied" }, 403);
        }
        const stats = await runTick(admin());
        await recordSchedulerHeartbeat("daily.tick", { stats }, "20 minutes");
        return json(req, { success: true, stats });
      }
      case "start-info":
      case "start-trial": {
        const caller = await loadCaller(req);
        if (!caller) return json(req, { success: false, errorCode: "login-required" }, 401);
        if (action === "start-info") return json(req, { success: true, ...(await handleStartInfo(caller)) });
        try {
          return json(req, { success: true, ...(await handleStartTrial(caller, body)) });
        } catch (e) {
          if (e instanceof StartError) {
            return json(req, { success: false, errorCode: e.code, message: e.code }, e.status);
          }
          throw e;
        }
      }
      case "test-send": {
        if (!(await callerIsAdmin(req))) {
          return json(req, { success: false, error: "Admin access is required" }, 403);
        }
        return json(req, { success: true, result: await handleTestSend(body) });
      }
      default:
        return json(req, { success: false, error: `Unknown or missing action: ${String(action)}` }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`daily action "${action}" failed:`, message);
    return json(req, { success: false, error: message }, 500);
  }
});
