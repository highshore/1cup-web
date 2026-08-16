// Supabase "Send SMS" Auth Hook — delivers phone OTP codes via Kakao AlimTalk
// (NHN Cloud / Toast) instead of a built-in SMS provider (Twilio, etc.).
//
// Why this exists:
//   Supabase Auth still owns the whole phone-OTP lifecycle (code generation,
//   verification, phone-based user creation, session minting). When this hook is
//   enabled, Supabase calls US with the phone number + OTP instead of a native
//   provider, and we deliver the message however we like — here, via AlimTalk.
//   The web client keeps using supabase.auth.signInWithOtp / verifyOtp unchanged.
//
// Delivery strategy:
//   AlimTalk first → auto-fallback to SMS/LMS (Toast `resendParameter`) if AlimTalk
//   fails for ANY reason, which includes "template not yet approved by Kakao".
//   So phone login works from day one (SMS) and silently upgrades to AlimTalk once
//   the template is approved — no redeploy needed.
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   SEND_SMS_HOOK_SECRET         Hook signing secret Supabase shows when you create the
//                                hook. Format: "v1,whsec_<base64>". Used to verify requests.
//   TOAST_APPKEY                 NHN Toast AlimTalk appkey (path segment in the API URL).
//   TOAST_SECRET_KEY             NHN Toast "X-Secret-Key" for the AlimTalk appkey.
//   TOAST_SENDER_KEY             AlimTalk sender key (카카오 채널 발신 프로파일 senderKey).
//   ALIMTALK_OTP_TEMPLATE_CODE   The APPROVED OTP template code (e.g. "OTP_LOGIN").
// Optional:
//   OTP_TEMPLATE_VAR             Template variable name that holds the code. Default "code".
//                                Your approved template body must contain #{<this>}.
//   OTP_SMS_FALLBACK             "true" (default) to auto-resend as SMS/LMS on AlimTalk failure.
//                                Requires a registered Toast 발신번호 + SMS product on the account.
//   OTP_BRAND                    Short brand prefix used in the message text. Default "영어 한잔".
//
// Deploy:  supabase functions deploy send-sms-hook --no-verify-jwt
//   (--no-verify-jwt because the caller is Supabase Auth using the hook signature,
//    not a logged-in user bearer token.)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

// ---- config from env -------------------------------------------------------
const HOOK_SECRET = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
const TOAST_APPKEY = Deno.env.get("TOAST_APPKEY") ?? "";
const TOAST_SECRET_KEY = Deno.env.get("TOAST_SECRET_KEY") ?? "";
const TOAST_SENDER_KEY = Deno.env.get("TOAST_SENDER_KEY") ?? "";
const TEMPLATE_CODE = Deno.env.get("ALIMTALK_OTP_TEMPLATE_CODE") ?? "";
const TEMPLATE_VAR = Deno.env.get("OTP_TEMPLATE_VAR") ?? "code";
const SMS_FALLBACK = (Deno.env.get("OTP_SMS_FALLBACK") ?? "true") === "true";
const BRAND = Deno.env.get("OTP_BRAND") ?? "영어 한잔";

const ALIMTALK_URL =
  `https://api-alimtalk.cloud.toast.com/alimtalk/v2.2/appkeys/${TOAST_APPKEY}/messages`;

// ---- helpers ---------------------------------------------------------------

// Supabase stores phone as country-code digits, no "+": e.g. "821012345678".
// Toast AlimTalk wants the Korean domestic form: "01012345678".
function toKoreanLocal(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("82")) return "0" + digits.slice(2);
  if (digits.startsWith("0")) return digits;
  return digits;
}

// Auth-hook error response shape Supabase understands. Returning this makes
// Supabase surface `message` to the client and abort the OTP send.
function hookError(message: string, httpCode = 500): Response {
  return new Response(
    JSON.stringify({ error: { http_code: httpCode, message } }),
    { status: httpCode, headers: { "Content-Type": "application/json" } },
  );
}

// The plain-text used both for the AlimTalk fallback (resendContent) and any LMS.
function otpMessageText(otp: string): string {
  return `[${BRAND}] 인증번호 [${otp}]를 입력해 주세요. 타인에게 절대 알려주지 마세요.`;
}

// ---- Toast AlimTalk send ---------------------------------------------------
async function sendAlimtalk(recipientNo: string, otp: string): Promise<void> {
  const body: Record<string, unknown> = {
    senderKey: TOAST_SENDER_KEY,
    templateCode: TEMPLATE_CODE,
    recipientList: [
      {
        recipientNo,
        // Keys must match the #{...} variables in the APPROVED template.
        templateParameter: { [TEMPLATE_VAR]: otp },
      },
    ],
  };

  // Auto-fallback: if AlimTalk delivery fails (incl. template not yet approved),
  // Toast resends the same code as SMS/LMS using the account's SMS profile.
  if (SMS_FALLBACK) {
    body.resendParameter = {
      isResend: true,
      resendType: "SMS", // Toast promotes to LMS automatically if over length.
      resendContent: otpMessageText(otp),
    };
  }

  const res = await fetch(ALIMTALK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Secret-Key": TOAST_SECRET_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Toast HTTP ${res.status}: ${text}`);
  }

  // Toast returns 200 even on per-recipient/config errors; inspect the envelope.
  let parsed: { header?: { isSuccessful?: boolean; resultMessage?: string } };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Toast returned non-JSON body: ${text}`);
  }
  if (parsed.header?.isSuccessful === false) {
    throw new Error(`Toast rejected request: ${parsed.header?.resultMessage ?? text}`);
  }
}

// ---- HTTP entrypoint -------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== "POST") return hookError("Method not allowed", 405);

  // Fail loud if misconfigured — better than silently not sending OTPs.
  if (!HOOK_SECRET || !TOAST_APPKEY || !TOAST_SECRET_KEY || !TOAST_SENDER_KEY || !TEMPLATE_CODE) {
    console.error("send-sms-hook: missing required env (secret/toast/template)");
    return hookError("SMS hook is not configured", 500);
  }

  const raw = await req.text();

  // 1) Verify the request really came from Supabase (Standard Webhooks signature).
  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    const wh = new Webhook(HOOK_SECRET.replace("v1,whsec_", ""));
    payload = wh.verify(raw, {
      "webhook-id": req.headers.get("webhook-id") ?? "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": req.headers.get("webhook-signature") ?? "",
    }) as typeof payload;
  } catch (err) {
    console.error("send-sms-hook: signature verification failed", err);
    return hookError("Invalid signature", 401);
  }

  // 2) Pull the phone + OTP Supabase generated.
  const otp = payload.sms?.otp;
  const recipientNo = toKoreanLocal(payload.user?.phone ?? "");
  if (!otp) return hookError("Missing OTP in payload", 400);
  if (!recipientNo.startsWith("010") || recipientNo.length < 10) {
    return hookError(`Unsupported phone number: ${payload.user?.phone ?? "(none)"}`, 400);
  }

  // 3) Deliver via AlimTalk (with SMS fallback baked into the Toast request).
  try {
    await sendAlimtalk(recipientNo, otp);
  } catch (err) {
    console.error("send-sms-hook: delivery failed", err);
    return hookError("Failed to send verification code", 502);
  }

  // 200 with empty body tells Supabase the send succeeded.
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
