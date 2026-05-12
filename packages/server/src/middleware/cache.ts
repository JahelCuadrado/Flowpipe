import NodeCache from "node-cache";

const DEFAULT_TTL_SECONDS = 300;

/**
  * Simple in-memory cache for extraction results.
  * Reduces redundant requests to upstream services.
  *
  * Can be replaced with Redis for multi-instance deployments.
  */
export class CacheService {
  private readonly cache: NodeCache;

  constructor(defaultTtlSeconds: number = DEFAULT_TTL_SECONDS) {
    this.cache = new NodeCache({
      stdTTL: defaultTtlSeconds,
      checkperiod: 120,
      useClones: true,
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (ttlSeconds !== undefined) {
      this.cache.set(key, value, ttlSeconds);
    } else {
      this.cache.set(key, value);
    }
  }

  del(key: string): void {
    this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  /**
    * Get-or-set pattern: returns cached value if exists,
    * otherwise calls the factory, caches the result, and returns it.
    */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

export const searchCache = new CacheService(300);
export const streamCache = new CacheService(600);
export const channelCache = new CacheService(900);
