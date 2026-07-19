/**
 * Logging Filter and Sanitizer
 * 
 * Reduces verbose logging and sanitizes sensitive data
 */

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

const SENSITIVE_PATTERNS = [
  /password/gi,
  /secret/gi,
  /token/gi,
  /apikey/gi,
  /authorization/gi,
  /Bearer\s+[^\s]+/gi,
  /\b\d{13,19}\b/g, // Credit card-like
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
];

/**
 * Sanitize log entry to remove sensitive data
 */
export function sanitizeLogEntry(entry: LogEntry): LogEntry {
  return {
    ...entry,
    message: sanitizeString(entry.message),
    context: entry.context ? sanitizeObject(entry.context) : undefined,
  };
}

/**
 * Sanitize string by redacting sensitive patterns
 */
export function sanitizeString(str: string): string {
  let sanitized = str;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = Array.isArray(value) ? value.map(sanitizeObject) : sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check if key is sensitive
 */
function isSensitiveKey(key: string): boolean {
  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'apikey',
    'api_key',
    'authorization',
    'bearer',
    'cookie',
    'session',
    'refresh',
    'jwt',
    'hmac',
    'signature',
  ];

  return sensitiveKeys.some((k) => key.toLowerCase().includes(k));
}

/**
 * Filter verbose debug logs based on configuration
 */
export function shouldLog(level: LogEntry['level'], verbosity: number): boolean {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  return levels[level] >= verbosity;
}

/**
 * Format log entry for output
 */
export function formatLogEntry(entry: LogEntry, includeContext: boolean = false): string {
  const sanitized = sanitizeLogEntry(entry);
  const timestamp = sanitized.timestamp.toISOString();
  const level = sanitized.level.toUpperCase();

  let formatted = `[${timestamp}] ${level}: ${sanitized.message}`;

  if (includeContext && sanitized.context) {
    formatted += ` | ${JSON.stringify(sanitized.context)}`;
  }

  return formatted;
}

/**
 * Logger class with built-in sanitization
 */
export class SecureLogger {
  private verbosity: number; // 0=debug, 1=info, 2=warn, 3=error

  constructor(verbosity: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    const verbosityMap = { debug: 0, info: 1, warn: 2, error: 3 };
    this.verbosity = verbosityMap[verbosity];
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.log('error', message, context);
  }

  private log(level: LogEntry['level'], message: string, context?: Record<string, any>) {
    if (!shouldLog(level, this.verbosity)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
    };

    const formatted = formatLogEntry(entry, this.verbosity === 0); // Include context only in debug

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
}

export const logger = new SecureLogger(process.env.LOG_LEVEL as any || 'info');
