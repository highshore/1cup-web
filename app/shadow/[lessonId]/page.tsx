import type { Metadata } from "next";

import ClientWrapper from "../ClientWrapper";

interface ShadowLessonPageProps {
  params: Promise<{ lessonId: string }>;
}

export const metadata: Metadata = {
  title: "Shadow Learning | OneCup English",
  description: "Practice English pronunciation and listening with timestamped video shadowing.",
};

export default async function ShadowLessonPage({ params }: ShadowLessonPageProps) {
  const { lessonId } = await params;
  return <ClientWrapper lessonId={lessonId} />;
}
