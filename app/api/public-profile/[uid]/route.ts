import { NextRequest, NextResponse } from "next/server";
import { admin, createServerClientRSC } from "../../../lib/supabase/server";

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

const toHttps = (u: any) =>
  typeof u === "string" ? u.replace(/^http:\/\//, "https://") : u;

function parseProfileDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      nationality: "",
      languages: [] as string[],
      englishLevel: "",
      discussionTopics: [] as string[],
      meetupPreferences: "",
    };
  }

  const row = value as Record<string, unknown>;
  return {
    nationality: typeof row.nationality === "string" ? row.nationality : "",
    languages: Array.isArray(row.languages)
      ? row.languages.filter((item): item is string => typeof item === "string")
      : [],
    englishLevel:
      typeof row.english_level === "string" ? row.english_level : "",
    discussionTopics: Array.isArray(row.discussion_topics)
      ? row.discussion_topics.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    meetupPreferences:
      typeof row.meetup_preferences === "string"
        ? row.meetup_preferences
        : "",
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { uid } = await context.params;

  if (!uid || uid.length > 160) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  try {
    const sb = admin();
    const viewerClient = await createServerClientRSC();
    const {
      data: { user: authUser },
    } = await viewerClient.auth.getUser();
    const { data: viewerRows } = authUser
      ? await viewerClient.rpc("current_user_row")
      : { data: null };
    const viewer = Array.isArray(viewerRows) ? viewerRows[0] : null;
    const viewerUid = typeof viewer?.uid === "string" ? viewer.uid : null;

    const { data, error: userError } = await sb
      .from("users")
      .select(
        "uid, display_name, photo_url, bio, work, school, location, interests, profile_details, profile_public, gdg_member, has_active_subscription, account_status, created_at",
      )
      .eq("uid", uid)
      .is("deleted_at", null)
      .maybeSingle();

    if (userError) throw userError;

    if (!data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const isPublic = data.profile_public !== false;
    let connection = {
      likedByMe: false,
      likesMe: false,
      isMutual: false,
    };

    if (viewerUid && viewerUid !== uid) {
      const { data: connectionRows } = await viewerClient.rpc("profile_like_state", {
        p_profile_user_id: uid,
      });
      const connectionRow = Array.isArray(connectionRows)
        ? connectionRows[0]
        : connectionRows;
      connection = {
        likedByMe: connectionRow?.liked_by_me === true,
        likesMe: connectionRow?.likes_me === true,
        isMutual: connectionRow?.mutual === true,
      };
    }

    const detailsVisible = viewerUid === uid || (isPublic && connection.isMutual);
    const structuredDetails = parseProfileDetails(data.profile_details);

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
      detailsVisible,
      connection,
      bio: detailsVisible ? data.bio || "" : "",
      work: detailsVisible ? data.work || "" : "",
      school: detailsVisible ? data.school || "" : "",
      location: detailsVisible ? data.location || "" : "",
      interests: detailsVisible ? data.interests || "" : "",
      profileDetails: detailsVisible
        ? structuredDetails
        : {
            nationality: "",
            languages: [],
            englishLevel: "",
            discussionTopics: [],
            meetupPreferences: "",
          },
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
      { status: 500 },
    );
  }
}
