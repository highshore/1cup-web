import { Metadata } from "next";
import SocialChannelAdmin from "../../lib/features/growth/components/SocialChannelAdmin";

export const metadata: Metadata = {
  title: "Instagram - Admin - OneCup English",
  description: "Instagram posts, performance and account connection",
};

// Admin access is enforced by app/admin/layout.tsx; the page loads its own data.
export default function AdminInstagramPage() {
  return <SocialChannelAdmin channel="instagram" />;
}
