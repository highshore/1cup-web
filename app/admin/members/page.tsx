import { Metadata } from "next";
import AdminClient from "../AdminClient";

export const metadata: Metadata = {
  title: "Members - Admin - OneCup English",
  description: "Manage OneCup English members and subscriptions",
};

export default function AdminMembersPage() {
  return <AdminClient section="members" />;
}
