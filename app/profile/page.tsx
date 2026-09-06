import { Metadata } from "next";
import Link from "next/link";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  title: "프로필 | OneCup English",
  description:
    "사용자 프로필 정보, 구독 상태, 저장한 단어 및 영어 한잔 기록을 확인하세요.",
};

export default function ProfilePage() {
  return (
    <>
      <div style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 20px", width: "100%" }}>
        <Link href="/payment/refunds" style={{ fontSize: 14, fontWeight: 800, textDecoration: "underline" }}>
          5회 이용권 환불
        </Link>
      </div>
      <ProfileClient />
    </>
  );
}
