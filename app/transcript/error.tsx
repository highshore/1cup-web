"use client";

import ErrorFallback from "../lib/components/ErrorFallback";

export default function TranscriptError({
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
      title="Transcript unavailable"
      message="We couldn't load or record this transcript. Your recording is not lost — try again."
    />
  );
}
