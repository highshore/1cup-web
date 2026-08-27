import type { Metadata } from "next";

import AdminShadowClient from "./AdminShadowClient";

export const metadata: Metadata = {
  title: "Shadowing - Admin - OneCup English",
  description: "Process and publish timestamped shadowing lessons.",
};

export default function AdminShadowPage() {
  return <AdminShadowClient />;
}
