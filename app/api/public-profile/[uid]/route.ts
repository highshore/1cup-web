import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ uid: string }>;
};

const toIso = (value: any) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
};

const countArrayContains = async (collectionName: string, field: string, uid: string) => {
  try {
    const snapshot = await db
      .collection(collectionName)
      .where(field, "array-contains", uid)
      .get();
    return snapshot.size;
  } catch {
    return 0;
  }
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { uid } = await context.params;

  if (!uid || uid.length > 160) {
    return NextResponse.json({ error: "Invalid profile id" }, { status: 400 });
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const data = userDoc.data() || {};
    const publicProfileDisabled = data.profilePublic === false;

    if (publicProfileDisabled) {
      return NextResponse.json({ error: "Profile is private" }, { status: 403 });
    }

    const reportsSnapshot = await db
      .collection("users")
      .doc(uid)
      .collection("speaking_reports")
      .get();

    let scoreTotal = 0;
    let scoreCount = 0;
    reportsSnapshot.forEach((doc) => {
      const score = Number(doc.data()?.analysis?.overallScore);
      if (Number.isFinite(score)) {
        scoreTotal += score;
        scoreCount += 1;
      }
    });

    const [meetupParticipantCount, meetupLeaderCount, eventsParticipantCount, eventsLeaderCount] =
      await Promise.all([
        countArrayContains("meetup", "participants", uid),
        countArrayContains("meetup", "leaders", uid),
        countArrayContains("events", "participants", uid),
        countArrayContains("events", "leaders", uid),
      ]);

    const publicProfile = {
      uid,
      displayName: data.displayName || data.name || `Member ${uid.slice(0, 6)}`,
      photoURL: data.photoURL || data.avatar || null,
      bio: data.bio || "",
      work: data.work || "",
      school: data.school || "",
      location: data.location || "",
      interests: data.interests || "",
      badges: {
        gdgMember: data.gdg_member === true,
        activeMember: data.hasActiveSubscription === true,
        role:
          data.account_status === "admin" || data.account_status === "leader"
            ? data.account_status
            : null,
      },
      stats: {
        meetupCount:
          meetupParticipantCount +
          meetupLeaderCount +
          eventsParticipantCount +
          eventsLeaderCount,
        speakingReports: reportsSnapshot.size,
        averageSpeakingScore:
          scoreCount > 0 ? Math.round((scoreTotal / scoreCount) * 10) / 10 : null,
      },
      memberSince: toIso(data.createdAt),
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
