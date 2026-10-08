import { Metadata } from "next";
import { requireSignedIn } from "../lib/auth/server_guards";
import ProfileDashboardClient from "./ProfileDashboardClientV2";
import styles from "./mobile-profile-sync.module.css";

export const metadata: Metadata = {
  title: "Profile | OneCup English",
  description: "Manage your member profile, interests, languages and 1 Cup English community details.",
};

export default async function ProfilePage() {
  await requireSignedIn("/profile");
  return (
    <div className={styles.root}>
      <ProfileDashboardClient />
    </div>
  );
}
