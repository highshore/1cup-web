import { NextResponse } from "next/server";
import { createAndSendCode, OtpError } from "../../../lib/otp/service";

export const runtime = "nodejs";

// POST /api/phone-otp/send  { phone: "01012345678" }
// Generates an OTP, stores it hashed, and delivers it via Kakao AlimTalk.
export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (typeof phone !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    await createAndSendCode(phone);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OtpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("phone-otp/send:", err);
    return NextResponse.json({ error: "인증번호 전송에 실패했습니다." }, { status: 500 });
  }
}
