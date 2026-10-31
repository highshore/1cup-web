import { NextRequest, NextResponse } from "next/server";
import { generateUpcomingDrafts } from "../../../lib/features/social/server/daily_posts";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/social-drafts — Vercel Cron, nightly at 20:07 KST (vercel.json): drafts
// tomorrow's Threads thread and Instagram card news for admin approval. Existing drafts
// are kept, so a repeat call does no work. When CRON_SECRET is set (Vercel sends it as a
// bearer token on cron calls), other callers are refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await generateUpcomingDrafts());
  } catch (error) {
    console.error("api/cron/social-drafts:", error);
    return NextResponse.json({ error: "draft generation failed" }, { status: 500 });
  }
}
