import { describe, it, expect, beforeEach } from "vitest";
import {
  generateConsentCookie,
  setConsentAccepted,
  generateContentPlaybackNonce,
  generateTParameter,
  getTextFromObject,
  getUrlFromNavigationEndpoint,
  getThumbnailsFromInfoItem,
  isVerified,
  parseDurationString,
  getJsonValue,
  getYouTubeHeaders,
  getAndroidUserAgent,
  getIosUserAgent,
  resetClientVersion,
  getClientVersion,
  buildDesktopContext,
} from "../YoutubeParsingHelper.js";
import type { Downloader, DownloaderResponse } from "../../../core/types.js";

// ─── Mock Downloader ─────────────────────────────────────────────────────────

function createMockDownloader(overrides: Partial<Record<string, (url: string) => Promise<DownloaderResponse>>> = {}): Downloader {
  const defaultResponse: DownloaderResponse = {
    responseCode: 200,
    responseMessage: "OK",
    responseHeaders: {},
    responseBody: "",
    latestUrl: "",
  };

  return {
    get: overrides.get ?? (async (url: string) => ({ ...defaultResponse, latestUrl: url })),
    post: overrides.post ?? (async (url: string) => ({ ...defaultResponse, latestUrl: url })),
    head: overrides.head ?? (async (url: string) => ({ ...defaultResponse, latestUrl: url })),
  };
}

// ─── Consent Cookie ──────────────────────────────────────────────────────────

describe("generateConsentCookie", () => {
  beforeEach(() => {
    setConsentAccepted(false);
  });

  it("should return rejected cookie by default", () => {
    expect(generateConsentCookie()).toBe("SOCS=CAE=");
  });

  it("should return accepted cookie when consent is accepted", () => {
    setConsentAccepted(true);
    expect(generateConsentCookie()).toBe("SOCS=CAISAiAD");
  });
});

// ─── CPN / T-Parameter ──────────────────────────────────────────────────────

describe("generateContentPlaybackNonce", () => {
  it("should return a 16-character string", () => {
    const cpn = generateContentPlaybackNonce();
    expect(cpn).toHaveLength(16);
  });

  it("should only contain allowed characters", () => {
    const cpn = generateContentPlaybackNonce();
    expect(cpn).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it("should generate unique nonces", () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateContentPlaybackNonce()));
    expect(nonces.size).toBeGreaterThan(90);
  });
});

describe("generateTParameter", () => {
  it("should return a 12-character string", () => {
    const t = generateTParameter();
    expect(t).toHaveLength(12);
  });

  it("should only contain allowed characters", () => {
    const t = generateTParameter();
    expect(t).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });
});

// ─── Client Version ──────────────────────────────────────────────────────────

describe("getClientVersion", () => {
  beforeEach(() => {
    resetClientVersion();
  });

  it("should extract version from sw.js response", async () => {
    const downloader = createMockDownloader({
      get: async () => ({
        responseCode: 200,
        responseMessage: "OK",
        responseHeaders: {},
        responseBody: 'some code INNERTUBE_CONTEXT_CLIENT_VERSION":"2.20250101.01.00" more',
        latestUrl: "https://www.youtube.com/sw.js",
      }),
    });

    const version = await getClientVersion(downloader);
    expect(version).toBe("2.20250101.01.00");
  });

  it("should fallback to hardcoded version when extraction fails", async () => {
    const downloader = createMockDownloader({
      get: async () => ({
        responseCode: 200,
        responseMessage: "OK",
        responseHeaders: {},
        responseBody: "no version here",
        latestUrl: "https://www.youtube.com/sw.js",
      }),
    });

    const version = await getClientVersion(downloader);
    expect(version).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("should cache the version after first call", async () => {
    let callCount = 0;
    const downloader = createMockDownloader({
      get: async () => {
        callCount++;
        return {
          responseCode: 200,
          responseMessage: "OK",
          responseHeaders: {},
          responseBody: 'INNERTUBE_CONTEXT_CLIENT_VERSION":"2.20250501.00.00"',
          latestUrl: "",
        };
      },
    });

    await getClientVersion(downloader);
    await getClientVersion(downloader);
    expect(callCount).toBe(1);
  });
});

// ─── buildDesktopContext ─────────────────────────────────────────────────────

describe("buildDesktopContext", () => {
  beforeEach(() => {
    resetClientVersion();
  });

  it("should build a valid InnerTube context", async () => {
    const downloader = createMockDownloader({
      get: async () => ({
        responseCode: 200,
        responseMessage: "OK",
        responseHeaders: {},
        responseBody: 'INNERTUBE_CONTEXT_CLIENT_VERSION":"2.20250501.00.00"',
        latestUrl: "",
      }),
    });

    const ctx = await buildDesktopContext(downloader, "es", "ES");
    expect(ctx.client.clientName).toBe("WEB");
    expect(ctx.client.clientVersion).toBe("2.20250501.00.00");
    expect(ctx.client.hl).toBe("es");
    expect(ctx.client.gl).toBe("ES");
    expect(ctx.client.platform).toBe("DESKTOP");
    expect(ctx.request.useSsl).toBe(true);
    expect(ctx.user.lockedSafetyMode).toBe(false);
  });
});

// ─── Headers ─────────────────────────────────────────────────────────────────

describe("getYouTubeHeaders", () => {
  it("should include required headers", () => {
    const headers = getYouTubeHeaders("2.20250501.00.00");
    expect(headers["X-YouTube-Client-Name"]).toBe("1");
    expect(headers["X-YouTube-Client-Version"]).toBe("2.20250501.00.00");
    expect(headers["Origin"]).toBe("https://www.youtube.com");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

describe("getAndroidUserAgent", () => {
  it("should include country code", () => {
    const ua = getAndroidUserAgent("DE");
    expect(ua).toContain("DE");
    expect(ua).toContain("Android");
  });
});

describe("getIosUserAgent", () => {
  it("should include country code", () => {
    const ua = getIosUserAgent("JP");
    expect(ua).toContain("JP");
    expect(ua).toContain("iOS");
  });
});

// ─── getTextFromObject ──────────────────────────────────────────────────────

describe("getTextFromObject", () => {
  it("should extract simpleText", () => {
    expect(getTextFromObject({ simpleText: "hello" })).toBe("hello");
  });

  it("should extract text from runs array", () => {
    const obj = {
      runs: [
        { text: "Hello " },
        { text: "World" },
      ],
    };
    expect(getTextFromObject(obj)).toBe("Hello World");
  });

  it("should return null for null/undefined input", () => {
    expect(getTextFromObject(null)).toBeNull();
    expect(getTextFromObject(undefined)).toBeNull();
  });

  it("should return null for empty object", () => {
    expect(getTextFromObject({})).toBeNull();
  });

  it("should return null for empty runs array", () => {
    expect(getTextFromObject({ runs: [] })).toBeNull();
  });

  it("should prefer simpleText over runs", () => {
    const obj = {
      simpleText: "simple",
      runs: [{ text: "run" }],
    };
    expect(getTextFromObject(obj)).toBe("simple");
  });
});

// ─── getUrlFromNavigationEndpoint ────────────────────────────────────────────

describe("getUrlFromNavigationEndpoint", () => {
  it("should return null for null endpoint", () => {
    expect(getUrlFromNavigationEndpoint(null)).toBeNull();
  });

  it("should extract channel URL from browseEndpoint", () => {
    const endpoint = {
      browseEndpoint: {
        browseId: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe(
      "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxxxx"
    );
  });

  it("should extract playlist URL from browseEndpoint with VL prefix", () => {
    const endpoint = {
      browseEndpoint: {
        browseId: "VLPLxxxxxxxxxxxxxxxxxxxxxxxx",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe(
      "https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxxxx"
    );
  });

  it("should extract video URL from watchEndpoint", () => {
    const endpoint = {
      watchEndpoint: {
        videoId: "dQw4w9WgXcQ",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
  });

  it("should include playlist ID in watchEndpoint", () => {
    const endpoint = {
      watchEndpoint: {
        videoId: "dQw4w9WgXcQ",
        playlistId: "PLabc123",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123"
    );
  });

  it("should include start time in watchEndpoint", () => {
    const endpoint = {
      watchEndpoint: {
        videoId: "dQw4w9WgXcQ",
        startTimeSeconds: 120,
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toContain("&t=120");
  });

  it("should extract playlist URL from watchPlaylistEndpoint", () => {
    const endpoint = {
      watchPlaylistEndpoint: {
        playlistId: "PLabc123",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe(
      "https://www.youtube.com/playlist?list=PLabc123"
    );
  });

  it("should return external URL from urlEndpoint", () => {
    const endpoint = {
      urlEndpoint: {
        url: "https://example.com/page",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe("https://example.com/page");
  });

  it("should decode redirect URLs from urlEndpoint", () => {
    const endpoint = {
      urlEndpoint: {
        url: "/redirect?q=https%3A%2F%2Fexample.com",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe("https://example.com");
  });

  it("should handle canonicalBaseUrl in browseEndpoint", () => {
    const endpoint = {
      browseEndpoint: {
        browseId: "FEwhat_to_watch",
        canonicalBaseUrl: "/@username",
      },
    };
    expect(getUrlFromNavigationEndpoint(endpoint)).toBe(
      "https://www.youtube.com/@username"
    );
  });
});

// ─── getThumbnailsFromInfoItem ───────────────────────────────────────────────

describe("getThumbnailsFromInfoItem", () => {
  it("should extract thumbnails with correct URLs", () => {
    const item = {
      thumbnail: {
        thumbnails: [
          { url: "https://i.ytimg.com/vi/abc/default.jpg", width: 120, height: 90 },
          { url: "//i.ytimg.com/vi/abc/mqdefault.jpg", width: 320, height: 180 },
        ],
      },
    };

    const thumbs = getThumbnailsFromInfoItem(item);
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]!.url).toBe("https://i.ytimg.com/vi/abc/default.jpg");
    expect(thumbs[1]!.url).toBe("https://i.ytimg.com/vi/abc/mqdefault.jpg");
  });

  it("should fix protocol-relative URLs", () => {
    const item = {
      thumbnail: {
        thumbnails: [
          { url: "//i.ytimg.com/vi/abc/hqdefault.jpg", width: 480, height: 360 },
        ],
      },
    };

    const thumbs = getThumbnailsFromInfoItem(item);
    expect(thumbs[0]!.url).toMatch(/^https:\/\//);
  });

  it("should fix http URLs to https", () => {
    const item = {
      thumbnail: {
        thumbnails: [
          { url: "http://i.ytimg.com/vi/abc/hqdefault.jpg", width: 480, height: 360 },
        ],
      },
    };

    const thumbs = getThumbnailsFromInfoItem(item);
    expect(thumbs[0]!.url).toMatch(/^https:\/\//);
  });

  it("should return empty array for missing thumbnails", () => {
    expect(getThumbnailsFromInfoItem({})).toEqual([]);
    expect(getThumbnailsFromInfoItem({ thumbnail: {} })).toEqual([]);
  });
});

// ─── isVerified ──────────────────────────────────────────────────────────────

describe("isVerified", () => {
  it("should return false for undefined badges", () => {
    expect(isVerified(undefined)).toBe(false);
  });

  it("should return false for empty badges", () => {
    expect(isVerified([])).toBe(false);
  });

  it("should return true for verified badge", () => {
    const badges = [
      { metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_VERIFIED" } },
    ];
    expect(isVerified(badges)).toBe(true);
  });

  it("should return true for verified artist badge", () => {
    const badges = [
      { metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_VERIFIED_ARTIST" } },
    ];
    expect(isVerified(badges)).toBe(true);
  });

  it("should return false for non-verified badges", () => {
    const badges = [
      { metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_LIVE_NOW" } },
    ];
    expect(isVerified(badges)).toBe(false);
  });
});

// ─── parseDurationString ─────────────────────────────────────────────────────

describe("parseDurationString", () => {
  it("should parse mm:ss format", () => {
    expect(parseDurationString("5:03")).toBe(303);
  });

  it("should parse hh:mm:ss format", () => {
    expect(parseDurationString("1:02:30")).toBe(3750);
  });

  it("should parse single digit seconds", () => {
    expect(parseDurationString("0:05")).toBe(5);
  });

  it("should handle days:hh:mm:ss format", () => {
    expect(parseDurationString("1:00:00:00")).toBe(86400);
  });

  it("should return 0 for empty string", () => {
    expect(parseDurationString("")).toBe(0);
  });

  it("should return 0 for string without digits", () => {
    expect(parseDurationString("abc")).toBe(0);
  });

  it("should parse dot-separated format", () => {
    expect(parseDurationString("5.03")).toBe(303);
  });
});

// ─── getJsonValue ────────────────────────────────────────────────────────────

describe("getJsonValue", () => {
  const testObj = {
    a: {
      b: {
        c: "deep value",
      },
      list: [1, 2, 3],
    },
    simple: 42,
  };

  it("should traverse nested objects by dot path", () => {
    expect(getJsonValue(testObj, "a.b.c")).toBe("deep value");
  });

  it("should return top-level value", () => {
    expect(getJsonValue(testObj, "simple")).toBe(42);
  });

  it("should return undefined for missing path", () => {
    expect(getJsonValue(testObj, "a.x.y")).toBeUndefined();
  });

  it("should return undefined for null input", () => {
    expect(getJsonValue(null, "a.b")).toBeUndefined();
  });

  it("should return the nested object itself", () => {
    expect(getJsonValue(testObj, "a.b")).toEqual({ c: "deep value" });
  });
});
