interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory sliding window rate limiter
const ipStore = new Map<string, RateLimitRecord>();

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of ipStore.entries()) {
      if (now > record.resetTime) {
        ipStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function checkRateLimit(
  key: string,
  options: { maxRequests: number; windowSeconds: number } = { maxRequests: 30, windowSeconds: 60 }
): { success: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const existing = ipStore.get(key);

  if (!existing || now > existing.resetTime) {
    ipStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: options.maxRequests - 1,
      resetInSeconds: options.windowSeconds,
    };
  }

  if (existing.count >= options.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetInSeconds: Math.ceil((existing.resetTime - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: options.maxRequests - existing.count,
    resetInSeconds: Math.ceil((existing.resetTime - now) / 1000),
  };
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || '127.0.0.1';
}
