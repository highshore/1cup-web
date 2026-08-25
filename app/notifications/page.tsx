import type { Metadata } from "next";

import NotificationsClient from "./NotificationsClient";

export const metadata: Metadata = {
  title: "Notifications | One Cup English",
  description: "Your One Cup English notifications.",
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
