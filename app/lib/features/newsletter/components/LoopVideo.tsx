"use client";

import { useEffect, useRef } from "react";
import { useInView, usePrefersReducedMotion } from "../hooks";

// Muted decorative loop: plays only while half visible, never with reduced motion.
export default function LoopVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, 0.5);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (inView && !reduced) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [inView, reduced]);

  return (
    <video
      ref={ref}
      className="block h-full w-full object-cover"
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    />
  );
}
