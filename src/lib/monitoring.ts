/**
 * Application monitoring helpers — built on @opentelemetry/api and Sentry.
 *
 * @vercel/otel (registered in instrumentation.ts) initialises the SDK so
 * spans created here are automatically exported to any configured OTLP
 * collector (e.g. Vercel Observability, Honeycomb, Grafana Tempo).
 * Sentry also reads these spans via its OpenTelemetry integration.
 *
 * Usage:
 *   import { withSpan, recordMetric, setUser } from '@/lib/monitoring';
 *
 *   // Wrap async work in a named span
 *   const result = await withSpan('payment.charge', async (span) => {
 *     span.setAttribute('payment.amount', 9900);
 *     return await stripe.paymentIntents.create(...);
 *   });
 *
 *   // Record a counter metric
 *   recordMetric('work_order.created', 1, { shop_id: shopId });
 *
 *   // Tag a Sentry scope with the current user
 *   setUser({ id: userId, role: 'shop' });
 */

import { trace, context, SpanStatusCode, metrics } from '@opentelemetry/api';
import type { Span, Attributes } from '@opentelemetry/api';
import * as Sentry from '@sentry/nextjs';

const TRACER_NAME = 'fixtray-app';
const METER_NAME  = 'fixtray-app';

const tracer = trace.getTracer(TRACER_NAME);
const meter  = metrics.getMeter(METER_NAME);

// ─── Tracing ─────────────────────────────────────────────────────────────────

/**
 * Run `fn` inside a named span. The span is automatically ended when the
 * promise settles. Any thrown error is recorded and re-thrown.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) {
      span.setAttributes(attributes);
    }
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Add a key/value attribute to the currently active span (no-op if none).
 */
export function addSpanAttribute(key: string, value: string | number | boolean): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

/**
 * Record an exception on the active span AND forward it to Sentry.
 */
export function recordError(err: unknown, context?: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (span && err instanceof Error) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  }

  if (err instanceof Error) {
    Sentry.captureException(err, { extra: context });
  } else {
    Sentry.captureMessage(String(err), { level: 'error', extra: context });
  }
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

// Counter cache — avoid creating a new instrument per call
const counters = new Map<string, ReturnType<typeof meter.createCounter>>();
const histograms = new Map<string, ReturnType<typeof meter.createHistogram>>();

/**
 * Increment a counter metric.
 * Examples: 'work_order.created', 'login.failed', 'payment.charged'
 */
export function recordMetric(
  name: string,
  value = 1,
  attributes?: Attributes,
): void {
  if (!counters.has(name)) {
    counters.set(name, meter.createCounter(name));
  }
  counters.get(name)!.add(value, attributes);
}

/**
 * Record a duration (milliseconds) as a histogram.
 * Examples: 'db.query.duration_ms', 'api.response.duration_ms'
 */
export function recordDuration(
  name: string,
  durationMs: number,
  attributes?: Attributes,
): void {
  if (!histograms.has(name)) {
    histograms.set(name, meter.createHistogram(name, { unit: 'ms' }));
  }
  histograms.get(name)!.record(durationMs, attributes);
}

// ─── User context ─────────────────────────────────────────────────────────────

/**
 * Associate the current request/session with a user in Sentry.
 * Call this after a successful login.
 */
export function setUser(user: { id: string; email?: string; role?: string }): void {
  Sentry.setUser(user);
}

/** Clear user context (call on logout). */
export function clearUser(): void {
  Sentry.setUser(null);
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

/**
 * Wrap a Prisma query (or any DB call) in a span with standard DB attributes.
 */
export async function withDbSpan<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    return await withSpan(`db.${operation}`, () => fn(), {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.sql.table': table,
    });
  } finally {
    recordDuration('db.query.duration_ms', Date.now() - start, {
      operation,
      table,
    });
  }
}

/**
 * Measure an arbitrary async operation and record its duration.
 * Returns the result and logs a warning via Sentry if it exceeds `slowMs`.
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  { slowMs = 2000, attributes }: { slowMs?: number; attributes?: Attributes } = {},
): Promise<T> {
  const start = Date.now();
  const result = await withSpan(name, () => fn(), attributes);
  const durationMs = Date.now() - start;

  recordDuration(`${name}.duration_ms`, durationMs, attributes);

  if (durationMs > slowMs) {
    Sentry.captureMessage(`Slow operation: ${name} took ${durationMs}ms`, {
      level: 'warning',
      extra: { durationMs, slowMs, ...attributes },
    });
  }

  return result;
}

// Re-export the raw OTel context utilities for advanced use
export { trace, context };
