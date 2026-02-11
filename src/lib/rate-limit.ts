const requests = new Map<string, number[]>();

/**
 * Simple in-memory rate limiter.
 * Returns true if the request is allowed, false if rate limited.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const timestamps = requests.get(key) || [];

  // Remove expired timestamps
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    const oldestValid = valid[0];
    const retryAfterMs = windowMs - (now - oldestValid);
    return { allowed: false, retryAfterMs };
  }

  valid.push(now);
  requests.set(key, valid);
  return { allowed: true, retryAfterMs: 0 };
}