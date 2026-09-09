import type { Metadata } from "next";
import React from "react";
import CefrClient from "./CefrClient";

export const metadata: Metadata = {
  title: "CEFR Classifier | OneCup English",
  description: "Classify words in text by CEFR levels and visualize distribution.",
  alternates: {
    canonical: "/cefr",
  },
  openGraph: {
    title: "CEFR Classifier | OneCup English",
    description: "Classify words in text by CEFR levels and visualize distribution.",
    url: "/cefr",
    type: "website",
  },
};

export default function Page() {
  return <CefrClient />;
}
