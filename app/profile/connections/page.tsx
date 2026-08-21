import { Metadata } from "next";
import ConnectionsClient from "./ConnectionsClient";

export const metadata: Metadata = {
  title: "내 네트워크 | One Cup English",
  description: "영어 한잔에서 서로 연결된 멤버를 확인하세요.",
};

export default function ConnectionsPage() {
  return <ConnectionsClient />;
}
