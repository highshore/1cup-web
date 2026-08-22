import { Metadata } from "next";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Portal - OneCup English",
  description: "OneCup English administration portal",
};

export default function AdminPage() {
  return <AdminDashboardClient />;
}
