import type { ResilienceLevel, ResilienceResult } from "./types";
import { isRetryableError } from "./types";

/**
 * Orchestrates a cascade of resilience levels for fetching data.
 * Tries each level in order; if a level fails with a retryable error,
 * the next level is attempted. Non-retryable errors are thrown immediately.
 *
 * Flow: Level 1 → Level 2 → Level 3 → ... → throw last error
 */
export async function executeWithResilience<T>(
  levels: readonly ResilienceLevel<T>[]
): Promise<ResilienceResult<T>> {
  if (levels.length === 0) {
    throw new Error("At least one resilience level is required");
  }

  let lastError: unknown = null;

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;

    try {
      const data = await level.execute();
      if (i > 0) {
        console.info(`[Resilience] Succeeded at level "${level.name}" after ${i} failed attempt(s)`);
      }
      return {
        data,
        levelUsed: level.name,
        attempts: i + 1,
      };
    } catch (error: unknown) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isLastLevel = i === levels.length - 1;

      if (isLastLevel) {
        console.error(`[Resilience] All ${levels.length} levels exhausted. Last error: ${errorMessage}`);
      } else {
        console.warn(
          `[Resilience] Level "${level.name}" failed: ${errorMessage}. Escalating to "${levels[i + 1]!.name}"...`
        );
      }
    }
  }

  throw lastError;
}
