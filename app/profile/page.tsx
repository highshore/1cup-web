import type { Metadata } from "next";
import BumbleProfileClient from "./BumbleProfileClient";

export const metadata: Metadata = {
  title: "프로필 | OneCup English",
  description:
    "프로필을 완성하고, 영어 수준·관심 주제·밋업 선호와 공개 범위를 관리하세요.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <BumbleProfileClient />;
}
