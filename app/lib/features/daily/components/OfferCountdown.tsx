"use client";

import { useEffect, useRef, useState } from "react";
import { formatTimeLeft } from "../offer";
import { cn } from "./DailyUI";

/**
 * A ticking "HH:MM:SS" until `expiresAt`. Renders a placeholder until mounted so the
 * server-rendered lesson page and the browser agree, then calls `onExpire` once when the
 * time is up (the subscribe page reloads its prices then).
 */
export default function OfferCountdown({
  expiresAt,
  onExpire,
  className,
}: {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}) {
  const [left, setLeft] = useState<number | null>(null);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    expired.current = false;
    const tick = () => {
      const ms = end - Date.now();
      setLeft(ms);
      if (ms <= 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return (
    <span className={cn("tabular-nums", className)} role="timer" aria-live="off">
      {left === null ? "--:--:--" : formatTimeLeft(left)}
    </span>
  );
}
