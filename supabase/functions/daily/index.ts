// daily — Supabase Edge Function (Deno) for 영어 한잔 Daily.
//
// Actions
//   tick       pg_cron, every 5 minutes. Sends due lessons, Saturday reviews and
//              trial-ended notices. Authorized by the Vault-held daily_scheduler_secret.
//   test-send  Admins only. Sends one message of a given kind to a phone number using
//              the latest ready lesson, without touching subscriptions or deliveries.
//              For checking approved templates on a real phone before launch.
//
// Secrets (supabase secrets set …)
//   DAILY_TEMPLATE_LESSON, DAILY_TEMPLATE_REVIEW, DAILY_TEMPLATE_TRIAL_ENDED
//       Approved Alimtalk template codes. Until all three are set, tick sends nothing.
//   DAILY_SMS_FALLBACK   "false" to turn off the LMS fallback (default on).
//   DAILY_SITE_URL       Base URL in fallback texts (default https://1cupenglish.com).
//   KAKAO_APPKEY, KAKAO_SECRET_KEY, KAKAO_SENDER_KEY  shared with messaging.

import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid, recordSchedulerHeartbeat } from "../_shared/db.ts";
import { krPhone, sendKakaoMessages } from "../_shared/kakao.ts";
import { runTick, templateCodes, type DeliveryKind, type Track } from "./delivery.ts";

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
