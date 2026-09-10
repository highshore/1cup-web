import type { Metadata } from "next";
import ProfileClient from "../ProfileClient";

export const metadata: Metadata = {
  title: "계정 및 멤버십 | OneCup English",
  description: "결제, 로그인 수단, 추천 코드 및 계정 설정을 관리하세요.",
  robots: { index: false, follow: false },
};

export default function ProfileAccountPage() {
  return <ProfileClient />;
}
