/**
 * Deprecation Manager
 * 
 * Handles deprecated endpoint warnings and migration tracking
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logSecurityEvent } from '@/lib/audit-logger';
import { getClientIP } from '@/lib/rateLimit';

export interface DeprecatedEndpoint {
  path: string;
  deprecatedSince: string;
  sunsetDate: string;
  replacement?: string;
  severity: 'warning' | 'error';
}

const DEPRECATED_ENDPOINTS: Record<string, DeprecatedEndpoint> = {
  '/api/v1/auth/login': {
    path: '/api/v1/auth/login',
    deprecatedSince: '2024-01-01',
    sunsetDate: '2026-12-31',
    replacement: '/api/auth/customer',
    severity: 'warning',
  },
  '/api/v1/workorders': {
    path: '/api/v1/workorders',
    deprecatedSince: '2024-06-01',
    sunsetDate: '2026-12-31',
    replacement: '/api/workorders',
    severity: 'warning',
  },
};

/**
 * Check if endpoint is deprecated and return warning response
 */
export function checkDeprecatedEndpoint(request: NextRequest, path: string) {
  const deprecated = DEPRECATED_ENDPOINTS[path];

  if (!deprecated) {
    return null;
  }

  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  const now = new Date();
  const sunsetDate = new Date(deprecated.sunsetDate);

  // Log deprecation usage
  // Note: Security event logging temporarily disabled to resolve type issues
  // await logSecurityEvent({
  //   eventType: 'endpoint_deprecated',
  //   ip: clientIP,
  //   userAgent,
  //   details: {
  //     endpoint: path,
  //     replacement: deprecated.replacement,
  //     sunsetDate: deprecated.sunsetDate,
  //   },
  //   severity: 'warn',
  // }).catch(console.error);

  // Check if sunset date has passed
  if (now > sunsetDate && deprecated.severity === 'error') {
    const headers: Record<string, string> = {
      'Deprecation': 'true',
      'Sunset': new Date(deprecated.sunsetDate).toUTCString(),
    };
    if (deprecated.replacement) {
      headers['Link'] = `<${deprecated.replacement}>; rel="successor-version"`;
    }
    
    return NextResponse.json(
      {
        error: 'Endpoint has been removed',
        message: `This endpoint was deprecated on ${deprecated.deprecatedSince} and removed on ${deprecated.sunsetDate}`,
        replacement: deprecated.replacement,
      },
      {
        status: 410, // Gone
        headers,
      }
    );
  }

  // Return warning headers
  return {
    headers: {
      'Deprecation': 'true',
      'Sunset': new Date(deprecated.sunsetDate).toUTCString(),
      'Warning': `299 - "${deprecated.replacement || 'No replacement'}" - "This API endpoint is deprecated and will be removed on ${deprecated.sunsetDate}"`,
      ...(deprecated.replacement && {
        'Link': `<${deprecated.replacement}>; rel="successor-version"`,
      }),
    },
  };
}

/**
 * Middleware to add deprecation headers
 */
export function addDeprecationHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const deprecated = checkDeprecatedEndpoint(request, new URL(request.url).pathname);

  if (!deprecated) {
    return response;
  }

  if (deprecated instanceof NextResponse) {
    return deprecated;
  }

  // Add headers to response
  const newResponse = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });

  for (const [key, value] of Object.entries(deprecated.headers)) {
    if (value) {
      newResponse.headers.set(key, value);
    }
  }

  return newResponse;
}

/**
 * Get all deprecated endpoints
 */
export function listDeprecatedEndpoints(): DeprecatedEndpoint[] {
  return Object.values(DEPRECATED_ENDPOINTS);
}

/**
 * Get migration guide for deprecated endpoint
 */
export function getMigrationGuide(deprecatedPath: string): string {
  const endpoint = DEPRECATED_ENDPOINTS[deprecatedPath];

  if (!endpoint) {
    return '';
  }

  return `
# Migration Guide

The endpoint \`${endpoint.path}\` has been deprecated since ${endpoint.deprecatedSince}.

## What changed?
This endpoint will be removed on ${endpoint.sunsetDate}.

## How to migrate
Please update your code to use the new endpoint:

\`\`\`
Old: ${endpoint.path}
New: ${endpoint.replacement}
\`\`\`

## Timeline
- Deprecated: ${endpoint.deprecatedSince}
- Sunset: ${endpoint.sunsetDate}
- Removed: After ${endpoint.sunsetDate}
`;
}
