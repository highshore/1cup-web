import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireAdmin } from "../../lib/auth/server_guards";

export const metadata: Metadata = {
  title: "Daily 관리자 | One Cup Daily",
  robots: { index: false, follow: false },
};

// One Cup Daily's own admin, apart from 1cup's /admin. Staff sign in with their 1cup
// admin account (Daily customers have no admin role); checked here, on the server.
export default async function DailyAdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
