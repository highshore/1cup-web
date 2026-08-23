"use client";

import { useEffect } from "react";

import UnifiedErrorPanel from "./UnifiedErrorPanel";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}

/** Shared visual language for every App Router error boundary. */
export default function ErrorFallback({
  error,
  reset,
  title = "페이지를 불러오지 못했습니다",
  message = "일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
}: ErrorFallbackProps) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <UnifiedErrorPanel
      title={title}
      message={message}
      detail={error?.digest ? `ref: ${error.digest}` : null}
      onRetry={reset}
    />
  );
}
