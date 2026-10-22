// Retries Calendar API calls that fail from rate limiting or transient server
// errors. `sleep` is passed in so this stays pure (Utilities.sleep in Apps Script).

const RETRYABLE =
  /rate limit|usage limit|quota|backend error|internal error|\b(429|500|502|503)\b/i;

export function isRetryable(error: unknown): boolean {
  return RETRYABLE.test(error instanceof Error ? error.message : String(error));
}

export function withRetry<T>(
  fn: () => T,
  sleep: (ms: number) => void,
  { attempts = 5, baseDelayMs = 500 } = {},
): T {
  for (let attempt = 1; ; attempt++) {
    try {
      return fn();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
