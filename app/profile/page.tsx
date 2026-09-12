import { Metadata } from "next";
import ProfileDashboardClient from "./ProfileDashboardClientV2";

export const metadata: Metadata = {
  title: "Profile | OneCup English",
  description: "Manage your member profile, interests, languages and 1 Cup English community details.",
};

export default function ProfilePage() {
  return <ProfileDashboardClient />;
}
