import { describe, it, expect } from "vitest";
import {
  isRetryableError,
  isRateLimitError,
} from "../types";
import {
  ReCaptchaError,
  ContentNotAvailableError,
  AgeRestrictedContentError,
  GeoRestrictedContentError,
  ParsingError,
  ExtractionError,
} from "@newpipe/extractor";

describe("Resilience Types — isRetryableError", () => {
  it("should return true for ReCaptchaError (rate limiting is retryable)", () => {
    expect(isRetryableError(new ReCaptchaError("blocked", ""))).toBe(true);
  });

  it("should return true for ParsingError", () => {
    expect(isRetryableError(new ParsingError("parse failed"))).toBe(true);
  });

  it("should return true for generic ExtractionError", () => {
    expect(isRetryableError(new ExtractionError("generic"))).toBe(true);
  });

  it("should return true for generic Error", () => {
    expect(isRetryableError(new Error("network failed"))).toBe(true);
  });

  it("should return true for non-Error values", () => {
    expect(isRetryableError("string error")).toBe(true);
    expect(isRetryableError(null)).toBe(true);
    expect(isRetryableError(undefined)).toBe(true);
  });

  it("should return false for ContentNotAvailableError", () => {
    expect(isRetryableError(new ContentNotAvailableError("gone"))).toBe(false);
  });

  it("should return false for AgeRestrictedContentError", () => {
    expect(isRetryableError(new AgeRestrictedContentError("age gate"))).toBe(false);
  });

  it("should return false for GeoRestrictedContentError", () => {
    expect(isRetryableError(new GeoRestrictedContentError("geo blocked"))).toBe(false);
  });
});

describe("Resilience Types — isRateLimitError", () => {
  it("should return true for ReCaptchaError", () => {
    const error = new ReCaptchaError("blocked", "https://captcha.url");
    expect(isRateLimitError(error)).toBe(true);
  });

  it("should return false for other errors", () => {
    expect(isRateLimitError(new Error("generic"))).toBe(false);
    expect(isRateLimitError(new ParsingError("parse"))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});
