import type { Metadata } from "next";
import AccountMembershipClient from "./AccountMembershipClient";

export const metadata: Metadata = {
  title: "Account & Membership | OneCup English",
  description: "Manage your 1 Cup English login methods, membership, participation credits and account.",
};

export default function AccountMembershipPage() {
  return <AccountMembershipClient />;
}
