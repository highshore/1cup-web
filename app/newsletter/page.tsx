import { Metadata } from "next";
import NewsletterClient from "./NewsletterClient";

export const metadata: Metadata = {
  title: "1cup Daily | 영어 한잔",
  description:
    "앱 설치 없이, 내가 정한 시간에 매일 한 레슨씩 카카오톡으로 받는 영어. 비즈니스·미드·테크 트랙.",
  // Not indexed until subscriptions open.
  robots: { index: false, follow: false },
};

export default function NewsletterPage() {
  return <NewsletterClient />;
}
