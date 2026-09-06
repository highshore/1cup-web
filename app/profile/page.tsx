import { Metadata } from "next";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  title: "프로필 | OneCup English",
  description:
    "사용자 프로필 정보, 구독 상태, 저장한 단어 및 영어 한잔 기록을 확인하세요.",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
