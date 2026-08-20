/* eslint-disable react-refresh/only-export-components -- Next.js route metadata */
import type { Metadata } from "next";

import AdminNotificationsClient from "./AdminNotificationsClient";

export const metadata: Metadata = {
  title: "Notifications - Admin - OneCup English",
  description: "Send and audit in-app OneCup English member notifications",
};

export default function AdminNotificationsPage() {
  return <AdminNotificationsClient />;
}
