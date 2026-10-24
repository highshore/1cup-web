import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ExamRouteClient from "./ExamRouteClient";

export const dynamic = "force-dynamic";

type ExamPageProps = {
  params: Promise<{ examSlug: string }>;
};

export async function generateMetadata({ params }: ExamPageProps): Promise<Metadata> {
  const { examSlug } = await params;
  if (examSlug !== "toefl-mock-test-01") {
    return {
      title: "Exam Not Found | 1 Cup English",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: "TOEFL Mock Test 01 | 1 Cup English",
    description: "Take TOEFL Mock Test 01 in the 1 Cup English Exam Center.",
    robots: { index: false, follow: false },
  };
}

export default async function ExamPage({ params }: ExamPageProps) {
  const { examSlug } = await params;
  if (examSlug !== "toefl-mock-test-01") notFound();

  return <ExamRouteClient />;
}
