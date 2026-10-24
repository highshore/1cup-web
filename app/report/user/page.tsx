import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import UserReportClient from "../UserReportClient";
import GlobalLoadingScreen from "../../lib/components/GlobalLoadingScreen";
import { requireSignedInUid } from "../../lib/auth/server_guards";

export const dynamic = "force-dynamic";

export default async function UserReportPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string | string[] }>;
}) {
  const { uid } = await searchParams;
  const uidParam = typeof uid === "string" && uid ? uid : null;
  const uidQuery = uidParam ? `?uid=${encodeURIComponent(uidParam)}` : "";
  const ownUid = await requireSignedInUid(`/report/user${uidQuery}`);
  // Only the owner may view a report for now.
  if (uidParam && uidParam !== ownUid) redirect("/profile");

  return (
    <Suspense fallback={<GlobalLoadingScreen />}>
      <UserReportClient />
    </Suspense>
  );
}
