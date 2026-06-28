// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development',

  // Sample 100% of traces in dev, 10% in production (client traces are high volume).
  tracesSampleRate: isProd ? 0.1 : 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
  ],

  debug: false,
});

// NOTE: onRouterTransitionStart (Sentry.captureRouterTransitionStart) is NOT
// exported here because the installed Sentry version does not provide that
// function.  Exporting undefined causes Next.js 15 to treat it as a lazy React
// element that resolves to undefined, throwing "Element type is invalid" on
// every router navigation and preventing page transitions (e.g. shop/home).
// Re-add this export once Sentry is upgraded to a version that includes it.