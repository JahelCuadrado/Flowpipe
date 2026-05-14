import type { ThrottlerConfig } from "./types";

const DEFAULT_CONFIG: ThrottlerConfig = {
  maxConcurrent: 3,
  delayMs: 200,
};

/**
 * Limits concurrent requests and enforces minimum delay between request starts.
 * Prevents overwhelming YouTube with parallel requests (e.g., feed loading).
 *
 * Uses a semaphore pattern with FIFO queuing.
 */
export class RequestThrottler {
  private readonly maxConcurrent: number;
  private readonly delayMs: number;
  private activeCount = 0;
  private lastStartTime = 0;
  private readonly queue: Array<() => void> = [];

  constructor(config: Partial<ThrottlerConfig> = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    this.maxConcurrent = merged.maxConcurrent;
    this.delayMs = merged.delayMs;
  }

  /**
   * Executes the given function respecting concurrency and delay limits.
   * Queues the request if the concurrency limit is reached.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Wraps an array of async operations with throttling.
   * Returns results matching Promise.allSettled semantics.
   */
  async executeAll<T>(
    tasks: ReadonlyArray<() => Promise<T>>
  ): Promise<PromiseSettledResult<T>[]> {
    const promises = tasks.map((task) =>
      this.execute(task).then(
        (value): PromiseSettledResult<T> => ({ status: "fulfilled", value }),
        (reason): PromiseSettledResult<T> => ({ status: "rejected", reason })
      )
    );
    return Promise.all(promises);
  }

  private acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      const tryAcquire = (): void => {
        if (this.activeCount < this.maxConcurrent) {
          this.activeCount++;
          const now = Date.now();
          const elapsed = now - this.lastStartTime;

          if (elapsed < this.delayMs && this.lastStartTime > 0) {
            const waitTime = this.delayMs - elapsed;
            this.lastStartTime = now + waitTime;
            setTimeout(resolve, waitTime);
          } else {
            this.lastStartTime = now;
            resolve();
          }
        } else {
          this.queue.push(tryAcquire);
        }
      };

      tryAcquire();
    });
  }

  private release(): void {
    this.activeCount--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
