import type { Metadata } from "next";

import AdminDailySentencesClient from "./AdminDailySentencesClient";

export const metadata: Metadata = {
  title: "Daily Sentences - Admin - OneCup English",
  description: "Administrator-only moderation of One Cup Daily sentences and 통역사 PICK.",
};

export default function AdminDailySentencesPage() {
  return <AdminDailySentencesClient />;
}
