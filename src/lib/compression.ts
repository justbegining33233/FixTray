// HTTP Compression Middleware
// Implements gzip, deflate, and brotli compression for responses

import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

interface CompressionOptions {
  level?: number; // Compression level (1-9)
  threshold?: number; // Minimum response size to compress (bytes)
  enabled?: boolean;
}

class CompressionMiddleware {
  private options: Required<CompressionOptions>;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      level: 6,
      threshold: 1024, // 1KB
      enabled: process.env.ENABLE_COMPRESSION !== 'false',
      ...options
    };
  }

  async compress(data: string | Buffer, encoding: 'gzip' | 'deflate' | 'br'): Promise<Buffer> {
    if (!this.options.enabled) {
      return Buffer.isBuffer(data) ? data : Buffer.from(data);
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Don't compress if below threshold
    if (buffer.length < this.options.threshold) {
      return buffer;
    }

    const zlibOptions = { level: this.options.level };

    switch (encoding) {
      case 'gzip':
        return await gzip(buffer, zlibOptions);
      case 'deflate':
        return await deflate(buffer, zlibOptions);
      case 'br':
        return await brotliCompress(buffer, {
          ...zlibOptions,
          params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level,
          }
        });
      default:
        return buffer;
    }
  }

  getAcceptedEncoding(request: NextRequest): 'gzip' | 'deflate' | 'br' | null {
    const acceptEncoding = request.headers.get('accept-encoding') || '';

    // Check for brotli support (preferred)
    if (acceptEncoding.includes('br')) {
      return 'br';
    }

    // Check for gzip support
    if (acceptEncoding.includes('gzip')) {
      return 'gzip';
    }

    // Check for deflate support
    if (acceptEncoding.includes('deflate')) {
      return 'deflate';
    }

    return null;
  }

  shouldCompress(response: NextResponse, contentType: string): boolean {
    if (!this.options.enabled) return false;

    // Don't compress if response is already compressed
    if (response.headers.get('content-encoding')) return false;

    // Don't compress non-text content
    if (!contentType.includes('text/') &&
        !contentType.includes('application/json') &&
        !contentType.includes('application/javascript') &&
        !contentType.includes('application/xml')) {
      return false;
    }

    // Don't compress small responses
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) < this.options.threshold) {
      return false;
    }

    return true;
  }

  async applyCompression(request: NextRequest, response: NextResponse): Promise<NextResponse> {
    const contentType = response.headers.get('content-type') || '';
    const encoding = this.getAcceptedEncoding(request);

    if (!encoding || !this.shouldCompress(response, contentType)) {
      return response;
    }

    try {
      // Get response body
      const body = await response.text();
      const compressed = await this.compress(body, encoding);

      // Create new response with compressed body
      const compressedResponse = new NextResponse(new Uint8Array(compressed), {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'content-encoding': encoding,
          'content-length': compressed.length.toString(),
          'vary': 'accept-encoding',
        },
      });

      return compressedResponse;
    } catch (error) {
      console.error('Compression error:', error);
      // Return original response if compression fails
      return response;
    }
  }
}

// Export singleton instance
export const compressionMiddleware = new CompressionMiddleware();

// Alias used by workorders/route.ts and enterprise.ts
export const compression = {
  addCompressionHeaders(response: NextResponse): void {
    response.headers.set('Vary', 'Accept-Encoding');
  },
  configure(options: { threshold?: number; level?: number; enabled?: boolean }): void {
    if (options.threshold !== undefined) (compressionMiddleware as any).options.threshold = options.threshold;
    if (options.level !== undefined) (compressionMiddleware as any).options.level = options.level;
    if (options.enabled !== undefined) (compressionMiddleware as any).options.enabled = options.enabled;
  },
  getStats(): Record<string, unknown> {
    return compressionStats.getStats();
  },
};

// Next.js middleware for compression
export async function withCompression(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  return await compressionMiddleware.applyCompression(request, response);
}

// Utility function to compress API responses
export async function compressAPIResponse(
  data: any,
  request: NextRequest,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<NextResponse> {
  const response = NextResponse.json(data, {
    status: options.status || 200,
    headers: options.headers,
  });

  return await compressionMiddleware.applyCompression(request, response);
}

// Compression statistics
export class CompressionStats {
  private stats = {
    totalRequests: 0,
    compressedRequests: 0,
    totalBytesOriginal: 0,
    totalBytesCompressed: 0,
    compressionRatio: 0,
  };

  recordCompression(originalSize: number, compressedSize: number) {
    this.stats.totalRequests++;
    this.stats.compressedRequests++;
    this.stats.totalBytesOriginal += originalSize;
    this.stats.totalBytesCompressed += compressedSize;
    this.stats.compressionRatio = this.stats.totalBytesCompressed / this.stats.totalBytesOriginal;
  }

  recordNoCompression(size: number) {
    this.stats.totalRequests++;
    this.stats.totalBytesOriginal += size;
  }

  getStats() {
    const savings = this.stats.totalBytesOriginal - this.stats.totalBytesCompressed;
    const savingsPercentage = this.stats.totalBytesOriginal > 0
      ? (savings / this.stats.totalBytesOriginal) * 100
      : 0;

    return {
      ...this.stats,
      bandwidthSaved: savings,
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
    };
  }

  reset() {
    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      totalBytesOriginal: 0,
      totalBytesCompressed: 0,
      compressionRatio: 0,
    };
  }
}

export const compressionStats = new CompressionStats();