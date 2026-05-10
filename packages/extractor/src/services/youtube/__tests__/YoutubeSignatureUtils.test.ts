import { describe, it, expect } from "vitest";
import {
  getSignatureTimestamp,
  getSignatureDeobfuscationCode,
  getThrottlingDeobfuscationFunctionName,
  getThrottlingParameterFromUrl,
} from "../YoutubeSignatureUtils.js";
import { ParsingError } from "../../../core/errors.js";

// ─── getSignatureTimestamp ───────────────────────────────────────────────────

describe("getSignatureTimestamp", () => {
  it("should extract timestamp with equals sign format", () => {
    const code = 'var b={signatureTimestamp=20256};other code';
    expect(getSignatureTimestamp(code)).toBe(20256);
  });

  it("should extract timestamp with colon format", () => {
    const code = 'signatureTimestamp:20501,other:"data"';
    expect(getSignatureTimestamp(code)).toBe(20501);
  });

  it("should throw ParsingError when not found", () => {
    expect(() => getSignatureTimestamp("no timestamp here")).toThrow(ParsingError);
  });
});

// ─── getSignatureDeobfuscationCode ──────────────────────────────────────────

describe("getSignatureDeobfuscationCode", () => {
  it("should extract deobfuscation code from player JS", () => {
    // Simulate a minimal player code with the pattern:
    // function name pattern: c&&(c=Xy(decodeURIComponent(c))
    // function body: Xy=function(a){a=a.split("");Hz.XX(a,5);...;return a.join("")}
    // helper object: var Hz={XX:function(a,b){...}};
    const playerCode = [
      'var Hz={XX:function(a,b){var c=a[0];a[0]=a[b%a.length];a[b%a.length]=c},',
      'YY:function(a){a.reverse()},',
      'ZZ:function(a,b){a.splice(0,b)}};',
      'Xy=function(a){a=a.split("");Hz.XX(a,5);Hz.YY(a);Hz.ZZ(a,3);return a.join("")};',
      'something c&&(c=Xy(decodeURIComponent(c))) more code',
    ].join("\n");

    const code = getSignatureDeobfuscationCode(playerCode);

    expect(code).toContain("Xy=function");
    expect(code).toContain("Hz");
    expect(code).toContain("deobfuscate");
  });

  it("should throw when function name not found", () => {
    expect(() =>
      getSignatureDeobfuscationCode("no matching pattern here at all")
    ).toThrow(ParsingError);
  });
});

// ─── getThrottlingDeobfuscationFunctionName ─────────────────────────────────

describe("getThrottlingDeobfuscationFunctionName", () => {
  it("should extract function name from array pattern", () => {
    // Pattern: .get("n"))&&(b=SDa[0](b)
    const playerCode = [
      'var SDa=[myThrottleFunc];',
      'something.get("n"))&&(b=SDa[0](b)',
    ].join("\n");

    const name = getThrottlingDeobfuscationFunctionName(playerCode);
    expect(name).toBe("myThrottleFunc");
  });

  it("should throw when function name not found", () => {
    expect(() =>
      getThrottlingDeobfuscationFunctionName("no throttle function here")
    ).toThrow(ParsingError);
  });
});

// ─── getThrottlingParameterFromUrl ──────────────────────────────────────────

describe("getThrottlingParameterFromUrl", () => {
  it("should extract n parameter from URL", () => {
    const url = "https://rr1.googlevideo.com/videoplayback?expire=123&n=abc123def&itag=140";
    expect(getThrottlingParameterFromUrl(url)).toBe("abc123def");
  });

  it("should return null when n parameter is missing", () => {
    const url = "https://rr1.googlevideo.com/videoplayback?expire=123&itag=140";
    expect(getThrottlingParameterFromUrl(url)).toBeNull();
  });

  it("should handle n as first parameter", () => {
    const url = "https://example.com/video?n=firstParam&other=value";
    expect(getThrottlingParameterFromUrl(url)).toBe("firstParam");
  });

  it("should return null for empty URL", () => {
    expect(getThrottlingParameterFromUrl("")).toBeNull();
  });
});
