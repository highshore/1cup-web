import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requireAdmin, requireSignedInUid } from "../../lib/auth/server_guards";
import { isDailyAdmin } from "../../lib/features/daily/server/admin_access";

export const metadata: Metadata = {
  title: "Daily 관리자 | One Cup Daily",
  robots: { index: false, follow: false },
};

// One Cup Daily's own admin, apart from 1cup's /admin. Staff sign in with their 1cup
// admin account (Daily customers have no admin role), and that account's phone number must
// be on daily_config.admin_access_phones; checked here, on the server.
export default async function DailyAdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const uid = await requireSignedInUid("/daily/admin");
  if (!(await isDailyAdmin(uid))) redirect("/daily");
  return children;
}
