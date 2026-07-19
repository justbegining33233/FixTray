/**
 * Next.js Middleware
 * 
 * Runs before every request to apply security headers and request validation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next();
  
  // Add security headers
  const headers = new Headers(response.headers);

  // HSTS (HTTP Strict-Transport-Security)
  headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // CSP (Content-Security-Policy)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires this
    "style-src 'self' 'unsafe-inline'", // Tailwind requires inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  headers.set('Content-Security-Policy', cspDirectives);

  // X-Content-Type-Options (prevent MIME sniffing)
  headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options (prevent clickjacking)
  headers.set('X-Frame-Options', 'DENY');

  // X-XSS-Protection (enable XSS filter)
  headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy)
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

  // Remove server identification
  headers.delete('Server');
  headers.delete('X-Powered-By');

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    // Apply to all routes except static files and API routes with specific patterns
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
