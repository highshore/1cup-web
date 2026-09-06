import { Metadata } from "next";
import { Suspense } from "react";
import RegionalPaymentClient from "./RegionalPaymentClient";

export const metadata: Metadata = {
  title: "영어 한잔 이용권 | OneCup English",
  description:
    "안암 또는 여의도 지역을 선택하고 30일 이용권이나 5회 이용권을 구매하세요.",
};

// Kill-switch for the payment feature during the Supabase migration/cutover.
// Payment is DISABLED unless PAYMENT_ENABLED === "true" (server env).
const PAYMENT_ENABLED = process.env.PAYMENT_ENABLED === "true";

export default function PaymentPage() {
  if (!PAYMENT_ENABLED) {
    return (
      <div style={{ maxWidth: 560, margin: "96px auto", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>결제 서비스 점검 안내</h1>
        <p style={{ color: "#555", lineHeight: 1.7 }}>
          현재 시스템 개선 작업으로 멤버십 결제가 일시적으로 중단되었습니다.
          <br />
          빠른 시일 내에 다시 이용하실 수 있도록 하겠습니다. 이용에 불편을 드려 죄송합니다.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <RegionalPaymentClient />
    </Suspense>
  );
}
