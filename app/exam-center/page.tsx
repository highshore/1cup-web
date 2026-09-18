import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";

import ExamCenterClient from "./ExamCenterClient";
import "./exam-center.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Exam Center | 1 Cup English",
  description:
    "Practice full English mock exams in the 1 Cup English Exam Center, including a TOEFL iBT interface preview.",
};

export const dynamic = "force-dynamic";

export default function ExamCenterPage() {
  return (
    <div className={openSans.className}>
      <ExamCenterClient />
    </div>
  );
}
