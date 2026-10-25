import { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "내 계정 | One Cup Daily",
  robots: { index: false, follow: false },
};

// Linked from the navbar once signed in, and from the refund notices.
export default function DailyAccountPage() {
  return <AccountClient />;
}
