import { Metadata } from "next";
import AdminClient from "../AdminClient";

export const metadata: Metadata = {
  title: "Marketing - Admin - OneCup English",
  description: "Review Growth Agent marketing activity and performance",
};

export default function AdminMarketingPage() {
  return <AdminClient section="marketing" />;
}
