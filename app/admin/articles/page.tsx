import { Metadata } from "next";
import AdminArticlesClient from "./AdminArticlesClient";

export const metadata: Metadata = {
  title: "Articles - Admin - OneCup English",
  description: "Manage OneCup English articles",
};

export default function AdminArticlesPage() {
  return <AdminArticlesClient />;
}
