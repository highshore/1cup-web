"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import loadingAnimation from "../../../public/animations/loading.json";

// Dynamic import for Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const containerSizeClasses: Record<"small" | "medium" | "large", string> = {
  small:
    "h-[150px] w-[150px] max-[768px]:h-[120px] max-[768px]:w-[120px]",
  medium:
    "h-[250px] w-[250px] max-[768px]:h-[200px] max-[768px]:w-[200px]",
  large:
    "h-[300px] w-[300px] max-[768px]:h-[250px] max-[768px]:w-[250px]",
};

interface GlobalLoadingScreenProps {
  /** Show as full screen overlay (covers entire viewport) */
  fullScreen?: boolean;
  /** Size of the loading animation */
  size?: "small" | "medium" | "large";
  /** Use white background instead of transparent */
  whiteBackground?: boolean;
  /** Custom className for additional styling */
  className?: string;
}

export default function GlobalLoadingScreen({
  fullScreen = true, // Default to fullScreen for better UX
  size = "medium",
  whiteBackground = true,
  className,
}: GlobalLoadingScreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadingElement = (
    <div
      className={`flex h-screen w-screen items-center justify-center ${
        fullScreen
          ? // Very high z-index + !important overrides so the overlay breaks
            // out of any container constraints, matching the previous styles.
            "fixed! inset-0! z-[9999] m-0! h-screen! w-screen! transform-none! p-0!"
          : "relative top-0 left-0 z-[1]"
      } ${whiteBackground ? "bg-[#fdf9f6]" : "bg-transparent"} ${
        className ?? ""
      }`}
    >
      <div
        className={`flex -translate-y-[60px] items-center justify-center max-[768px]:-translate-y-[50px] ${containerSizeClasses[size]}`}
      >
        <Lottie animationData={loadingAnimation} loop={true} autoplay={true} />
      </div>
    </div>
  );

  // For fullScreen mode, use portal to render at document body level
  if (fullScreen && mounted && typeof document !== "undefined") {
    return createPortal(loadingElement, document.body);
  }

  // For non-fullScreen mode, render normally
  return loadingElement;
}
