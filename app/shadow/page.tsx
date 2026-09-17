import { Metadata } from "next";
import ShadowLibraryClient from "./ShadowLibraryClient";

export const metadata: Metadata = {
  title: "Shadow Learning | OneCup English",
  description:
    "Practice shadowing technique for English pronunciation and listening skills",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ShadowPage() {
  return <ShadowLibraryClient />;
}
