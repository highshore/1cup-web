import type { Metadata } from "next";

import AdminCancellationsClient from "./AdminCancellationsClient";

export const metadata: Metadata = {
  title: "Meetup Cancellations - Admin - OneCup English",
  description: "Administrator-only log of meetup booking cancellations and same-week attendance.",
};

export default function AdminCancellationsPage() {
  return <AdminCancellationsClient />;
}
