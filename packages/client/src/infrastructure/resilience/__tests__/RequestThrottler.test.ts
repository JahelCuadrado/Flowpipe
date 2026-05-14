import { describe, it, expect } from "vitest";
import { RequestThrottler } from "../RequestThrottler";

describe("RequestThrottler", () => {
  it("should execute a single task and return the result", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 3, delayMs: 0 });

    const result = await throttler.execute(async () => "hello");
    expect(result).toBe("hello");
  });

  it("should propagate errors from tasks", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 3, delayMs: 0 });

    await expect(
      throttler.execute(async () => { throw new Error("task-failed"); })
    ).rejects.toThrow("task-failed");
  });

  it("should limit concurrency", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 2, delayMs: 0 });
    let peakConcurrent = 0;
    let currentConcurrent = 0;

    const tasks = Array.from({ length: 6 }, () => async () => {
      currentConcurrent++;
      peakConcurrent = Math.max(peakConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 50));
      currentConcurrent--;
      return "done";
    });

    await throttler.executeAll(tasks);
    expect(peakConcurrent).toBeLessThanOrEqual(2);
  });

  it("executeAll should return PromiseSettledResult for all tasks", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 3, delayMs: 0 });

    const tasks = [
      async () => "success",
      async () => { throw new Error("fail"); return ""; },
      async () => "also-success",
    ];

    const results = await throttler.executeAll(tasks);

    expect(results).toHaveLength(3);
    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]!.status).toBe("rejected");
    expect(results[2]!.status).toBe("fulfilled");

    if (results[0]!.status === "fulfilled") {
      expect(results[0]!.value).toBe("success");
    }
    if (results[2]!.status === "fulfilled") {
      expect(results[2]!.value).toBe("also-success");
    }
  });

  it("should execute all tasks even when some fail", async () => {
    const throttler = new RequestThrottler({ maxConcurrent: 1, delayMs: 0 });
    const executed: number[] = [];

    const tasks = Array.from({ length: 4 }, (_, i) => async () => {
      executed.push(i);
      if (i === 1) throw new Error("middle-fail");
      return `task-${i}`;
    });

    const results = await throttler.executeAll(tasks);

    expect(executed).toEqual([0, 1, 2, 3]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("should use default config when none provided", async () => {
    const throttler = new RequestThrottler();
    const result = await throttler.execute(async () => 42);
    expect(result).toBe(42);
  });
});
