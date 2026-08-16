import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ uid: string }>;
};

const toIso = (value: any) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

// Upgrade http image URLs to https so browsers don't block them as mixed content
// (some Kakao CDN avatar URLs come back as http://).
const toHttps = (u: any) =>
  typeof u === "string" ? u.replace(/^http:\/\//, "https://") : u;

export async function GET(_request: NextRequest, context: RouteContext) {
  const { uid } = await context.params;

  if (!uid || uid.length > 160) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  try {
    const sb = admin();

    const { data, error: userError } = await sb
      .from("users")
      .select(
        "uid, display_name, photo_url, bio, work, school, location, interests, profile_public, gdg_member, has_active_subscription, account_status, created_at"
      )
      .eq("uid", uid)
      .maybeSingle();

    if (userError) throw userError;

    if (!data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Name, avatar, badges and stats stay visible even for private profiles (they
    // appear in meetups/leaderboards); only the detailed personal fields are hidden.
    const isPublic = data.profile_public !== false;

    // The users/{uid}/speaking_reports subcollection is now a top-level table keyed by user_id.
    const { data: reports } = await sb
      .from("speaking_reports")
      .select("*")
      .eq("user_id", uid);
    const reportRows = reports ?? [];

    let scoreTotal = 0;
    let scoreCount = 0;
    reportRows.forEach((row: any) => {
      const score = Number(row?.overall_score ?? row?.analysis?.overallScore);
      if (Number.isFinite(score)) {
        scoreTotal += score;
        scoreCount += 1;
      }
    });

    // The old code counted meetup participants + leaders across the old "meetup" and "events"
    // collections (four array-contains queries summed). Those collections merged into the
    // single `meetups` table; participation (both roles) now lives in `meetup_participants`.
    const { data: participations } = await sb
      .from("meetup_participants")
      .select("meetup_id")
      .eq("user_id", uid);
    const meetupCount = participations?.length ?? 0;

    const publicProfile = {
      uid,
      displayName: data.display_name || `Member ${uid.slice(0, 6)}`,
      photoURL: toHttps(data.photo_url) || null,
      isPublic,
      // Detailed fields are withheld for private profiles.
      bio: isPublic ? data.bio || "" : "",
      work: isPublic ? data.work || "" : "",
      school: isPublic ? data.school || "" : "",
      location: isPublic ? data.location || "" : "",
      interests: isPublic ? data.interests || "" : "",
      badges: {
        gdgMember: data.gdg_member === true,
        activeMember: data.has_active_subscription === true,
        role:
          data.account_status === "admin" || data.account_status === "leader"
            ? data.account_status
            : null,
      },
      stats: {
        meetupCount,
        speakingReports: reportRows.length,
        averageSpeakingScore:
          scoreCount > 0 ? Math.round((scoreTotal / scoreCount) * 10) / 10 : null,
      },
      memberSince: toIso(data.created_at),
    };

    return NextResponse.json(publicProfile, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("Failed to fetch public profile", error);
    return NextResponse.json(
      { error: "Failed to fetch public profile" },
      { status: 500 }
    );
  }
}
