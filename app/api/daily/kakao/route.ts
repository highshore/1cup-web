import { NextRequest } from "next/server";
import { startDailyKakaoLogin } from "../../../lib/features/daily/server/kakao";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/daily/kakao?next=/daily/... — starts Kakao Login for a Daily customer.
// Kakao returns to /kakao_callback, which hands Daily logins to finishDailyKakaoLogin.
export function GET(request: NextRequest) {
  return startDailyKakaoLogin(request);
}
