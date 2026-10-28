import { Metadata } from "next";
import ReviewClient from "./ReviewClient";

export const metadata: Metadata = {
  title: "후기 남기기 | One Cup Daily",
  robots: { index: false, follow: false },
};

// The review form, linked from every lesson page and the guide. Writing one earns 14 days
// once (terms 제9조의3).
export default function DailyReviewPage() {
  return <ReviewClient />;
}
