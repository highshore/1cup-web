import { redirect } from "next/navigation";

export default function LegacyConnectionsRoute() {
  redirect("/profile?section=connections");
}
