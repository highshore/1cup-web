"use client";

import { useEffect } from "react";
import { colors } from "../constants/colors";

interface ErrorFallbackProps {
  /** The error caught by the nearest error boundary. */
  error: Error & { digest?: string };
  /** Re-render the segment to attempt recovery. */
  reset: () => void;
  /** Optional heading override for route-specific messaging. */
  title?: string;
  /** Optional supporting line override. */
  message?: string;
}

/**
 * Shared fallback UI for App Router error boundaries. Logs the error once
 * and offers recovery (retry) plus an escape hatch (go home). Kept inline-
 * styled so it renders even when a layout/stylesheet fails to load.
 */
export default function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  message = "An unexpected error occurred. You can try again, or head back to the homepage.",
}: ErrorFallbackProps) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem 1.5rem",
        textAlign: "center",
        fontFamily: '"Noto Sans KR", sans-serif',
        color: colors.text.dark,
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
        {title}
      </h1>
      <p
        style={{
          fontSize: "0.95rem",
          color: colors.text.medium,
          maxWidth: "28rem",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {message}
      </p>
      {error?.digest && (
        <code style={{ fontSize: "0.75rem", color: colors.text.light }}>
          ref: {error.digest}
        </code>
      )}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button
          onClick={reset}
          style={{
            padding: "0.65rem 1.4rem",
            borderRadius: "9999px",
            border: "none",
            background: colors.primary,
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            padding: "0.65rem 1.4rem",
            borderRadius: "9999px",
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.text.dark,
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
