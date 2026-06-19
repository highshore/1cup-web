"use client";

import ErrorFallback from "../lib/components/ErrorFallback";

export default function AuthError({
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
      title="Sign-in problem"
      message="We hit a snag signing you in. Please try again."
    />
  );
}
