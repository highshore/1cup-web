import { Metadata } from "next";
import AdminClient from "../AdminClient";

export const metadata: Metadata = {
  title: "Marketing - Admin - OneCup English",
  description: "Schedule Gopas posts and review marketing performance",
};

export default function AdminMarketingPage() {
  return <AdminClient section="marketing" />;
}
