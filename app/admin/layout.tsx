
import type { ReactNode } from "react";

import { requireAdmin } from "../lib/auth/server_guards";
import AdminNav from "./AdminNav";

// Every admin route is admin-only. Checking here, on the server, replaces the per-page
// useEffect redirects that briefly rendered each admin page to signed-out visitors and
// members before sending them away. The shared AdminNav groups every admin area.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
