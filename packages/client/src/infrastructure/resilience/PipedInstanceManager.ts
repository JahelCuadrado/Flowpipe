import type { PipedInstance, PipedInstanceHealth } from "./types";

/** List of well-known Piped API instances as fallback. */
const HARDCODED_INSTANCES: readonly PipedInstance[] = [
  { name: "Kavin", apiUrl: "https://pipedapi.kavin.rocks", locations: "Global", version: "" },
  { name: "r4fo", apiUrl: "https://pipedapi.r4fo.com", locations: "EU", version: "" },
  { name: "Piped.yt", apiUrl: "https://api.piped.yt", locations: "EU", version: "" },
  { name: "Adminforge", apiUrl: "https://pipedapi.adminforge.de", locations: "DE", version: "" },
  { name: "Lunar", apiUrl: "https://pipedapi.lunar.icu", locations: "EU", version: "" },
];

/** URL to fetch the official list of Piped instances. */
const INSTANCES_LIST_URL = "https://piped-instances.kavin.rocks/";

/** How long to cache the instance list (24 hours). */
const INSTANCE_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/** How long an unhealthy instance stays marked as unhealthy (5 minutes). */
const UNHEALTHY_COOLDOWN_MS = 5 * 60 * 1000;

/** Request timeout for fetching instance list (10 seconds). */
const FETCH_TIMEOUT_MS = 10_000;

let cachedInstances: PipedInstance[] | null = null;
let instancesCachedAt = 0;
const healthMap = new Map<string, PipedInstanceHealth>();
let currentIndex = 0;

/**
 * Manages a pool of Piped API instances with health tracking
 * and round-robin selection.
 */
export const PipedInstanceManager = {
  /**
   * Returns all available instances, fetching from the official registry
   * if the cache is stale. Falls back to hardcoded instances on error.
   */
  async getInstances(): Promise<readonly PipedInstance[]> {
    const now = Date.now();

    if (cachedInstances && now - instancesCachedAt < INSTANCE_LIST_TTL_MS) {
      return cachedInstances;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(INSTANCES_LIST_URL, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as Array<Record<string, unknown>>;

      const instances: PipedInstance[] = data
        .filter(
          (entry) =>
            typeof entry["api_url"] === "string" &&
            typeof entry["name"] === "string"
        )
        .map((entry) => ({
          name: entry["name"] as string,
          apiUrl: (entry["api_url"] as string).replace(/\/$/, ""),
          locations: (entry["locations"] as string) ?? "",
          version: (entry["version"] as string) ?? "",
        }));

      if (instances.length > 0) {
        cachedInstances = instances;
        instancesCachedAt = now;
        return cachedInstances;
      }
    } catch {
      // Network error or parse error — fall through to hardcoded
    }

    if (!cachedInstances) {
      cachedInstances = [...HARDCODED_INSTANCES];
      instancesCachedAt = now;
    }

    return cachedInstances;
  },

  /**
   * Returns the next healthy Piped instance using round-robin.
   * Skips instances that recently failed (within UNHEALTHY_COOLDOWN_MS).
   * Returns null if all instances are unhealthy.
   */
  async getNextHealthyInstance(): Promise<PipedInstance | null> {
    const instances = await this.getInstances();
    const now = Date.now();

    for (let attempts = 0; attempts < instances.length; attempts++) {
      const index = (currentIndex + attempts) % instances.length;
      const instance = instances[index]!;
      const health = healthMap.get(instance.apiUrl);

      // Consider healthy if: no record, healthy status, or cooldown expired
      if (
        !health ||
        health.healthy ||
        now - health.lastChecked > UNHEALTHY_COOLDOWN_MS
      ) {
        currentIndex = (index + 1) % instances.length;
        return instance;
      }
    }

    // All unhealthy — reset health and try the first one
    healthMap.clear();
    currentIndex = 0;
    return instances[0] ?? null;
  },

  /**
   * Reports a successful request to the given instance.
   */
  reportSuccess(instance: PipedInstance): void {
    healthMap.set(instance.apiUrl, {
      instance,
      healthy: true,
      lastChecked: Date.now(),
      consecutiveFailures: 0,
    });
  },

  /**
   * Reports a failed request to the given instance.
   */
  reportFailure(instance: PipedInstance): void {
    const existing = healthMap.get(instance.apiUrl);
    const failures = (existing?.consecutiveFailures ?? 0) + 1;

    healthMap.set(instance.apiUrl, {
      instance,
      healthy: false,
      lastChecked: Date.now(),
      consecutiveFailures: failures,
    });
  },

  /**
   * Resets all cached state (for testing).
   */
  reset(): void {
    cachedInstances = null;
    instancesCachedAt = 0;
    healthMap.clear();
    currentIndex = 0;
  },
};
