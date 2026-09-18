import type { Metadata } from "next";

import SpeakingTestClient from "./SpeakingTestClient";

export const metadata: Metadata = {
  title: "English Exam Practice Center | 1 Cup English",
  description: "Practice timed English speaking exams, record responses, and receive structured AI feedback in the 1 Cup English Exam Practice Center.",
};

export const dynamic = "force-dynamic";

export default function SpeakingTestPage() {
  return <SpeakingTestClient />;
}
