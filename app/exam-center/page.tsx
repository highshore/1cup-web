import type { Metadata } from "next";

import SpeakingTestClient from "../speaking-test/SpeakingTestClient";

export const metadata: Metadata = {
  title: "English Exam Practice Center | 1 Cup English",
  description:
    "Practice timed English exams, record responses, and receive structured feedback in the 1 Cup English Exam Practice Center.",
};

export const dynamic = "force-dynamic";

export default function ExamCenterPage() {
  return <SpeakingTestClient />;
}
