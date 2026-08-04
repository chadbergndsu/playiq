/**
 * Simple in-memory sliding-window rate limiter for public API handlers.
 * Best-effort on serverless (per isolate). Prefer platform-trusted client IP.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number; now?: number } = {
    limit: 30,
    windowMs: 60_000,
  },
): RateLimitResult {
  const now = opts.now ?? Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1 };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count };
}

/**
 * Client IP best-effort.
 * Prefer platform-set headers over client-spoofable leftmost X-Forwarded-For.
 */
export function clientKey(request: Request, prefix: string): string {
  const vercel =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  if (vercel) return `${prefix}:${vercel}`;

  // When behind a single trusted proxy, the rightmost hop is often the edge IP.
  // Prefer last public-looking hop over first (which clients can spoof).
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const parts = xf.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return `${prefix}:${last}`;
  }

  return `${prefix}:unknown`;
}

/** Test helper — clear buckets. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
