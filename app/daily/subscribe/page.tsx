import { Metadata } from "next";
import SubscribeClient from "./SubscribeClient";

export const metadata: Metadata = {
  title: "구독 안내 | One Cup Daily",
  robots: { index: false, follow: false },
};

// Opened from the trial-ended message and from the lesson page's trial banner.
export default function DailySubscribePage() {
  return <SubscribeClient />;
}
