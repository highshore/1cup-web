import type { Metadata } from "next";

import SpeakingTestClient from "./SpeakingTestClient";

export const metadata: Metadata = {
  title: "Speaking Tests | 1 Cup English",
  description: "Choose a deployed speaking test, record each response, and receive an evidence-based TOEFL practice score.",
};

export const dynamic = "force-dynamic";

export default function SpeakingTestPage() {
  return <SpeakingTestClient />;
}
