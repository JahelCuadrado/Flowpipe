import { describe, it, expect } from "vitest";
import { postToInnerTube } from "../YoutubeParsingHelper.js";
import { ReCaptchaError } from "../../../core/errors.js";
import { ParsingError } from "../../../core/errors.js";
import type { Downloader, DownloaderResponse } from "../../../core/types.js";

// ─── Mock Downloader ─────────────────────────────────────────────────────────

function createMockResponse(overrides: Partial<DownloaderResponse> = {}): DownloaderResponse {
  return {
    responseCode: 200,
    responseMessage: "OK",
    responseHeaders: {},
    responseBody: JSON.stringify({ status: "ok" }),
    latestUrl: "",
    ...overrides,
  };
}

function createMockDownloader(
  postHandler: (url: string, headers?: Record<string, string>, body?: string) => Promise<DownloaderResponse>
): Downloader {
  const noop = async (url: string) => createMockResponse({ latestUrl: url });
  return {
    get: noop,
    post: postHandler,
    head: noop,
  };
}

// ─── Minimal valid InnerTube body ────────────────────────────────────────────

function createMinimalBody() {
  return {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20260120.01.00",
        hl: "en",
        gl: "US",
        platform: "DESKTOP",
        utcOffsetMinutes: 0,
      },
      request: { useSsl: true, internalExperimentFlags: [] },
      user: { lockedSafetyMode: false },
    },
  } as never;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("postToInnerTube — Block Detection", () => {
  it("should throw ReCaptchaError on HTTP 429", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({ responseCode: 429, responseBody: "Too many requests" })
    );

    await expect(
      postToInnerTube(downloader, "player", createMinimalBody())
    ).rejects.toThrow(ReCaptchaError);
  });

  it("should throw ReCaptchaError on HTTP 403", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({ responseCode: 403, responseBody: "Forbidden" })
    );

    await expect(
      postToInnerTube(downloader, "player", createMinimalBody())
    ).rejects.toThrow(ReCaptchaError);
  });

  it("should throw ReCaptchaError when body contains 'recaptcha'", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({
        responseCode: 200,
        responseBody: JSON.stringify({
          error: { message: "Please solve the recaptcha challenge" },
        }),
      })
    );

    await expect(
      postToInnerTube(downloader, "search", createMinimalBody())
    ).rejects.toThrow(ReCaptchaError);
  });

  it("should throw ReCaptchaError when body contains 'google.com/sorry'", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({
        responseCode: 200,
        responseBody: '<html>Redirect to google.com/sorry for rate limiting</html>',
      })
    );

    await expect(
      postToInnerTube(downloader, "browse", createMinimalBody())
    ).rejects.toThrow(ReCaptchaError);
  });

  it("should throw ReCaptchaError when response has RESOURCE_EXHAUSTED error", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({
        responseCode: 200,
        responseBody: JSON.stringify({
          error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" },
        }),
      })
    );

    await expect(
      postToInnerTube(downloader, "player", createMinimalBody())
    ).rejects.toThrow(ReCaptchaError);
  });

  it("should throw ParsingError on HTTP 404", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({ responseCode: 404, responseBody: "Not found" })
    );

    await expect(
      postToInnerTube(downloader, "player", createMinimalBody())
    ).rejects.toThrow(ParsingError);
  });

  it("should throw ParsingError on HTTP 500", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({ responseCode: 500, responseBody: "Internal server error" })
    );

    await expect(
      postToInnerTube(downloader, "player", createMinimalBody())
    ).rejects.toThrow(ParsingError);
  });

  it("should throw ParsingError when response body is too short", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({ responseCode: 200, responseBody: "{}" })
    );

    await expect(
      postToInnerTube(downloader, "player", createMinimalBody())
    ).rejects.toThrow(ParsingError);
  });

  it("should return parsed JSON on successful response", async () => {
    const validResponse = {
      playabilityStatus: { status: "OK" },
      videoDetails: { title: "Test Video" },
    };

    const downloader = createMockDownloader(async () =>
      createMockResponse({
        responseCode: 200,
        responseBody: JSON.stringify(validResponse),
      })
    );

    const result = await postToInnerTube(downloader, "player", createMinimalBody());
    expect(result).toEqual(validResponse);
  });

  it("should prioritize 429 detection over body content checks", async () => {
    const downloader = createMockDownloader(async () =>
      createMockResponse({
        responseCode: 429,
        responseBody: JSON.stringify({ valid: true, long: "a".repeat(100) }),
      })
    );

    const error = await postToInnerTube(downloader, "player", createMinimalBody())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ReCaptchaError);
    expect((error as ReCaptchaError).message).toContain("429");
  });
});
