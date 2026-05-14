import { database } from "@/infrastructure/database/AppDatabase";

/** Cache TTLs in milliseconds. */
const CACHE_TTL = {
  streamInfo: 4 * 60 * 60 * 1000,   // 4 hours (YouTube URLs expire ~6h)
  searchResult: 15 * 60 * 1000,      // 15 minutes
  channelInfo: 30 * 60 * 1000,       // 30 minutes
  kiosk: 15 * 60 * 1000,             // 15 minutes
} as const;

export type CacheCategory = keyof typeof CACHE_TTL;

/** Cleanup interval: 10 minutes. */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Persistent cache for extractor responses using IndexedDB (Dexie).
 * Each entry has a TTL after which it's considered stale and re-fetched.
 */
export const ExtractorCache = {
  /**
   * Builds a standardized cache key.
   */
  buildKey(category: CacheCategory, serviceId: number, identifier: string): string {
    return `${category}:${serviceId}:${identifier}`;
  },

  /**
   * Retrieves cached data if it exists and hasn't expired.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = await database.extractorCache.get(key);
      if (!entry) {
        return null;
      }

      if (Date.now() > entry.expiresAt) {
        // Expired — delete asynchronously, return null
        database.extractorCache.delete(key).catch(() => {});
        return null;
      }

      return JSON.parse(entry.data) as T;
    } catch {
      return null;
    }
  },

  /**
   * Stores data in the cache with the specified TTL category.
   */
  async set<T>(key: string, data: T, category: CacheCategory): Promise<void> {
    const now = Date.now();
    const ttl = CACHE_TTL[category];

    try {
      await database.extractorCache.put({
        key,
        data: JSON.stringify(data),
        expiresAt: now + ttl,
        cachedAt: now,
      });
    } catch {
      // Cache write failure is non-critical — proceed silently
    }
  },

  /**
   * Removes a specific entry from the cache.
   */
  async invalidate(key: string): Promise<void> {
    try {
      await database.extractorCache.delete(key);
    } catch {
      // Non-critical
    }
  },

  /**
   * Removes all expired entries from the cache.
   */
  async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      await database.extractorCache
        .where("expiresAt")
        .below(now)
        .delete();
    } catch {
      // Non-critical
    }
  },

  /**
   * Starts periodic cleanup of expired entries.
   * Safe to call multiple times — only one timer is created.
   */
  startPeriodicCleanup(): void {
    if (cleanupTimer !== null) {
      return;
    }
    cleanupTimer = setInterval(() => {
      ExtractorCache.cleanup().catch(() => {});
    }, CLEANUP_INTERVAL_MS);
  },

  /**
   * Stops the periodic cleanup timer.
   */
  stopPeriodicCleanup(): void {
    if (cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  },
};
