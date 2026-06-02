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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;