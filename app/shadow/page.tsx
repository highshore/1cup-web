import type { Metadata } from "next";
import ShadowLibraryClient from "./ShadowLibraryClient";

export const metadata: Metadata = {
  title: "Shadow Learning | OneCup English",
  description:
    "Practice shadowing technique for English pronunciation and listening skills",
  alternates: {
    canonical: "/shadow",
  },
  openGraph: {
    title: "Shadow Learning | OneCup English",
    description:
      "Practice shadowing technique for English pronunciation and listening skills",
    url: "/shadow",
    type: "website",
  },
};

export default function ShadowPage() {
  return <ShadowLibraryClient />;
}
