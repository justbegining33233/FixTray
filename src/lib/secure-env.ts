/**
 * Secure Environment Variable Handler
 * 
 * Manages sensitive configuration with validation and encryption support
 * Prevents accidental logging or exposure of secrets
 */

import crypto from 'crypto';

export interface SecureEnvConfig {
  name: string;
  required: boolean;
  encrypted?: boolean;
  pattern?: RegExp;
  validator?: (value: string) => boolean;
}

const ENV_CONFIGS: Record<string, SecureEnvConfig> = {
  JWT_SECRET: {
    name: 'JWT_SECRET',
    required: true,
    pattern: /^[a-f0-9]{64}$/, // 32 bytes hex
    validator: (v) => v.length >= 32,
  },
  DATABASE_URL: {
    name: 'DATABASE_URL',
    required: true,
    pattern: /^postgresql:\/\//,
  },
  CORS_ORIGINS: {
    name: 'CORS_ORIGINS',
    required: true,
    validator: (v) => !v.includes('*'), // No wildcard
  },
  RESEND_API_KEY: {
    name: 'RESEND_API_KEY',
    required: false,
    pattern: /^re_[a-z0-9]+$/,
  },
  TWILIO_ACCOUNT_SID: {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    pattern: /^AC[a-z0-9]{32}$/,
  },
  STRIPE_SECRET_KEY: {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    pattern: /^sk_[a-z0-9]+$/,
  },
  SENTRY_DSN: {
    name: 'SENTRY_DSN',
    required: false,
    pattern: /^https:\/\/[a-z0-9]+@[a-z0-9.]+\/[0-9]+$/,
  },
};

/**
 * Get and validate environment variable
 */
export function getSecureEnv(name: keyof typeof ENV_CONFIGS): string | undefined {
  const config = ENV_CONFIGS[name];
  const value = process.env[name];

  if (!value) {
    if (config.required) {
      throw new Error(
        `[SECURITY] FATAL: Required environment variable ${name} not set. Set ${name} before deployment.`
      );
    }
    return undefined;
  }

  // Validate format if pattern defined
  if (config.pattern && !config.pattern.test(value)) {
    throw new Error(
      `[SECURITY] Invalid ${name} format. Expected format: ${config.pattern}`
    );
  }

  // Run custom validator if defined
  if (config.validator && !config.validator(value)) {
    throw new Error(`[SECURITY] Invalid ${name} value`);
  }

  return value;
}

/**
 * Check all required environment variables
 */
export function validateAllEnvVars(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, config] of Object.entries(ENV_CONFIGS)) {
    if (config.required) {
      try {
        getSecureEnv(key as keyof typeof ENV_CONFIGS);
      } catch (error) {
        errors.push(String(error));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Encrypt sensitive value for storage
 * Use for storing secrets locally (not recommended, but sometimes necessary)
 */
export function encryptValue(value: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive value
 */
export function decryptValue(encrypted: string, encryptionKey: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Redact sensitive values from logs
 */
export function redactSecrets(value: any): any {
  if (typeof value === 'string') {
    // Redact common secret patterns
    if (value.match(/^sk_/) || value.match(/^re_/) || value.match(/^[a-z0-9]{64}$/)) {
      return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
    }
  }
  return value;
}

/**
 * Safe environment variable getter for logging
 */
export function getSafeEnvForLogging(name: string): string {
  const value = process.env[name];
  if (!value) return '<not-set>';
  return redactSecrets(value);
}
