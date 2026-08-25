import { Metadata } from "next";

import SpeakingTestBuilderClient from "../speaking-test-builder/SpeakingTestBuilderClient";

export const metadata: Metadata = {
  title: "Test Center - Admin - OneCup English",
  description: "Build speaking tests and review test performance.",
};

export default function TestCenterPage() {
  return <SpeakingTestBuilderClient />;
}
