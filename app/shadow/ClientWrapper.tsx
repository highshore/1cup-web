"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";

// Dynamically import ShadowClient with no SSR to prevent document access during build
const ShadowClientDynamic = dynamic(() => import("./ShadowClient"), {
  ssr: false,
  loading: () => <GlobalLoadingScreen />,
});

export default function ClientWrapper({ lessonId }: { lessonId: string }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Ensure we're fully client-side before rendering
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <GlobalLoadingScreen />;
  }

  return <ShadowClientDynamic lessonId={lessonId} />;
}
