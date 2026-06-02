import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";

export function register() {
  // OpenTelemetry — initialise first so spans are available before Sentry loads
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'fixtray-app',
  });

  // Sentry — error tracking + performance monitoring (wraps OTel traces)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
