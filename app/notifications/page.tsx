import type { Metadata } from "next";

import { requireSignedIn } from "../lib/auth/server_guards";
import NotificationsClient from "./NotificationsClient";

export const metadata: Metadata = {
  title: "Notifications | One Cup English",
  description: "Your One Cup English notifications.",
};

export default async function NotificationsPage() {
  await requireSignedIn("/notifications");
  return <NotificationsClient />;
}
