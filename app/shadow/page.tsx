import { Metadata } from "next";
import ShadowLibraryClient from "./ShadowLibraryClient";

export const metadata: Metadata = {
  title: "Shadow Learning | OneCup English",
  description:
    "Practice shadowing technique for English pronunciation and listening skills",
};

export default function ShadowPage() {
  return <ShadowLibraryClient />;
}
