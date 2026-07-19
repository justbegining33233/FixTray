/**
 * Security Headers Middleware
 * 
 * Implements OWASP recommended security headers to prevent common attacks
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function addSecurityHeaders(response: NextResponse | Response): NextResponse | Response {
  const headers = new Headers(response.headers);

  // HSTS (HTTP Strict-Transport-Security)
  // Force HTTPS for 1 year and include subdomains
  headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // CSP (Content-Security-Policy)
  // Prevent XSS by restricting script sources
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires this
    "style-src 'self' 'unsafe-inline'", // Tailwind requires inline styles
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  headers.set('Content-Security-Policy', cspDirectives);

  // X-Content-Type-Options
  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  // Enable XSS filter in older browsers
  headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  // Control how much referrer info is shared
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy)
  // Control which browser APIs can be used
  const permissionsPolicies = [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ].join(', ');
  headers.set('Permissions-Policy', permissionsPolicies);

  // Remove server identification headers
  headers.delete('Server');
  headers.delete('X-Powered-By');

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Apply security headers to all responses
 * Use in middleware.ts: return addSecurityHeaders(response);
 */
export function securityHeadersMiddleware(request: NextRequest) {
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}
