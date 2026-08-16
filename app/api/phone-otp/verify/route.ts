import { NextResponse } from "next/server";
import { verifyCodeAndMintSession, OtpError } from "../../../lib/otp/service";

export const runtime = "nodejs";

// POST /api/phone-otp/verify  { phone: "01012345678", code: "123456" }
// Verifies the code and returns a Supabase session for the phone user.
// The client passes these to supabase.auth.setSession(...).
export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();
    if (typeof phone !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const tokens = await verifyCodeAndMintSession(phone, code);
    return NextResponse.json(tokens);
  } catch (err) {
    if (err instanceof OtpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("phone-otp/verify:", err);
    return NextResponse.json({ error: "인증에 실패했습니다." }, { status: 500 });
  }
}
