"use client";

import ErrorFallback from "./lib/components/ErrorFallback";

/**
 * Root error boundary. Catches errors thrown in the root layout itself;
 * must render its own <html>/<body> because it replaces the layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ErrorFallback
          error={error}
          reset={reset}
          message="The page failed to load. Please try again, or head back to the homepage."
        />
      </body>
    </html>
  );
}
