import type { Metadata } from "next";

import { MeetupClient } from "./MeetupClient";
import { SITE_NAME } from "../lib/seo/site";

export const metadata: Metadata = {
  title: `영어 토론 밋업 | ${SITE_NAME}`,
  description:
    "서울에서 시사·비즈니스·테크 주제를 영어로 토론하는 영어 한잔의 참여 가능한 밋업 일정과 장소를 확인하세요.",
  keywords: [
    "서울 영어 모임",
    "영어 토론 모임",
    "직장인 영어 모임",
    "비즈니스 영어 모임",
  ],
  alternates: {
    canonical: "/meetup",
  },
  openGraph: {
    title: `영어 토론 밋업 | ${SITE_NAME}`,
    description:
      "서울에서 시사·비즈니스·테크 주제를 영어로 토론하는 영어 한잔의 참여 가능한 밋업 일정과 장소를 확인하세요.",
    type: "website",
    url: "/meetup",
  },
};

export default async function MeetupPage() {
  return <MeetupClient />;
}
