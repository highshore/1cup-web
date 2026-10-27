import { Metadata } from "next";
import BookClient from "./BookClient";

export const metadata: Metadata = {
  title: "내 학습 기록 | One Cup Daily",
  robots: { index: false, follow: false },
};

// Every expression the reader received, and their streak. Linked from the lesson page
// and the account page.
export default function DailyBookPage() {
  return <BookClient />;
}
