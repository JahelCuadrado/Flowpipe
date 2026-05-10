import { describe, it, expect, beforeEach } from "vitest";
import {
  deobfuscateSignature,
  deobfuscateStreamUrl,
  getPlayerSignatureTimestamp,
  clearAllCaches,
} from "../YoutubePlayerManager.js";
import type { Downloader, DownloaderResponse } from "../../../core/types.js";

// ─── Mock downloader that returns synthetic player code ──────────────────────

const MOCK_PLAYER_CODE = [
  // Signature timestamp
  "signatureTimestamp:20256,",
  // Helper object for signature deobfuscation
  'var Hz={XX:function(a,b){var c=a[0];a[0]=a[b%a.length];a[b%a.length]=c},',
  "YY:function(a){a.reverse()},",
  "ZZ:function(a,b){a.splice(0,b)}};",
  // Signature deobfuscation function (uses bracket notation for helper matching)
  'SigFunc=function(a){a=a.split("");Hz["ZZ"](a,2);Hz["YY"](a);Hz["ZZ"](a,1);return a.join("")};',
  // Pattern matching: c&&(c=SigFunc(decodeURIComponent(c)))
  "c&&(c=SigFunc(decodeURIComponent(c)))",
  // Throttling function
  'myThrottle=function(a){if(typeof ddd==="undefined") return a;return a+"_done"};',
  // Throttle array pattern
  "var SDa=[myThrottle];",
  'something.get("n"))&&(b=SDa[0](b)',
].join("\n");

function createPlayerMockDownloader(): Downloader {
  const defaultResponse: DownloaderResponse = {
    responseCode: 200,
    responseMessage: "OK",
    responseHeaders: {},
    responseBody: "",
    latestUrl: "",
  };

  return {
    get: async (url: string) => {
      if (url.includes("iframe_api")) {
        return {
          ...defaultResponse,
          responseBody: 'var defined = "player\\/abcd1234\\/";',
          latestUrl: url,
        };
      }
      if (url.includes("base.js") || url.includes("player")) {
        return {
          ...defaultResponse,
          responseBody: MOCK_PLAYER_CODE,
          latestUrl: url,
        };
      }
      return { ...defaultResponse, latestUrl: url };
    },
    post: async (url: string) => ({ ...defaultResponse, latestUrl: url }),
    head: async (url: string) => ({ ...defaultResponse, latestUrl: url }),
  };
}

describe("YoutubePlayerManager", () => {
  beforeEach(() => {
    clearAllCaches();
  });

  describe("getPlayerSignatureTimestamp", () => {
    it("should extract signature timestamp from player code", async () => {
      const downloader = createPlayerMockDownloader();
      const sts = await getPlayerSignatureTimestamp(downloader, "dQw4w9WgXcQ");
      expect(sts).toBe(20256);
    });

    it("should cache the timestamp", async () => {
      let fetchCount = 0;
      const downloader: Downloader = {
        get: async (url: string) => {
          fetchCount++;
          if (url.includes("iframe_api")) {
            return {
              responseCode: 200,
              responseMessage: "OK",
              responseHeaders: {},
              responseBody: 'var a="player\\/abcd1234\\/";',
              latestUrl: url,
            };
          }
          return {
            responseCode: 200,
            responseMessage: "OK",
            responseHeaders: {},
            responseBody: MOCK_PLAYER_CODE,
            latestUrl: url,
          };
        },
        post: async () => ({ responseCode: 200, responseMessage: "OK", responseHeaders: {}, responseBody: "", latestUrl: "" }),
        head: async () => ({ responseCode: 200, responseMessage: "OK", responseHeaders: {}, responseBody: "", latestUrl: "" }),
      };

      await getPlayerSignatureTimestamp(downloader);
      await getPlayerSignatureTimestamp(downloader);
      // Only 2 GETs: iframe_api + base.js, not repeated
      expect(fetchCount).toBe(2);
    });
  });

  describe("deobfuscateSignature", () => {
    it("should deobfuscate a signature using player code", async () => {
      const downloader = createPlayerMockDownloader();
      // SigFunc: split(""), splice(0,2), reverse(), splice(0,1), join("")
      // Input: "abcdef" → split → ['a','b','c','d','e','f']
      // splice(0,2) → ['c','d','e','f']
      // reverse → ['f','e','d','c']
      // splice(0,1) → ['e','d','c']
      // join → "edc"
      const result = await deobfuscateSignature(downloader, "test", "abcdef");
      expect(result).toBe("edc");
    });
  });

  describe("deobfuscateStreamUrl", () => {
    it("should return original URL if no n parameter exists", async () => {
      const downloader = createPlayerMockDownloader();
      const url = "https://rr1.googlevideo.com/videoplayback?itag=140";
      const result = await deobfuscateStreamUrl(downloader, "test", url);
      expect(result).toBe(url);
    });
  });

  describe("clearAllCaches", () => {
    it("should clear all cached data", async () => {
      const downloader = createPlayerMockDownloader();
      await getPlayerSignatureTimestamp(downloader);

      clearAllCaches();

      // After clearing, it should fetch again (we can verify it works without error)
      const sts = await getPlayerSignatureTimestamp(downloader);
      expect(sts).toBe(20256);
    });
  });
});
