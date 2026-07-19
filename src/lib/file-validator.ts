/**
 * File Upload Validator
 * 
 * Validates file uploads for security and integrity
 */

import crypto from 'crypto';

export interface FileValidationOptions {
  file: Buffer;
  filename: string;
  maxSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  hash?: string;
}

// Magic bytes for common file types
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38])],
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
  'application/zip': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  'text/plain': [], // No specific magic bytes
};

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const DEFAULT_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

/**
 * Validate file upload
 */
export async function validateFileUpload(options: FileValidationOptions): Promise<FileValidationResult> {
  const {
    file,
    filename,
    maxSize = DEFAULT_MAX_SIZE,
    allowedMimeTypes = DEFAULT_ALLOWED_TYPES,
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
  } = options;

  try {
    // 1. Check file size
    if (file.length > maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
      };
    }

    // 2. Check file extension
    const ext = getFileExtension(filename).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension .${ext} not allowed`,
      };
    }

    // 3. Detect MIME type from magic bytes
    const detectedMimeType = detectMimeType(file);
    if (!detectedMimeType) {
      return {
        valid: false,
        error: 'Could not detect file type',
      };
    }

    // 4. Check if detected MIME type is allowed
    if (!allowedMimeTypes.includes(detectedMimeType)) {
      return {
        valid: false,
        error: `File type ${detectedMimeType} not allowed`,
      };
    }

    // 5. Check for suspicious content in text files
    if (detectedMimeType === 'text/plain' || detectedMimeType === 'text/csv') {
      const content = file.toString('utf8', 0, Math.min(1000, file.length));
      if (containsMaliciousContent(content)) {
        return {
          valid: false,
          error: 'File contains suspicious content',
        };
      }
    }

    // 6. Calculate file hash for integrity verification
    const hash = crypto.createHash('sha256').update(file).digest('hex');

    return {
      valid: true,
      mimeType: detectedMimeType,
      hash,
    };
  } catch (error) {
    return {
      valid: false,
      error: `File validation error: ${String(error)}`,
    };
  }
}

/**
 * Detect MIME type from file magic bytes
 */
export function detectMimeType(file: Buffer): string | null {
  for (const [mimeType, magicBytes] of Object.entries(MAGIC_BYTES)) {
    for (const magic of magicBytes) {
      if (file.slice(0, magic.length).equals(magic)) {
        return mimeType;
      }
    }
  }
  return null;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop() || '';
}

/**
 * Check for malicious content patterns
 */
export function containsMaliciousContent(content: string): boolean {
  const suspiciousPatterns = [
    /<script[^>]*>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers (onclick, onload, etc.)
    /%3Cscript/gi, // Encoded script tags
    /eval\(/gi, // Eval function
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(content));
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return (
    filename
      .replace(/\.\./g, '') // Remove ..
      .replace(/[\/\\]/g, '') // Remove path separators
      .replace(/^\.+/, '') // Remove leading dots
      .substring(0, 255) // Limit length
  );
}

/**
 * Generate safe filename with hash
 */
export function generateSafeFilename(originalFilename: string, fileHash: string): string {
  const ext = getFileExtension(originalFilename);
  return `${fileHash.substring(0, 16)}.${ext}`;
}
