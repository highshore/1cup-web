import { Metadata } from "next";
import AdminArticlesClient from "./AdminArticlesClient";

export const metadata: Metadata = {
  title: "Articles - Admin - OneCup English",
  description: "Manage OneCup English articles",
};

// Keep article management isolated from the dashboard client so this route can
// page through the article table instead of downloading the entire collection.
export default function AdminArticlesPage() {
  return <AdminArticlesClient />;
}
