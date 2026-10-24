"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";

// Keep the entire lesson experience client-only because the speaking engine
// relies on browser media APIs and third-party speech SDKs.
const ShadowLessonFrameDynamic = dynamic(() => import("./ShadowLessonFrame"), {
  ssr: false,
  loading: () => <GlobalLoadingScreen />,
});

export default function ClientWrapper({ lessonId }: { lessonId: string }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <GlobalLoadingScreen />;
  }

  return <ShadowLessonFrameDynamic lessonId={lessonId} />;
}
