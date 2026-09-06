import type { Metadata } from "next";
import ParticipationRefundClient from "./ParticipationRefundClient";

export const metadata: Metadata = {
  title: "5회 이용권 환불 | OneCup English",
  description: "5회 이용권의 남은 횟수와 예상 환불액을 확인하고 환불을 신청하세요.",
};

export default function ParticipationRefundPage() {
  return <ParticipationRefundClient />;
}
