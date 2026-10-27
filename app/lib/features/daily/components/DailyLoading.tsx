"use client";

import dynamic from "next/dynamic";
import loadingAnimation from "../../../../../public/animations/loading.json";
import { cn } from "./DailyUI";

// The same Lottie loader 1cup shows between pages (GlobalLoadingScreen), sized to sit
// inside a Daily page while its data loads, with a line saying what it is waiting for,
// so a slow load never looks like a frozen page.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function DailyLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center py-8", className)}>
      <div aria-hidden className="size-[120px]">
        <Lottie animationData={loadingAnimation} loop autoplay />
      </div>
      <p className="-mt-2 text-[0.92rem] font-bold text-[#64748b]">{label}</p>
    </div>
  );
}
