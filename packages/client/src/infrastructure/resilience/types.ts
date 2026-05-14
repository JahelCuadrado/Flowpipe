import type { ReCaptchaError } from "@newpipe/extractor";

/**
 * Represents a single level in the resilience cascade.
 * Each level attempts to fulfill a request through a different strategy.
 */
export interface ResilienceLevel<T> {
  /** Human-readable name for logging/diagnostics. */
  readonly name: string;

  /** Executes the level's strategy. */
  readonly execute: () => Promise<T>;
}

/**
 * Result of a resilience cascade execution, including which level succeeded.
 */
export interface ResilienceResult<T> {
  readonly data: T;
  readonly levelUsed: string;
  readonly attempts: number;
}

/**
 * Supported InnerTube client types for client rotation.
 */
export type InnerTubeClientType = "IOS" | "ANDROID";

/**
 * Configuration for the request throttler.
 */
export interface ThrottlerConfig {
  /** Maximum number of concurrent requests. */
  readonly maxConcurrent: number;

  /** Minimum delay in milliseconds between request starts. */
  readonly delayMs: number;
}

/**
 * Piped API instance information.
 */
export interface PipedInstance {
  readonly name: string;
  readonly apiUrl: string;
  readonly locations: string;
  readonly version: string;
}

/**
 * Health status of a Piped instance.
 */
export interface PipedInstanceHealth {
  readonly instance: PipedInstance;
  readonly healthy: boolean;
  readonly lastChecked: number;
  readonly consecutiveFailures: number;
}

/**
 * Determines whether an error is retryable (i.e., the next cascade level should be tried).
 * Non-retryable errors (content not found, age-restricted, etc.) are thrown immediately.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true;
  }

  const nonRetryableNames = new Set([
    "ContentNotAvailableError",
    "AgeRestrictedContentError",
    "GeoRestrictedContentError",
  ]);

  return !nonRetryableNames.has(error.name);
}

/**
 * Type guard for ReCaptchaError (rate-limiting / IP block).
 */
export function isRateLimitError(error: unknown): error is ReCaptchaError {
  return error instanceof Error && error.name === "ReCaptchaError";
}
