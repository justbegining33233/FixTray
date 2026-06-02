/**
 * encryption.ts
 * General-purpose AES-256-GCM encryption for sensitive fields.
 * Uses the same TOTP_ENCRYPTION_KEY env var as two-factor.ts.
 * Format: iv:authTag:ciphertext (all hex-encoded).
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM

function getEncryptionKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypt a plaintext string. Returns iv:authTag:ciphertext (hex). */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypt an encrypted string (iv:authTag:ciphertext format). */
export function decryptField(stored: string): string {
  // If it doesn't contain ':', it's legacy plaintext — return as-is
  if (!stored.includes(':')) return stored;

  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted field format');

  const [ivHex, tagHex, encHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Check if a value is already encrypted (iv:tag:ciphertext format). */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return parts.every(p => /^[0-9a-f]+$/i.test(p));
}
