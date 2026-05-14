import { describe, it, expect } from "vitest";
import { executeWithResilience } from "../ResilienceService";
import type { ResilienceLevel } from "../types";
import {
  ContentNotAvailableError,
  ReCaptchaError,
} from "@newpipe/extractor";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createLevel<T>(name: string, fn: () => Promise<T>): ResilienceLevel<T> {
  return { name, execute: fn };
}

function successLevel<T>(name: string, value: T): ResilienceLevel<T> {
  return createLevel(name, async () => value);
}

function failLevel(name: string, error: Error): ResilienceLevel<string> {
  return createLevel(name, async () => { throw error; });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ResilienceService — executeWithResilience", () => {
  it("should return the result from the first level when it succeeds", async () => {
    const result = await executeWithResilience([
      successLevel("L1", "first"),
      successLevel("L2", "second"),
    ]);

    expect(result.data).toBe("first");
    expect(result.levelUsed).toBe("L1");
    expect(result.attempts).toBe(1);
  });

  it("should escalate to level 2 when level 1 throws ReCaptchaError", async () => {
    const result = await executeWithResilience([
      failLevel("Direct (iOS)", new ReCaptchaError("blocked", "https://captcha.url")),
      successLevel("Direct (Android)", "android-data"),
    ]);

    expect(result.data).toBe("android-data");
    expect(result.levelUsed).toBe("Direct (Android)");
    expect(result.attempts).toBe(2);
  });

  it("should escalate through all levels to the last one", async () => {
    const result = await executeWithResilience([
      failLevel("L1", new ReCaptchaError("blocked", "")),
      failLevel("L2", new ReCaptchaError("blocked", "")),
      successLevel("L3", "piped-data"),
    ]);

    expect(result.data).toBe("piped-data");
    expect(result.levelUsed).toBe("L3");
    expect(result.attempts).toBe(3);
  });

  it("should throw immediately for non-retryable errors (ContentNotAvailableError)", async () => {
    await expect(
      executeWithResilience([
        failLevel("L1", new ContentNotAvailableError("Video removed")),
        successLevel("L2", "should-not-reach"),
      ])
    ).rejects.toThrow(ContentNotAvailableError);
  });

  it("should throw the last error when all levels fail with retryable errors", async () => {
    await expect(
      executeWithResilience([
        failLevel("L1", new ReCaptchaError("block1", "")),
        failLevel("L2", new ReCaptchaError("block2", "")),
        failLevel("L3", new Error("piped-failed")),
      ])
    ).rejects.toThrow("piped-failed");
  });

  it("should throw when given zero levels", async () => {
    await expect(
      executeWithResilience([])
    ).rejects.toThrow("At least one resilience level is required");
  });

  it("should work with a single level", async () => {
    const result = await executeWithResilience([
      successLevel("only", "data"),
    ]);

    expect(result.data).toBe("data");
    expect(result.attempts).toBe(1);
  });

  it("should treat generic Error as retryable", async () => {
    const result = await executeWithResilience([
      failLevel("L1", new Error("network timeout")),
      successLevel("L2", "recovered"),
    ]);

    expect(result.data).toBe("recovered");
    expect(result.levelUsed).toBe("L2");
  });
});
