"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { useInView, usePrefersReducedMotion } from "../hooks";

const Video = styled.video`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

// Muted decorative loop: plays only while half visible, never with reduced motion.
export default function LoopVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
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
    <Video
      ref={ref}
      className={className}
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
