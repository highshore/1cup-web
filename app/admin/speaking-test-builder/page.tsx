import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Test Center - Admin - OneCup English",
  description: "Build speaking tests and review test performance.",
};

export default function SpeakingTestBuilderPage() {
  redirect("/admin/test-center");
}
