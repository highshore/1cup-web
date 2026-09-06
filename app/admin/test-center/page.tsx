import { Metadata } from "next";

import ExamCenterClient from "./ExamCenterClient";

export const metadata: Metadata = {
  title: "Test Center - Admin - OneCup English",
  description: "Deploy approved speaking tests and review learner scoring evidence.",
};

export default function TestCenterPage() {
  return <ExamCenterClient />;
}
