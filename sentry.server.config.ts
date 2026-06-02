// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development',

  // Sample 100% of traces in dev, 20% in production to control volume.
  // Increase in production once baseline is established.
  tracesSampleRate: isProd ? 0.2 : 1.0,

  // Only send errors from the app's own code, not from third-party scripts.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error exception captured',
    /^Network request failed/,
  ],

  debug: false,
});
