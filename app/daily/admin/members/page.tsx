import { loadDailyMembers } from "../../../lib/features/daily/server/admin";
import DailyAdminMembersClient from "./DailyAdminMembersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "멤버 관리 | Daily 관리자", robots: { index: false, follow: false } };

export default async function DailyAdminMembersPage() {
  return <DailyAdminMembersClient members={await loadDailyMembers()} />;
}
