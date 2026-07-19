/**
 * Safe Error Handler
 * 
 * Prevents sensitive error details from being exposed to clients.
 * Logs full errors server-side, returns generic messages to clients.
 */

import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export interface ErrorContext {
  operation: string;
  userId?: string;
  email?: string;
  endpoint?: string;
  [key: string]: any;
}

/**
 * Handle API error securely
 * - Logs full error details server-side
 * - Returns generic message to client
 * - Never exposes implementation details
 */
export function handleApiError(
  error: unknown,
  context: ErrorContext,
  statusCode: number = 500
): NextResponse {
  // Log full error details server-side for debugging
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  logger.error(`${context.operation} failed`, {
    error: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date()
  });

  // Return generic message to client (never expose implementation details)
  let clientMessage: string;
  
  if (statusCode === 401) {
    clientMessage = 'Authentication failed. Please try again.';
  } else if (statusCode === 403) {
    clientMessage = 'Access denied.';
  } else if (statusCode === 404) {
    clientMessage = 'Not found.';
  } else if (statusCode === 429) {
    clientMessage = 'Too many requests. Please try again later.';
  } else {
    clientMessage = 'An error occurred. Please try again later.';
  }

  return NextResponse.json(
    { error: clientMessage },
    { status: statusCode }
  );
}

/**
 * Handle authentication error
 */
export function handleAuthError(error: unknown, context: ErrorContext): NextResponse {
  return handleApiError(error, context, 401);
}

/**
 * Handle authorization error
 */
export function handleAuthzError(error: unknown, context: ErrorContext): NextResponse {
  return handleApiError(error, context, 403);
}

/**
 * Handle not found error
 */
export function handleNotFoundError(error: unknown, context: ErrorContext): NextResponse {
  return handleApiError(error, context, 404);
}

/**
 * Sanitize string for logging (hash PII)
 */
export function sanitizeForLogging(value: string, length: number = 8): string {
  if (!value) return '(empty)';
  if (value.length <= length) return '(short)';
  
  const hash = require('crypto')
    .createHash('sha256')
    .update(value)
    .digest('hex');
  
  return hash.substring(0, length);
}
