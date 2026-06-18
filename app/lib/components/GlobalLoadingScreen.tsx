"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import dynamic from "next/dynamic";
import loadingAnimation from "../../../public/animations/loading.json";

// Dynamic import for Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const LoadingOverlay = styled.div<{
  $fullScreen?: boolean;
  $whiteBackground?: boolean;
}>`
  position: ${(props) => (props.$fullScreen ? "fixed" : "relative")};
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: ${(props) =>
    props.$whiteBackground ? "#fdf9f6" : "transparent"};
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: ${(props) =>
    props.$fullScreen
      ? "9999"
      : "1"}; /* Very high z-index to ensure it's above everything */

  /* Ensure it breaks out of any container constraints */
  ${(props) =>
    props.$fullScreen &&
    `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
  `}
`;

const LoadingContainer = styled.div<{ $size?: "small" | "medium" | "large" }>`
  width: ${(props) => {
    switch (props.$size) {
      case "small":
        return "150px";
      case "large":
        return "300px";
      default:
        return "250px";
    }
  }};
  height: ${(props) => {
    switch (props.$size) {
      case "small":
        return "150px";
      case "large":
        return "300px";
      default:
        return "250px";
    }
  }};
  display: flex;
  justify-content: center;
  align-items: center;
  transform: translateY(-60px); /* Pull up by GNB height */

  @media (max-width: 768px) {
    width: ${(props) => {
      switch (props.$size) {
        case "small":
          return "120px";
        case "large":
          return "250px";
        default:
          return "200px";
      }
    }};
    height: ${(props) => {
      switch (props.$size) {
        case "small":
          return "120px";
        case "large":
          return "250px";
        default:
          return "200px";
      }
    }};
    transform: translateY(-50px); /* Pull up by mobile GNB height */
  }
`;

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
    <LoadingOverlay
      $fullScreen={fullScreen}
      $whiteBackground={whiteBackground}
      className={className}
    >
      <LoadingContainer $size={size}>
        <Lottie animationData={loadingAnimation} loop={true} autoplay={true} />
      </LoadingContainer>
    </LoadingOverlay>
  );

  // For fullScreen mode, use portal to render at document body level
  if (fullScreen && mounted && typeof document !== "undefined") {
    return createPortal(loadingElement, document.body);
  }

  // For non-fullScreen mode, render normally
  return loadingElement;
}
