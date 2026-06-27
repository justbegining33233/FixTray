import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
  typedRoutes: true,
  // Disable pages router since we're using app router
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Compression configuration
  compress: true,
  poweredByHeader: false,
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Permissions-Policy',        value: 'camera=(self), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy',   value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com; font-src 'self' data:; connect-src 'self' https://res.cloudinary.com wss: ws:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
          // Performance headers
          { key: 'X-DNS-Prefetch-Control',    value: 'on' },
          { key: 'X-Download-Options',        value: 'noopen' },
          // Enterprise headers
          { key: 'X-Enterprise-Version',      value: '10.0.0' },
          { key: 'X-Compliance-Level',        value: 'enterprise' },
          { key: 'X-Feature-Flags',           value: 'enabled' },
        ],
      },
      {
        source: '/public/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: isProd
              ? 'public, max-age=86400'
              : 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      // API versioning headers
      {
        source: '/api/(.*)',
        headers: [
          { key: 'X-API-Version',             value: 'v1' },
          { key: 'X-API-Supported-Versions',  value: 'v1' },
          { key: 'X-Rate-Limit',              value: '1000' },
          { key: 'X-Rate-Limit-Window',       value: '3600' },
          { key: 'Cache-Control',             value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  // Prevent Next.js from bundling optional server-side packages that are
  // dynamically imported at runtime only (e.g. email/SMS providers).
  // winston uses dynamic requires and optional native bindings that cause
  // webpack bundling failures in Vercel serverless functions.
  serverExternalPackages: ['resend', 'twilio', 'winston'],
  async redirects() {
    return [
      // Legacy flat-path routes — redirect to correct nested paths
      { source: '/payment-success',           destination: '/payment/success',       permanent: false },
      { source: '/payment-cancel',            destination: '/payment/cancel',        permanent: false },
      { source: '/register-customer',         destination: '/register/customer',     permanent: false },
      { source: '/register-success',          destination: '/register/success',      permanent: false },
      { source: '/register-canceled',         destination: '/register/canceled',     permanent: false },
      { source: '/auth/register-shop',        destination: '/auth/login',            permanent: false },
      { source: '/auth/register-shop-client', destination: '/auth/login',            permanent: false },
      // Manager flat-path aliases
      { source: '/manager/admin-logs',        destination: '/manager/admin/logs',    permanent: false },
      { source: '/manager/admin-settings',    destination: '/manager/admin/settings', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Bundle analysis and optimization
  webpack: (config, { dev, isServer }) => {
    const isCiBuild = Boolean(process.env.CI || process.env.VERCEL);

    // Avoid large filesystem cache writes in constrained CI/Vercel environments.
    if (isCiBuild) {
      config.cache = false;
    }

    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks.chunks = 'all';
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        recharts: {
          test: /[\\/]node_modules[\\/]recharts[\\/]/,
          name: 'recharts',
          chunks: 'all',
          priority: 20,
        },
        sentry: {
          test: /[\\/]node_modules[\\/]@sentry[\\/]/,
          name: 'sentry',
          chunks: 'all',
          priority: 15,
        },
      };
    }

    // Development optimizations
    if (dev && !isCiBuild) {
      config.cache = { type: 'memory' };
    }

    return config;
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "fixtray",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
