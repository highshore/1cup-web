import type { Metadata } from "next";

import ExamPreviewClient from "./ExamPreviewClient";

export const metadata: Metadata = { title: "Run exam preview - Admin - OneCup English" };

export default async function ExamPreviewPage({ params }: { params: Promise<{ examSetId: string }> }) {
  const { examSetId } = await params;
  return <ExamPreviewClient examSetId={examSetId} />;
}
