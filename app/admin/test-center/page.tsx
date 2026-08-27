import { Metadata } from "next";

import TestCenterFactoryClient from "./TestCenterFactoryClient";

export const metadata: Metadata = {
  title: "TOEFL Speaking 2026 Factory - Admin - OneCup English",
  description: "Generate, review, and publish 2026+ TOEFL Speaking practice sets.",
};

export default function TestCenterPage() {
  return <TestCenterFactoryClient />;
}
