import { redirect } from "next/navigation";

export default function LegacyAccountRoute() {
  redirect("/profile?section=account");
}
