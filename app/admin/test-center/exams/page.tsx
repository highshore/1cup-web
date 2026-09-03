import type { Metadata } from "next";

import ExamSetupClient from "./ExamSetupClient";

export const metadata: Metadata = {
  title: "Set up an exam - Admin - OneCup English",
};

export default async function ExamSetupPage({ searchParams }: { searchParams: Promise<{ interviewer?: string }> }) {
  const { interviewer } = await searchParams;
  return <ExamSetupClient initialInterviewerId={interviewer || ""} />;
}
