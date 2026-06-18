"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalLoadingScreen from "./GlobalLoadingScreen";

const LOADER_DELAY_MS = 140;
const LOADER_MAX_MS = 8000;

export default function RouteTransitionLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const delayTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (delayTimerRef.current !== null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  };

  const hide = () => {
    clearTimers();
    setVisible(false);
  };

  useEffect(() => {
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const targetAttr = anchor.getAttribute("target");
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.hasAttribute("download") ||
        (targetAttr && targetAttr !== "_self")
      ) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (
        nextUrl.origin !== currentUrl.origin ||
        nextUrl.pathname === currentUrl.pathname
      ) {
        return;
      }

      clearTimers();
      delayTimerRef.current = window.setTimeout(() => {
        setVisible(true);
      }, LOADER_DELAY_MS);
      maxTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, LOADER_MAX_MS);
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return <GlobalLoadingScreen />;
}
