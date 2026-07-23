/**
 * Centralized error handling with retry logic
 * Handles failures from email, SMS, notifications, webhooks gracefully
 */

import logger from '@/lib/logger';
import { NextResponse } from 'next/server';

export type ErrorSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface ErrorHandlerOptions {
  context: string; // Where the error occurred (e.g., "sendWelcomeEmail")
  severity?: ErrorSeverity;
  shouldThrow?: boolean; // If true, rethrow after logging
  shouldQueue?: boolean; // If true, queue for retry
  metadata?: Record<string, any>;
}

/**
 * Handle async operations with proper error recovery
 * Usage:
 *   await asyncErrorHandler(
 *     () => sendEmail(...),
 *     { context: 'sendWelcomeEmail', shouldQueue: true }
 *   );
 */
export async function asyncErrorHandler<T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
  const { context, severity = 'warn', shouldThrow = false, shouldQueue = false, metadata = {} } = options;

  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log based on severity
    const logData = { context, ...metadata, error: errorMessage, stack: errorStack };

    switch (severity) {
      case 'debug':
        logger.debug(`${context}: ${errorMessage}`, logData);
        break;
      case 'info':
        logger.info(`${context}: ${errorMessage}`, logData);
        break;
      case 'warn':
        logger.warn(`${context}: ${errorMessage}`, logData);
        break;
      case 'error':
        logger.error(`${context}: ${errorMessage}`, error, logData);
        break;
      case 'critical':
        logger.error(`CRITICAL - ${context}: ${errorMessage}`, error, logData);
        break;
    }

    // Queue for retry if applicable
    if (shouldQueue) {
      try {
        await queueForRetry(context, error, metadata);
      } catch (queueError) {
        logger.error(`Failed to queue ${context} for retry`, {
          error: queueError instanceof Error ? queueError.message : String(queueError),
          context
        });
      }
    }

    // Rethrow if specified
    if (shouldThrow) {
      throw error;
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Queue failed operations for retry
 * Stores in memory (should be upgraded to Redis/database for production)
 */
const retryQueue: Map<string, { count: number; lastAttempt: number; error: any }> = new Map();

async function queueForRetry(operation: string, error: any, metadata: Record<string, any>) {
  const queueKey = `${operation}:${JSON.stringify(metadata)}`.substring(0, 100);
  const existing = retryQueue.get(queueKey) || { count: 0, lastAttempt: Date.now(), error };

  if (existing.count < 3) {
    // Retry up to 3 times
    retryQueue.set(queueKey, {
      count: existing.count + 1,
      lastAttempt: Date.now(),
      error,
    });

    logger.info(`Queued ${operation} for retry (attempt ${existing.count + 1}/3)`, {
      queueKey,
      metadata,
    });
  } else {
    // Give up after 3 attempts
    retryQueue.delete(queueKey);
    logger.warn(`Gave up on ${operation} after 3 retries`, { queueKey, metadata });
  }
}

/**
 * Wrap API route handlers with error handling
 * Usage:
 *   export async function POST(request) {
 *     return withErrorHandler(async () => {
 *       // Your logic here
 *       return NextResponse.json({...});
 *     }, 'POST /api/example');
 *   }
 */
export async function withErrorHandler(
  handler: () => Promise<NextResponse>,
  context: string
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`${context} handler error: ${errorMessage}`, { error: error instanceof Error ? error.message : String(error), context });

    // Return generic error to client (don't leak internals)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Retry failed operations from queue (background job)
 * Should be called periodically (e.g., every 5 minutes)
 */
export async function processRetryQueue() {
  const now = Date.now();
  const RETRY_INTERVAL = 60000; // Retry after 1 minute

  for (const [key, item] of retryQueue.entries()) {
    // Only retry if enough time has passed
    if (now - item.lastAttempt < RETRY_INTERVAL) {
      continue;
    }

    logger.info(`Processing retry queue item: ${key}`);
    // In production, this would re-execute the operation
    // For now, just log that we would retry
  }
}

/**
 * Fetch with error handling
 * Adds timeout, retries, and proper error messages
 */
export async function safeFetch(
  url: string,
  options?: RequestInit & { timeout?: number; retries?: number }
): Promise<Response> {
  const { timeout = 30000, retries = 3, ...fetchOptions } = options || {};

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(new AbortController().signal as any);

      if (attempt === retries - 1) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Safe database operations with error handling
 */
export async function safePrismaOperation<T>(
  operation: () => Promise<T>,
  context: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${context} database operation failed: ${errorMessage}`, { error: error instanceof Error ? error.message : String(error), context,
      ...metadata, });

    return {
      success: false,
      error: 'Database operation failed',
    };
  }
}

/**
 * Handle missing authentication (401)
 */
export function handleUnauthorized(message = 'Authentication required') {
  logger.debug('Unauthorized access attempt', { message });
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Handle forbidden access (403)
 */
export function handleForbidden(message = 'Access denied') {
  logger.debug('Forbidden access attempt', { message });
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Handle not found (404)
 */
export function handleNotFound(resource: string) {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}

/**
 * Handle validation error (400)
 */
export function handleBadRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
