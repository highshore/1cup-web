import { Metadata } from "next";
import AdminClient from "../AdminClient";

export const metadata: Metadata = {
  title: "Articles - Admin - OneCup English",
  description: "Manage OneCup English articles",
};

export default function AdminArticlesPage() {
  return <AdminClient section="articles" />;
}
