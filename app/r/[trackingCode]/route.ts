import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK_DESTINATION = "https://1cupenglish.com";

const safeDestination = (value: unknown): URL => {
  try {
    const destination = new URL(String(value || FALLBACK_DESTINATION));
    if (destination.protocol !== "https:" && destination.protocol !== "http:") {
      return new URL(FALLBACK_DESTINATION);
    }
    return destination;
  } catch {
    return new URL(FALLBACK_DESTINATION);
  }
};

// Link previews (KakaoTalk, Slack, social cards), search crawlers and speculative
// prefetches all GET this URL without anyone clicking. They still get the redirect, so
// previews keep working, but they must not count as clicks.
const PREFETCH_HEADERS = ["purpose", "sec-purpose", "x-purpose", "x-moz", "next-router-prefetch"];
const NON_HUMAN_AGENT =
  /bot\/|crawler|spider|slurp|facebookexternalhit|kakaotalk-scrap|Yeti\/|Daumoa|WhatsApp|TelegramBot|Discordbot|Slackbot|LinkedInBot|Embedly|preview/i;

function isAutomatedVisit(request: NextRequest): boolean {
  const isPrefetch = PREFETCH_HEADERS.some((name) => {
    const value = request.headers.get(name)?.toLowerCase() ?? "";
    return value.includes("prefetch") || value.includes("preview") || value === "1";
  });
  return isPrefetch || NON_HUMAN_AGENT.test(request.headers.get("user-agent") ?? "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingCode: string }> }
) {
  const { trackingCode } = await params;
  const normalizedCode = trackingCode.trim();
  let destination = new URL(FALLBACK_DESTINATION);
  let isKnownTrackingCode = false;

  try {
    const db = admin();
    const { data: post } = await db
      .from("growth_posts")
      .select("id, destination_url, channel, run_id, metrics")
      .eq("tracking_code", normalizedCode)
      .limit(1)
      .maybeSingle();

    if (post) {
      isKnownTrackingCode = true;
      destination = safeDestination(post.destination_url);
      destination.searchParams.set("growth", normalizedCode);
      destination.searchParams.set(
        "utm_source",
        String(post.channel || "marketing")
      );
      destination.searchParams.set("utm_medium", "community");
      destination.searchParams.set(
        "utm_campaign",
        String(post.run_id || "koreapas-cron")
      );
      destination.searchParams.set("utm_content", normalizedCode);

      // Firestore had FieldValue.increment; metrics is a jsonb blob here, so bump the
      // click count in place. Redirects are not hot enough to need an atomic counter,
      // and losing one click to a race is preferable to delaying the redirect.
      if (!isAutomatedVisit(request)) {
        const metrics = (post.metrics ?? {}) as Record<string, unknown>;
        const clicks = Number(metrics.clicks ?? 0) + 1;
        await db
          .from("growth_posts")
          .update({
            metrics: { ...metrics, clicks },
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);
      }
    }
  } catch (error) {
    console.error("Growth tracking redirect failed:", error);
  }

  const response = NextResponse.redirect(destination);
  if (isKnownTrackingCode) {
    response.cookies.set("growthTrackingCode", normalizedCode, {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  }

  return response;
}
