/**
 * Shared retry + error-triage helpers.
 *
 * Principle: triage the error first (is it worth retrying?), then retry
 * transient failures with exponential backoff + jitter. Never retry
 * deterministic failures (4xx other than 429, validation, auth).
 */

export interface RetryOptions {
  /** Max attempts including the first one. Default 3. */
  retries?: number;
  /** Base delay in ms for exponential backoff. Default 300. */
  baseDelayMs?: number;
  /** Cap on a single backoff delay in ms. Default 5000. */
  maxDelayMs?: number;
  /** Decide whether a thrown error / rejected value is worth retrying. */
  isRetryable?: (error: unknown) => boolean;
  /** Optional hook for logging each retry. */
  onRetry?: (error: unknown, attempt: number) => void;
}

/** HTTP statuses that represent transient, retryable upstream failures. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

/**
 * Triage an arbitrary error. Network/timeout errors and transient HTTP
 * statuses are retryable; everything else (auth, validation, 4xx) is not.
 */
export function isTransient(error: unknown): boolean {
  if (error == null) return false;

  // A thrown Response or an object carrying a status code.
  const status = (error as { status?: number }).status;
  if (typeof status === "number") return isRetryableStatus(status);

  const name = (error as { name?: string }).name;
  if (name === "AbortError") return false; // intentional cancellation

  const code = (error as { code?: string }).code;
  if (typeof code === "string") {
    return [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "EPIPE",
      "ENOTFOUND",
    ].includes(code);
  }

  // Bare network failures from fetch surface as a generic TypeError.
  if (error instanceof TypeError) return true;

  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying transient failures with exponential backoff + jitter.
 * Rethrows the last error once retries are exhausted or the error is
 * classified as non-retryable.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    isRetryable = isTransient,
    onRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryable(error)) break;
      onRetry?.(error, attempt);
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.25;
      await sleep(backoff + jitter);
    }
  }
  throw lastError;
}

/**
 * fetch() with retry on network errors and transient HTTP statuses
 * (408/429/5xx). A non-retryable response (e.g. 4xx) is returned as-is so
 * the caller can handle it; only network/transient failures are retried.
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(input, init);
    if (isRetryableStatus(response.status)) {
      // Throw so withRetry triages + retries; carries status for isTransient.
      throw Object.assign(
        new Error(`Upstream responded with ${response.status}`),
        { status: response.status, response }
      );
    }
    return response;
  }, options).catch((error) => {
    // If we exhausted retries on a transient HTTP status, hand back the
    // last Response instead of throwing, so callers keep their status logic.
    const response = (error as { response?: Response }).response;
    if (response) return response;
    throw error;
  });
}
