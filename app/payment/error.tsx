"use client";

import ErrorFallback from "../lib/components/ErrorFallback";

export default function PaymentError({
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
      title="Payment couldn't be completed"
      message="No charge has been confirmed. Please try again. If you were charged, contact support before retrying."
    />
  );
}
