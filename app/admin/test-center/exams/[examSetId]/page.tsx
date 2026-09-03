import type { Metadata } from "next";

import ExamInspectionClient from "./ExamInspectionClient";

export const metadata: Metadata = { title: "Inspect exam - Admin - OneCup English" };

export default async function ExamInspectionPage({ params }: { params: Promise<{ examSetId: string }> }) {
  const { examSetId } = await params;
  return <ExamInspectionClient examSetId={examSetId} />;
}
