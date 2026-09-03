import { Metadata } from "next";

import ExamCenterClient from "./ExamCenterClient";

export const metadata: Metadata = {
  title: "Exam Interviewer Pipeline - Admin - OneCup English",
  description: "Build interviewer-led speaking exams, inspect media readiness, and publish practice runs.",
};

export default function TestCenterPage() {
  return <ExamCenterClient />;
}
