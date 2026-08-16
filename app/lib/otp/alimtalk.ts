// Sends a phone OTP code via Kakao AlimTalk (NHN Cloud / Toast), with SMS/LMS fallback.
// Node runtime only (imported by Next.js route handlers). Credentials come from env —
// do NOT hardcode (the old values in functions/src/index.ts are flagged for rotation).
//
// Required env:
//   TOAST_APPKEY, TOAST_SECRET_KEY, TOAST_SENDER_KEY, ALIMTALK_OTP_TEMPLATE_CODE
// Optional env:
//   OTP_TEMPLATE_VAR  (default "code")  — must match the #{...} variable in the approved template
//   OTP_SMS_FALLBACK  (default "true")  — auto-resend as SMS/LMS if AlimTalk fails (needs Toast SMS product)
//   OTP_BRAND         (default "영어 한잔")

const TOAST_APPKEY = process.env.TOAST_APPKEY ?? "";
const TOAST_SECRET_KEY = process.env.TOAST_SECRET_KEY ?? "";
const TOAST_SENDER_KEY = process.env.TOAST_SENDER_KEY ?? "";
const TEMPLATE_CODE = process.env.ALIMTALK_OTP_TEMPLATE_CODE ?? "";
const TEMPLATE_VAR = process.env.OTP_TEMPLATE_VAR ?? "code";
const SMS_FALLBACK = (process.env.OTP_SMS_FALLBACK ?? "true") === "true";
const BRAND = process.env.OTP_BRAND ?? "영어 한잔";

export function alimtalkConfigured(): boolean {
  return Boolean(TOAST_APPKEY && TOAST_SECRET_KEY && TOAST_SENDER_KEY && TEMPLATE_CODE);
}

// recipientNo must be the Korean domestic form (01012345678).
export async function sendOtpViaAlimtalk(recipientNo: string, code: string): Promise<void> {
  const body: Record<string, unknown> = {
    senderKey: TOAST_SENDER_KEY,
    templateCode: TEMPLATE_CODE,
    // templateParameter keys must match the #{...} variables in the APPROVED template.
    recipientList: [{ recipientNo, templateParameter: { [TEMPLATE_VAR]: code } }],
  };

  // If AlimTalk delivery fails (incl. "template not yet approved by Kakao"), Toast
  // auto-resends the same code as SMS/LMS using the account's SMS profile.
  if (SMS_FALLBACK) {
    body.resendParameter = {
      isResend: true,
      resendType: "SMS", // Toast promotes to LMS automatically if over length.
      resendContent: `[${BRAND}] 인증번호 [${code}]를 입력해 주세요. 타인에게 절대 알려주지 마세요.`,
    };
  }

  const res = await fetch(
    `https://api-alimtalk.cloud.toast.com/alimtalk/v2.2/appkeys/${TOAST_APPKEY}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Secret-Key": TOAST_SECRET_KEY,
      },
      body: JSON.stringify(body),
    },
  );

  const text = await res.text();
  if (!res.ok) throw new Error(`Toast HTTP ${res.status}: ${text}`);

  // Toast returns 200 even on config/recipient errors; inspect the envelope.
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
