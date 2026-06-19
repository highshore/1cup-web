"use client";

import ErrorFallback from "../lib/components/ErrorFallback";

export default function ShadowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Shadowing session interrupted"
      message="The speaking engine ran into a problem. Check your microphone permissions and try again."
    />
  );
}
