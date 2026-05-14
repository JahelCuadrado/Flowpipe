import { describe, it, expect, beforeEach } from "vitest";
import { PipedInstanceManager } from "../PipedInstanceManager";

describe("PipedInstanceManager", () => {
  beforeEach(() => {
    PipedInstanceManager.reset();
  });

  it("should return instances (hardcoded fallback when network unavailable)", async () => {
    const instances = await PipedInstanceManager.getInstances();

    expect(instances.length).toBeGreaterThan(0);
    expect(instances[0]!.apiUrl).toContain("https://");
    expect(instances[0]!.name).toBeTruthy();
  });

  it("should return a healthy instance via getNextHealthyInstance", async () => {
    const instance = await PipedInstanceManager.getNextHealthyInstance();

    expect(instance).not.toBeNull();
    expect(instance!.apiUrl).toContain("https://");
  });

  it("should rotate instances with round-robin", async () => {
    const first = await PipedInstanceManager.getNextHealthyInstance();
    const second = await PipedInstanceManager.getNextHealthyInstance();

    // Should get different instances (assuming >1 available)
    const instances = await PipedInstanceManager.getInstances();
    if (instances.length > 1) {
      expect(first!.apiUrl).not.toBe(second!.apiUrl);
    }
  });

  it("should skip unhealthy instances", async () => {
    const first = await PipedInstanceManager.getNextHealthyInstance();
    expect(first).not.toBeNull();

    // Mark first as failed
    PipedInstanceManager.reportFailure(first!);

    // Next call should skip the unhealthy one
    const second = await PipedInstanceManager.getNextHealthyInstance();
    const instances = await PipedInstanceManager.getInstances();

    if (instances.length > 1) {
      expect(second!.apiUrl).not.toBe(first!.apiUrl);
    }
  });

  it("should recover instances after reporting success", async () => {
    const instance = await PipedInstanceManager.getNextHealthyInstance();
    expect(instance).not.toBeNull();

    PipedInstanceManager.reportFailure(instance!);
    PipedInstanceManager.reportSuccess(instance!);

    // Reset round-robin for deterministic test
    PipedInstanceManager.reset();

    const recovered = await PipedInstanceManager.getNextHealthyInstance();
    expect(recovered).not.toBeNull();
  });

  it("should reset health map and return first instance when all are unhealthy", async () => {
    const instances = await PipedInstanceManager.getInstances();

    // Mark ALL instances as unhealthy
    for (const inst of instances) {
      PipedInstanceManager.reportFailure(inst);
    }

    // Should still return an instance (health map is cleared as fallback)
    const fallback = await PipedInstanceManager.getNextHealthyInstance();
    expect(fallback).not.toBeNull();
  });

  it("should cache instances after first fetch", async () => {
    const first = await PipedInstanceManager.getInstances();
    const second = await PipedInstanceManager.getInstances();

    // Same reference = cached
    expect(first).toBe(second);
  });
});
