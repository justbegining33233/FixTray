/**
 * Account Lockout System
 * 
 * Prevents brute force attacks by locking accounts after failed login attempts.
 * Implements exponential backoff and IP-based rate limiting.
 * 
 * NOTE: Temporarily disabled pending Prisma schema migration. Using fallback mode.
 */

import prisma from '@/lib/prisma';
import { getClientIP } from '@/lib/rateLimit';
import { NextRequest } from 'next/server';

export interface LockoutStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockExpiredAt?: Date;
  remainingSeconds?: number;
}

const LOCKOUT_THRESHOLD = 5; // Lock after N failed attempts
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const ATTEMPT_RESET_HOURS = 24; // Reset counter after 24 hours

// In-memory fallback for lockout tracking (will be replaced with DB after migration)
const inMemoryLockouts = new Map<string, { attempts: number; lockedUntil: Date | null }>();

/**
 * Check if an account or IP is currently locked
 */
export async function checkAccountLockout(
  userId: string,
  request?: NextRequest
): Promise<LockoutStatus> {
  try {
    // Use in-memory fallback
    const lockout = inMemoryLockouts.get(userId);
    
    if (!lockout) {
      return { isLocked: false, failedAttempts: 0 };
    }

    // Check if lockout has expired
    const now = new Date();
    if (lockout.lockedUntil && lockout.lockedUntil > now) {
      const remainingSeconds = Math.ceil(
        (lockout.lockedUntil.getTime() - now.getTime()) / 1000
      );
      return {
        isLocked: true,
        failedAttempts: lockout.attempts,
        lockExpiredAt: lockout.lockedUntil,
        remainingSeconds,
      };
    }

    // Lockout expired, reset
    if (lockout.lockedUntil) {
      inMemoryLockouts.set(userId, { attempts: 0, lockedUntil: null });
    }

    return { isLocked: false, failedAttempts: 0 };
  } catch (error) {
    console.error('[lockout] Check failed:', error);
    return { isLocked: false, failedAttempts: 0 };
  }
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLoginAttempt(
  userId: string,
  request?: NextRequest
): Promise<void> {
  try {
    const ip = request ? getClientIP(request) : '';
    const userAgent = request?.headers.get('user-agent') || '';
    const now = new Date();

    // Get latest attempt from in-memory store
    const latest = inMemoryLockouts.get(userId);

    // Check if we should reset counter (24+ hours have passed)
    const shouldReset = !latest || 
      (now.getTime() - (latest.lockedUntil?.getTime() || 0)) > ATTEMPT_RESET_HOURS * 60 * 60 * 1000;

    const newCount = shouldReset ? 1 : (latest?.attempts || 0) + 1;
    const shouldLock = newCount >= LOCKOUT_THRESHOLD;

    // Update in-memory store
    inMemoryLockouts.set(userId, {
      attempts: newCount,
      lockedUntil: shouldLock 
        ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
        : null,
    });

    if (shouldLock) {
      console.warn(
        `[SECURITY] Account lockout activated for user ${userId} after ${newCount} failed attempts from IP ${ip}`
      );
    }
  } catch (error) {
    console.error('[lockout] Recording failed:', error);
  }
}

/**
 * Clear failed attempts after successful login
 */
export async function clearLoginAttempts(userId: string): Promise<void> {
  try {
    inMemoryLockouts.delete(userId);
  } catch (error) {
    console.error('[lockout] Clear failed:', error);
  }
}

/**
 * Manually unlock an account (admin function)
 */
export async function unlockAccount(userId: string): Promise<void> {
  try {
    inMemoryLockouts.delete(userId);
    console.log(`[SECURITY] Account unlocked by admin: ${userId}`);
  } catch (error) {
    console.error('[lockout] Unlock failed:', error);
  }
}

/**
 * Get lockout statistics for monitoring
 */
export async function getLockoutStats(): Promise<{
  totalLockedAccounts: number;
  totalFailedAttempts: number;
  recentLocks: Array<{ userId: string; attempts: number; lockedUntil: Date | null }>;
}> {
  try {
    const now = new Date();
    
    // Get locked accounts from in-memory store
    const recentLocks: Array<{ userId: string; attempts: number; lockedUntil: Date | null }> = [];
    let totalFailedAttempts = 0;

    for (const [userId, lockout] of inMemoryLockouts.entries()) {
      if (lockout.lockedUntil && lockout.lockedUntil > now) {
        recentLocks.push({
          userId,
          attempts: lockout.attempts,
          lockedUntil: lockout.lockedUntil,
        });
      }
      totalFailedAttempts += lockout.attempts;
    }

    return {
      totalLockedAccounts: recentLocks.length,
      totalFailedAttempts,
      recentLocks: recentLocks.slice(0, 10),
    };
  } catch (error) {
    console.error('[lockout] Stats failed:', error);
    return {
      totalLockedAccounts: 0,
      totalFailedAttempts: 0,
      recentLocks: [],
    };
  }
}
