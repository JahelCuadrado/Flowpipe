import { describe, it, expect } from "vitest";
import { YoutubeService } from "../YoutubeService.js";
import type { Downloader, DownloaderResponse } from "../../../core/types.js";
import { ServiceId } from "@newpipe/shared";

function createMockDownloader(): Downloader {
  const defaultResponse: DownloaderResponse = {
    responseCode: 200,
    responseMessage: "OK",
    responseHeaders: {},
    responseBody: "",
    latestUrl: "",
  };

  return {
    get: async (url: string) => ({ ...defaultResponse, latestUrl: url }),
    post: async (url: string) => ({ ...defaultResponse, latestUrl: url }),
    head: async (url: string) => ({ ...defaultResponse, latestUrl: url }),
  };
}

describe("YoutubeService", () => {
  const service = new YoutubeService(createMockDownloader());

  describe("metadata", () => {
    it("should have correct serviceId", () => {
      expect(service.serviceId).toBe(ServiceId.YouTube);
    });

    it("should have correct service name", () => {
      expect(service.serviceName).toBe("YouTube");
    });

    it("should expose base URLs", () => {
      expect(service.baseUrls).toContain("https://www.youtube.com");
      expect(service.baseUrls).toContain("https://youtu.be");
      expect(service.baseUrls).toContain("https://music.youtube.com");
    });
  });

  describe("matchesUrl", () => {
    it("should match youtube.com URLs", () => {
      expect(service.matchesUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    });

    it("should match youtu.be URLs", () => {
      expect(service.matchesUrl("https://youtu.be/abc123")).toBe(true);
    });

    it("should match music.youtube.com URLs", () => {
      expect(service.matchesUrl("https://music.youtube.com/watch?v=abc")).toBe(true);
    });

    it("should match m.youtube.com URLs", () => {
      expect(service.matchesUrl("https://m.youtube.com/watch?v=abc")).toBe(true);
    });

    it("should not match other domains", () => {
      expect(service.matchesUrl("https://vimeo.com/123")).toBe(false);
    });

    it("should not match invalid URLs", () => {
      expect(service.matchesUrl("not a url")).toBe(false);
    });
  });

  describe("search filters", () => {
    it("should return content filters", () => {
      const filters = service.getSearchContentFilters();
      expect(filters).toContain("Videos");
      expect(filters).toContain("Channels");
      expect(filters).toContain("Playlists");
    });

    it("should return sort filters", () => {
      const filters = service.getSearchSortFilters();
      expect(filters).toContain("Relevance");
      expect(filters).toContain("Upload date");
    });
  });

  describe("available kiosks", () => {
    it("should include Trending", () => {
      expect(service.getAvailableKiosks()).toContain("Trending");
    });
  });
});
