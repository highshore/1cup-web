import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "이용 가이드 | 영어 한잔",
  description:
    "영어 한잔 밋업 신청, 토픽 확인, 참여 방법과 운영 원칙을 안내합니다.",
  alternates: {
    canonical: "/guide",
  },
  openGraph: {
    title: "이용 가이드 | 영어 한잔",
    description:
      "영어 한잔 밋업 신청, 토픽 확인, 참여 방법과 운영 원칙을 안내합니다.",
    url: "/guide",
    type: "website",
  },
};

export default function GuideLayout({ children }: { children: ReactNode }) {
  return children;
}
