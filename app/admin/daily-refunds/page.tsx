import type { Metadata } from "next";

import AdminDailyRefundsClient from "./AdminDailyRefundsClient";

export const metadata: Metadata = {
  title: "Daily Refunds - Admin - OneCup English",
  description: "Administrator-only approval of One Cup Daily refund requests.",
};

export default function AdminDailyRefundsPage() {
  return <AdminDailyRefundsClient />;
}
