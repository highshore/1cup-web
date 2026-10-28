import type { ReactNode } from "react";
import OpenAIAdsPixel from "../lib/features/daily/ads/OpenAIAdsPixel";

// Only Daily routes use the OpenAI Pixel; the unrelated meetup and blog pages do not.
export default function DailyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <OpenAIAdsPixel />
    </>
  );
}
