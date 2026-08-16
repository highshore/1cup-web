import admin from "firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../lib/firebase/firebaseAdmin";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ trackingCode: string }> }
) {
  const { trackingCode } = await params;
  const normalizedCode = trackingCode.trim();
  let destination = new URL(FALLBACK_DESTINATION);
  let isKnownTrackingCode = false;

  try {
    const matches = await db
      .collection("growth_posts")
      .where("trackingCode", "==", normalizedCode)
      .limit(1)
      .get();

    if (!matches.empty) {
      const post = matches.docs[0];
      const data = post.data();
      isKnownTrackingCode = true;
      destination = safeDestination(data.destinationUrl);
      destination.searchParams.set("growth", normalizedCode);
      destination.searchParams.set("utm_source", String(data.channel || "marketing"));
      destination.searchParams.set("utm_medium", "community");
      destination.searchParams.set(
        "utm_campaign",
        String(data.runId || "koreapas-cron")
      );
      destination.searchParams.set("utm_content", normalizedCode);

      await post.ref.update({
        "metrics.clicks": admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
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
