import { Suspense } from "react";
import { Metadata } from "next";
import ResultClient from "./ResultClient";

export const metadata: Metadata = {
  title: "결제 결과 | One Cup Daily",
  robots: { index: false, follow: false },
};

// Payple returns here, through its server callback (query) or the browser callback
// (session storage); this page settles the order exactly once on the server.
export default function DailyPaymentResultPage() {
  return (
    <Suspense>
      <ResultClient />
    </Suspense>
  );
}
