import { NextRequest, NextResponse } from "next/server";
import { requireAdminUid } from "../../../lib/features/social/server/auth";
import {
  channelOverview,
  generateDailyPost,
  isPostDate,
  saveDailyPost,
  setDailyPostStatus,
  SocialPostError,
} from "../../../lib/features/social/server/daily_posts";
import { SOCIAL_PILLARS, type SocialChannel, type SocialPillar } from "../../../lib/features/social/types";

export const runtime = "nodejs";
// Generating a carousel drafts with Gemini and renders up to eight cards.
export const maxDuration = 300;

const isChannel = (value: unknown): value is SocialChannel => value === "threads" || value === "instagram";
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function fail(error: unknown) {
  if (error instanceof SocialPostError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("api/admin/social:", error);
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET /api/admin/social?channel=threads — recent and upcoming daily posts plus slot stats.
export async function GET(request: NextRequest) {
  try {
    await requireAdminUid();
    const channel = request.nextUrl.searchParams.get("channel");
    if (!isChannel(channel)) return NextResponse.json({ error: "channel is invalid." }, { status: 400 });
    return NextResponse.json(await channelOverview(channel));
  } catch (error) {
    return fail(error);
  }
}

// POST { action, ... }:
//   generate  { channel, postDate, replace?, pillar? }  draft (or redraft) a day's post
//   save      { id, content?, scheduledFor? }  edit text/slides (re-renders cards) or time
//   approve | reject | unapprove { id }
export async function POST(request: NextRequest) {
  try {
    const uid = await requireAdminUid();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.action) {
      case "generate":
        if (!isChannel(body.channel) || !isPostDate(body.postDate)) {
          return NextResponse.json({ error: "channel or postDate is invalid." }, { status: 400 });
        }
        return NextResponse.json(
          await generateDailyPost(
            body.channel,
            body.postDate,
            body.replace === true,
            typeof body.pillar === "string" && SOCIAL_PILLARS.includes(body.pillar as SocialPillar) ? body.pillar : undefined,
          ),
        );
      case "save":
        if (!isId(body.id)) return NextResponse.json({ error: "id is invalid." }, { status: 400 });
        return NextResponse.json(await saveDailyPost(body.id, { content: body.content, scheduledFor: body.scheduledFor }));
      case "approve":
      case "reject":
      case "unapprove":
        if (!isId(body.id)) return NextResponse.json({ error: "id is invalid." }, { status: 400 });
        return NextResponse.json(
          await setDailyPostStatus(
            body.id,
            body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "draft",
            uid,
          ),
        );
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    return fail(error);
  }
}
