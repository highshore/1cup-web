import type { Metadata } from "next";

import { MeetupClient } from "./MeetupClient";

export const metadata: Metadata = {
  title: "서울 영어 토론 모임 | 1 Cup English 영어 한잔",
  description:
    "1 Cup English는 서울에서 한국인과 외국인 거주자가 시사, 기술, 비즈니스, 커리어를 영어로 토론하는 소그룹 커뮤니티입니다. 영어를 공통 언어로 사용하며 일반적인 언어교환 모임과는 다르게 토론 중심으로 운영합니다.",
  keywords: [
    "서울 영어 모임",
    "서울 영어 토론",
    "English discussion Seoul",
    "English community Seoul",
    "안암 영어 모임",
    "여의도 영어 모임",
    "1 Cup English",
    "영어 한잔",
  ],
  alternates: { canonical: "/meetup" },
  openGraph: {
    title: "서울 영어 토론 모임 | 1 Cup English",
    description:
      "서울에서 시사, 기술, 비즈니스, 커리어를 주제로 진행하는 1 Cup English 소그룹 영어 토론 모임입니다.",
    type: "website",
    url: "/meetup",
  },
};

export default async function MeetupPage() {
  return (
    <>
      <section className="sr-only" aria-label="1 Cup English meetup overview">
        <h1>서울 영어 토론 모임 1 Cup English</h1>
        <p>
          1 Cup English 영어 한잔은 서울 안암과 여의도에서 한국인과 외국인
          거주자가 시사, 기술, 비즈니스, 커리어 주제를 영어로 토론하는
          커뮤니티입니다. 영어는 토론을 위한 공통 언어이며 일반적인 언어교환
          모임이 아닙니다.
        </p>
      </section>
      <MeetupClient />
    </>
  );
}
