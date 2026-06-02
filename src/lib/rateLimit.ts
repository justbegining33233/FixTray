/**
 * Rate Limiting Utility
 * Version: 0.0.3
 *
 * Redis-backed rate limiter (Upstash) with in-memory fallback.
 * - Production: uses @upstash/redis via REST API (serverless-safe)
 * - Local dev without Redis configured: falls back to in-memory Map
 */

import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Redis client — only created when env vars are present
// ---------------------------------------------------------------------------
let redis: Redis | null = null;
if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev only)
// ---------------------------------------------------------------------------
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const memoryStore = new Map<string, RateLimitEntry>();
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (now > entry.resetTime) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// checkRateLimit — Redis-backed with in-memory fallback
// ---------------------------------------------------------------------------
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 15, windowMs: 15 * 60 * 1000 },
): Promise<RateLimitResult> {
  const windowSecs = Math.ceil(options.windowMs / 1000);
  const resetTime = Date.now() + options.windowMs;

  // --- Redis path ---
  if (redis) {
    try {
      const key = `rl:${identifier}`;
      const count = await redis.incr(key);
      if (count === 1) {
        // First request in window — set expiry
        await redis.expire(key, windowSecs);
      }
      const ttl = await redis.ttl(key);
      const windowResetTime = Date.now() + ttl * 1000;

      if (count > options.maxRequests) {
        const remainingSeconds = Math.max(0, ttl);
        return {
          success: false,
          remaining: 0,
          resetTime: windowResetTime,
          message: `Too many requests. Please try again in ${remainingSeconds} seconds.`,
        };
      }

      return {
        success: true,
        remaining: options.maxRequests - count,
        resetTime: windowResetTime,
      };
    } catch (err) {
      // Redis error — fall through to in-memory
      console.error('[rateLimit] Redis error, using in-memory fallback:', err);
    }
  }

  // --- In-memory fallback ---
  const now = Date.now();
  const existing = memoryStore.get(identifier);

  if (!existing || now > existing.resetTime) {
    memoryStore.set(identifier, { count: 1, resetTime });
    return { success: true, remaining: options.maxRequests - 1, resetTime };
  }

  if (existing.count >= options.maxRequests) {
    const remainingSeconds = Math.ceil((existing.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetTime: existing.resetTime,
      message: `Too many login attempts. Please try again in ${remainingSeconds} seconds.`,
    };
  }

  existing.count++;
  memoryStore.set(identifier, existing);
  return {
    success: true,
    remaining: options.maxRequests - existing.count,
    resetTime: existing.resetTime,
  };
}

// ---------------------------------------------------------------------------
// getClientIP
// ---------------------------------------------------------------------------
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  return 'unknown';
}

// ---------------------------------------------------------------------------
// resetRateLimit
// ---------------------------------------------------------------------------
export async function resetRateLimit(identifier: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(`rl:${identifier}`);
      return;
    } catch (err) {
      console.error('[rateLimit] Redis error on reset:', err);
    }
  }
  memoryStore.delete(identifier);
}

// ---------------------------------------------------------------------------
// getRateLimitStatus (non-incrementing read)
// ---------------------------------------------------------------------------
export async function getRateLimitStatus(
  identifier: string,
): Promise<RateLimitResult | null> {
  if (redis) {
    try {
      const key = `rl:${identifier}`;
      const count = await redis.get<number>(key);
      if (count === null) return null;
      const ttl = await redis.ttl(key);
      const resetTime = Date.now() + ttl * 1000;
      return {
        success: count < 5,
        remaining: Math.max(0, 5 - count),
        resetTime,
      };
    } catch (err) {
      console.error('[rateLimit] Redis error on status:', err);
    }
  }

  const entry = memoryStore.get(identifier);
  if (!entry) return null;
  const now = Date.now();
  if (now > entry.resetTime) {
    memoryStore.delete(identifier);
    return null;
  }
  return {
    success: entry.count < 5,
    remaining: Math.max(0, 5 - entry.count),
    resetTime: entry.resetTime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware-style rate limiter (used as Next.js route middleware)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export const rateLimitConfigs = {
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 15,
    message: 'Too many authentication attempts, please try again later',
  },
  api: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests, please try again later',
  },
  strict: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Rate limit exceeded, please slow down',
  },
} satisfies Record<string, RateLimitConfig>;

/**
 * Returns a middleware function. Call it inside your route handler:
 *   const limiter = rateLimit(rateLimitConfigs.auth);
 *   const limited = await limiter(request);
 *   if (limited) return limited;
 */
export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown';
    const pathname = new URL(request.url).pathname;
    const identifier = `rl-mw:${ip}:${pathname}`;
    const result = await checkRateLimit(identifier, {
      maxRequests: config.maxRequests,
      windowMs:    config.windowMs,
    });
    if (!result.success) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        { error: config.message ?? 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After':          String(retryAfter),
            'X-RateLimit-Limit':    String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':    String(result.resetTime),
          },
        },
      );
    }
    return null;
  };
}

export function addRateLimitHeaders(
  response: NextResponse,
  config: RateLimitConfig,
  currentCount: number,
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(config.maxRequests));
  response.headers.set('X-RateLimit-Remaining', String(config.maxRequests - currentCount));
  return response;
}
