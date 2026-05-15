import { Metadata } from "next";
import PublicProfileClient from "./PublicProfileClient";

export const metadata: Metadata = {
  title: "공개 프로필 | OneCup English",
  description: "영어 한잔 멤버의 공개 프로필을 확인하세요.",
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  return <PublicProfileClient uid={uid} />;
}
