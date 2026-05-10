import { describe, it, expect } from "vitest";
import {
  ExtractionError,
  ContentNotAvailableError,
  AgeRestrictedContentError,
  GeoRestrictedContentError,
  ParsingError,
  ReCaptchaError,
} from "../../core/errors.js";

describe("ExtractionError hierarchy", () => {
  it("should be instanceof Error", () => {
    const error = new ExtractionError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("test");
  });

  it("ContentNotAvailableError extends ExtractionError", () => {
    const error = new ContentNotAvailableError("not available");
    expect(error).toBeInstanceOf(ExtractionError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("not available");
  });

  it("AgeRestrictedContentError extends ExtractionError", () => {
    const error = new AgeRestrictedContentError("age restricted");
    expect(error).toBeInstanceOf(ExtractionError);
  });

  it("GeoRestrictedContentError extends ExtractionError", () => {
    const error = new GeoRestrictedContentError("geo blocked");
    expect(error).toBeInstanceOf(ExtractionError);
  });

  it("ParsingError extends ExtractionError", () => {
    const error = new ParsingError("parse failed");
    expect(error).toBeInstanceOf(ExtractionError);
  });

  it("ReCaptchaError should store captcha URL", () => {
    const error = new ReCaptchaError("captcha", "https://captcha.example.com");
    expect(error).toBeInstanceOf(ExtractionError);
    expect(error.captchaUrl).toBe("https://captcha.example.com");
  });
});
