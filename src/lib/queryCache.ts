// Database Query Caching System
// Implements Redis-backed query result caching with invalidation strategies

import { Redis } from '@upstash/redis';

interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix: string;
  enabled: boolean;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  query: string;
  params?: any[];
}

class QueryCache {
  private redis: Redis | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 300, // 5 minutes default
      keyPrefix: 'query_cache:',
      enabled: process.env.ENABLE_QUERY_CACHE === 'true',
      ...config
    };

    // Initialize Redis if available
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }
  }

  // Generate cache key from query and parameters
  private generateKey(query: string, params?: any[]): string {
    const queryHash = this.simpleHash(query);
    const paramsHash = params ? this.simpleHash(JSON.stringify(params)) : '';
    return `${this.config.keyPrefix}${queryHash}_${paramsHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Get cached result
  async get<T = any>(query: string, params?: any[]): Promise<T | null> {
    if (!this.config.enabled) return null;

    const key = this.generateKey(query, params);

    try {
      // Try Redis first
      if (this.redis) {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached as string);
          if (Date.now() - entry.timestamp < entry.ttl * 1000) {
            return entry.data;
          } else {
            // Expired, remove from cache
            await this.redis.del(key);
          }
        }
      }

      // Fallback to memory cache
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl * 1000) {
        return memoryEntry.data;
      } else if (memoryEntry) {
        // Expired, remove from memory cache
        this.memoryCache.delete(key);
      }

    } catch (error) {
      console.error('Cache get error:', error);
    }

    return null;
  }

  // Set cached result
  async set<T = any>(query: string, data: T, params?: any[], customTtl?: number): Promise<void> {
    if (!this.config.enabled) return;

    const key = this.generateKey(query, params);
    const ttl = customTtl || this.config.ttl;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      query,
      params
    };

    try {
      // Set in Redis
      if (this.redis) {
        await this.redis.setex(key, ttl, JSON.stringify(entry));
      }

      // Also set in memory cache
      this.memoryCache.set(key, entry);

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Invalidate cache by query pattern
  async invalidate(pattern: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Invalidate Redis cache
      if (this.redis) {
        const keys = await this.redis.keys(`${this.config.keyPrefix}${pattern}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Invalidate memory cache
      for (const [key] of this.memoryCache.entries()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
        }
      }

    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Invalidate all cache
  async invalidateAll(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Clear Redis cache
      if (this.redis) {
        const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Clear memory cache
      this.memoryCache.clear();

    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    redisEnabled: boolean;
    memoryCacheSize: number;
    redisKeys?: number;
  }> {
    const stats = {
      redisEnabled: !!this.redis,
      memoryCacheSize: this.memoryCache.size,
    };

    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
        (stats as any).redisKeys = keys.length;
      } catch (error) {
        console.error('Error getting Redis stats:', error);
      }
    }

    return stats;
  }
}

// Export singleton instance
export const queryCache = new QueryCache();

// Database query wrapper with caching
export async function cachedQuery<T = any>(
  queryFn: () => Promise<T>,
  cacheKey: string,
  options: {
    ttl?: number;
    params?: any[];
    bypassCache?: boolean;
  } = {}
): Promise<T> {
  const { ttl, params, bypassCache = false } = options;

  if (!bypassCache) {
    const cached = await queryCache.get<T>(cacheKey, params);
    if (cached !== null) {
      return cached;
    }
  }

  const result = await queryFn();

  if (!bypassCache) {
    await queryCache.set(cacheKey, result, params, ttl);
  }

  return result;
}

// Cache invalidation helpers
export const cacheInvalidation = {
  // Invalidate work order related caches
  workOrders: () => queryCache.invalidate('workorder'),

  // Invalidate user related caches
  users: () => queryCache.invalidate('user'),

  // Invalidate shop related caches
  shops: () => queryCache.invalidate('shop'),

  // Invalidate analytics caches
  analytics: () => queryCache.invalidate('analytics'),

  // Clear all caches
  all: () => queryCache.invalidateAll(),
};

// Cache warming utilities
export class CacheWarmer {
  private warmingTasks: Array<() => Promise<void>> = [];

  addTask(task: () => Promise<void>) {
    this.warmingTasks.push(task);
  }

  async warmCache(): Promise<void> {
    console.log(`Starting cache warming with ${this.warmingTasks.length} tasks...`);

    const results = await Promise.allSettled(
      this.warmingTasks.map(task => task())
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Cache warming completed: ${successful} successful, ${failed} failed`);
  }
}

export const cacheWarmer = new CacheWarmer();