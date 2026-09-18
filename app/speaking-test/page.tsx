import type { Metadata } from "next";

import SpeakingTestClient from "./SpeakingTestClient";

export const metadata: Metadata = {
  title: "English Exam Practice Center | 1 Cup English",
  description: "Practice realistic English speaking exams with timed prompts, browser recording, and structured feedback from 1 Cup English.",
};

export const dynamic = "force-dynamic";

export default function SpeakingTestPage() {
  return <SpeakingTestClient />;
}
