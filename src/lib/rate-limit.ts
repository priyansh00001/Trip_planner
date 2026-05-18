/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Uses a sliding-window counter keyed by IP address.
 *
 * NOTE: This is process-local — if you run multiple Next.js instances
 * behind a load balancer, use Redis (e.g. Upstash) instead.
 *
 * Usage:
 *   const { ok, retryAfter } = rateLimit(request, { limit: 10, windowMs: 60_000 })
 *   if (!ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
 */

interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  ok: boolean
  /** Seconds until the oldest request in the window expires (only set when ok=false) */
  retryAfter?: number
}

// Map<ip, timestamps[]>
const store = new Map<string, number[]>()

function getClientIp(request: Request): string {
  // Vercel/Cloudflare forward real IP via headers
  const forwarded = (request.headers as any).get?.("x-forwarded-for") ??
                    (request.headers as any).get?.("x-real-ip")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  // Fallback — will be "::1" in local dev, that's fine
  return "unknown"
}

export function rateLimit(
  request: Request,
  options: RateLimitOptions
): RateLimitResult {
  const { limit, windowMs } = options
  const now = Date.now()
  const ip = getClientIp(request)

  // Get existing timestamps, prune expired ones
  const timestamps = (store.get(ip) ?? []).filter((t) => now - t < windowMs)

  if (timestamps.length >= limit) {
    const oldest = timestamps[0]
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000)
    store.set(ip, timestamps)
    return { ok: false, retryAfter }
  }

  timestamps.push(now)
  store.set(ip, timestamps)
  return { ok: true }
}
