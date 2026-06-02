/**
 * Enterprise-grade structured logger with Winston integration
 * Captures errors/warnings in Sentry and writes structured JSON to stdout/stderr
 * Includes Winston for advanced logging features and external service integration
 *
 * Usage:
 *   import logger from '@/lib/logger';
 *   logger.error('Payment failed', { workOrderId, amount });
 *   logger.audit('USER_LOGIN', 'user123', { ip: '192.168.1.1' });
 *   logger.performance('DATABASE_QUERY', 150, { query: 'SELECT * FROM workorders' });
 */
import * as Sentry from '@sentry/nextjs';
import winston from 'winston';
import path from 'path';

// On Vercel (and other serverless platforms) the filesystem is read-only
// except for /tmp. File transports at module init time would throw, causing
// every API route that imports logger to fail with a 500 on cold start.
// We therefore only add file transports when running on a writable filesystem.
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.RAILWAY_ENVIRONMENT);
const logDir = isServerless ? '/tmp/logs' : path.join(process.cwd(), 'logs');

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (!isServerless) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Winston logger configuration
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fixtray-app' },
  transports,
});

// Exception/rejection handlers only when we have a writable filesystem
if (!isServerless) {
  winstonLogger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
    })
  );

  winstonLogger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
    })
  );
}

type LogMeta = Record<string, unknown>;

function formatEntry(level: string, message: string, meta?: LogMeta) {
  return JSON.stringify({
    level,
    ts: new Date().toISOString(),
    msg: message,
    ...meta,
  });
}

const logger = {
  info(message: string, meta?: LogMeta) {
    winstonLogger.info(message, meta);

    if (process.env.NODE_ENV !== 'production') {
      console.log(formatEntry('info', message, meta));
    }
    // Info-level breadcrumbs help debug Sentry error reports
    Sentry.addBreadcrumb({ category: 'app', message, level: 'info', data: meta });
  },

  warn(message: string, meta?: LogMeta) {
    winstonLogger.warn(message, meta);
    console.warn(formatEntry('warn', message, meta));
    Sentry.addBreadcrumb({ category: 'app', message, level: 'warning', data: meta });
  },

  error(message: string, error?: unknown, meta?: LogMeta) {
    const extra = { ...meta };
    if (error instanceof Error) {
      extra.errorMessage = error.message;
      extra.stack = error.stack;
    } else if (error !== undefined) {
      extra.errorRaw = String(error);
    }

    winstonLogger.error(message, extra);
    console.error(formatEntry('error', message, extra));

    // Send to Sentry so it shows up in the Issues dashboard
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, ...meta } });
    } else {
      Sentry.captureMessage(message, { level: 'error', extra });
    }
  },

  debug(message: string, meta?: LogMeta) {
    winstonLogger.debug(message, meta);

    if (process.env.NODE_ENV === 'development') {
      console.debug(formatEntry('debug', message, meta));
    }
  },

  // Enterprise logging methods
  audit(action: string, userId: string, details: LogMeta = {}) {
    const auditEntry = {
      action,
      userId,
      details,
      timestamp: new Date().toISOString(),
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
    };

    winstonLogger.info('AUDIT', auditEntry);
    console.log(formatEntry('audit', `${action} by ${userId}`, auditEntry));

    // Store audit trail in database if needed
    // This would be implemented based on compliance requirements
  },

  performance(operation: string, duration: number, metadata: LogMeta = {}) {
    const perfEntry = {
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
    };

    winstonLogger.info('PERFORMANCE', perfEntry);

    // Log slow operations
    if (duration > 1000) {
      console.warn(formatEntry('performance', `Slow operation: ${operation}`, perfEntry));
    }
  },

  security(event: string, details: LogMeta = {}) {
    const securityEntry = {
      event,
      details,
      timestamp: new Date().toISOString(),
      severity: details.severity || 'medium',
    };

    winstonLogger.warn('SECURITY', securityEntry);
    console.warn(formatEntry('security', `Security event: ${event}`, securityEntry));

    // Send security events to monitoring
    Sentry.captureMessage(`Security: ${event}`, {
      level: 'warning',
      extra: securityEntry,
    });
  },

  business(event: string, data: LogMeta = {}) {
    const businessEntry = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    winstonLogger.info('BUSINESS', businessEntry);
    console.log(formatEntry('business', `Business event: ${event}`, businessEntry));
  },
};

export default logger;
