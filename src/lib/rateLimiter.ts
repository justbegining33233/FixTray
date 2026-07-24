/**
 * Rate limiting for authentication endpoints
 * Prevents brute force attacks on login, 2FA, registration
 */

import rateLimit from 'express-rate-limit';

// Note: Upstash rate limiting is not used in current implementation
// All rate limiters use express-rate-limit for in-memory or Redis caching

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
 * Stub rate limit checker - uses express-rate-limit middleware above
 * This function is provided for API compatibility but is not actively used
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  // Rate limiting is handled by express-rate-limit middleware
  return { allowed: true, remaining: limit, reset: 0 };
}

/**
 * Stub rate limit enforcer - uses express-rate-limit middleware above
 * This function is provided for API compatibility but is not actively used
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<{ success: boolean; error?: string; headers?: Record<string, string> }> {
  // Rate limiting is handled by express-rate-limit middleware
  return { success: true };
}
