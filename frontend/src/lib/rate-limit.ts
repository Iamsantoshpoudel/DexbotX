/** Seconds from a Retry-After header (delta-seconds form), or null if absent or unusable. */
export function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const n = Number(header.trim());
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null;
}

/** Human message for an HTTP 429, with the wait time when the server told us. */
export function rateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) return 'Too many requests. Wait a moment and try again.';
  return `Too many requests. Try again in ${retryAfterSeconds}s.`;
}
