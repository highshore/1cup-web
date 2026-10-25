import { Suspense } from "react";
import { Metadata } from "next";
import StartClient from "./StartClient";

export const metadata: Metadata = {
  title: "무료로 받아보기 | One Cup Daily",
  description: "카드 등록 없이 오늘의 영어 레슨 1회를 카카오톡으로 받아보세요.",
  robots: { index: false, follow: false },
};

export default function DailyStartPage() {
  return (
    <Suspense>
      <StartClient />
    </Suspense>
  );
}
