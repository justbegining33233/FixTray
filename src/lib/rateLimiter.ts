/**
 * Rate limiting for authentication endpoints
 * Prevents brute force attacks on login, 2FA, registration
 */

import rateLimit from 'express-rate-limit';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create Upstash Redis client for distributed rate limiting
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:8079',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'default_token',
});

/**
 * Rate limiter for login attempts
 * 5 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req) => {
    // Don't rate limit in development
    return process.env.NODE_ENV === 'development';
  },
});

/**
 * Rate limiter for 2FA verification
 * 3 attempts per 15 minutes per user
 */
export const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per window
  message: 'Too many 2FA verification attempts, please try again later',
  keyGenerator: (req) => {
    // Use user ID if available, otherwise IP
    return req.body?.userId || req.ip || 'unknown';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

/**
 * Rate limiter for registration
 * 5 registrations per hour per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per window
  message: 'Too many registration attempts, please try again later',
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

/**
 * Rate limiter for password reset requests
 * 3 attempts per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per window
  message: 'Too many password reset requests, please try again later',
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

/**
 * Upstash-based rate limiter for API endpoints
 * Works with serverless platforms like Vercel
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  try {
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${window}s`),
      ephemeralCache: new Map(),
    });

    const { success, pending, reset } = await ratelimit.limit(key);

    return {
      allowed: success,
      remaining: Math.max(0, limit - (limit - (pending || 0))),
      reset: reset ? Math.floor(reset / 1000) : 0,
    };
  } catch (error) {
    // If Redis is unavailable, allow request but log
    console.warn('Rate limit check failed, allowing request:', error);
    return { allowed: true, remaining: limit, reset: 0 };
  }
}

/**
 * Check rate limit and return error response if exceeded
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<{ success: boolean; error?: string; headers?: Record<string, string> }> {
  const result = await checkRateLimit(key, limit, window);

  if (!result.allowed) {
    return {
      success: false,
      error: 'Too many requests, please try again later',
      headers: {
        'RateLimit-Limit': limit.toString(),
        'RateLimit-Remaining': result.remaining.toString(),
        'RateLimit-Reset': result.reset.toString(),
        'Retry-After': result.reset.toString(),
      },
    };
  }

  return {
    success: true,
    headers: {
      'RateLimit-Limit': limit.toString(),
      'RateLimit-Remaining': result.remaining.toString(),
      'RateLimit-Reset': result.reset.toString(),
    },
  };
}
