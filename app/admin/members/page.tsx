import { Metadata } from "next";
import AdminMembersClient from "./AdminMembersClient";

export const metadata: Metadata = {
  title: "Members - Admin - OneCup English",
  description: "Manage OneCup English members and subscriptions",
};

export default function AdminMembersPage() {
  return <AdminMembersClient />;
}
