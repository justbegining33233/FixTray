/**
 * Rate Limiter with Security Hardening
 * 
 * Enhanced rate limiting for all endpoints with suspicious activity detection
 */

import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    ips: Set<string>;
  };
}

const rateLimitStore: RateLimitStore = {};

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - strict
  '/api/auth/customer': { windowMs: 900000, maxRequests: 5 }, // 5 per 15min
  '/api/auth/tech': { windowMs: 900000, maxRequests: 5 },
  '/api/auth/shop': { windowMs: 900000, maxRequests: 5 },
  '/api/auth/admin': { windowMs: 900000, maxRequests: 5 },

  // Password reset - moderate
  '/api/auth/reset/request': { windowMs: 3600000, maxRequests: 3 }, // 3 per hour
  '/api/auth/reset/confirm': { windowMs: 3600000, maxRequests: 10 }, // 10 per hour

  // API endpoints - normal
  '/api/workorders': { windowMs: 60000, maxRequests: 100 }, // 100 per minute
  '/api/inventory': { windowMs: 60000, maxRequests: 100 },
};

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

/**
 * Check rate limit for endpoint
 */
export function checkRateLimit(endpoint: string, ip: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const config = RATE_LIMIT_CONFIGS[endpoint] || {
    windowMs: 60000,
    maxRequests: 1000,
  };

  const key = `${endpoint}:${ip}`;
  const now = Date.now();

  // Initialize or reset if window expired
  if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
    rateLimitStore[key] = {
      count: 0,
      resetTime: now + config.windowMs,
      ips: new Set(),
    };
  }

  const record = rateLimitStore[key];
  record.ips.add(ip);
  record.count++;

  const allowed = record.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - record.count);
  const retryAfter = allowed ? undefined : Math.ceil((record.resetTime - now) / 1000);

  return {
    allowed,
    remaining,
    resetTime: record.resetTime,
    retryAfter,
  };
}

/**
 * Reset rate limit for an endpoint/IP combination
 */
export function resetRateLimit(key: string): void {
  delete rateLimitStore[key];
}

/**
 * Detect suspicious activity (brute force, distributed attacks)
 */
export function detectSuspiciousActivity(endpoint: string): {
  suspicious: boolean;
  reason?: string;
  ips?: string[];
} {
  // Count unique IPs hitting the same endpoint in rapid succession
  const endpointKey = `${endpoint}:`;
  const records = Object.entries(rateLimitStore)
    .filter(([key]) => key.startsWith(endpointKey))
    .map(([, record]) => record);

  if (records.length === 0) {
    return { suspicious: false };
  }

  // Check for distributed attack pattern (many IPs, many requests)
  const uniqueIPs = new Set<string>();
  let totalRequests = 0;

  for (const record of records) {
    record.ips.forEach((ip) => uniqueIPs.add(ip));
    totalRequests += record.count;
  }

  // Suspicious if: >10 unique IPs + >50 requests in short window
  if (uniqueIPs.size > 10 && totalRequests > 50) {
    return {
      suspicious: true,
      reason: 'Potential distributed attack',
      ips: Array.from(uniqueIPs),
    };
  }

  // Suspicious if single IP has excessive requests
  for (const record of records) {
    if (record.count > 100) {
      return {
        suspicious: true,
        reason: 'Excessive requests from single IP',
        ips: Array.from(record.ips),
      };
    }
  }

  return { suspicious: false };
}

/**
 * Get rate limit stats
 */
export function getRateLimitStats(): Record<string, any> {
  const stats: Record<string, any> = {};

  for (const [key, record] of Object.entries(rateLimitStore)) {
    const [endpoint, ip] = key.split(':');
    if (!stats[endpoint]) {
      stats[endpoint] = {
        totalRequests: 0,
        uniqueIPs: new Set(),
        ipCounts: {},
      };
    }

    stats[endpoint].totalRequests += record.count;
    stats[endpoint].ipCounts[ip] = record.count;
    record.ips.forEach((ip) => stats[endpoint].uniqueIPs.add(ip));
  }

  // Convert Sets to arrays for serialization
  for (const endpoint in stats) {
    stats[endpoint].uniqueIPs = Array.from(stats[endpoint].uniqueIPs);
    stats[endpoint].uniqueIPCount = stats[endpoint].uniqueIPs.length;
  }

  return stats;
}

/**
 * Clean up expired rate limit records (run periodically)
 */
export function cleanupRateLimitStore(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
      cleaned++;
    }
  }

  return cleaned;
}

// Run cleanup every 5 minutes
setInterval(() => {
  const cleaned = cleanupRateLimitStore();
  if (cleaned > 0) {
    console.log(`[RATE LIMIT] Cleaned up ${cleaned} expired records`);
  }
}, 5 * 60 * 1000);
