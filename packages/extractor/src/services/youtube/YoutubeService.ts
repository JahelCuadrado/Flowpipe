
import { ServiceId } from "@newpipe/shared";
import type {
  SearchQueryFilter, Page, SearchResult, StreamInfo,
  ChannelInfo, ChannelTabInfo, PlaylistInfo, CommentInfo,
  KioskInfo, KioskType, StreamInfoItem,
} from "@newpipe/shared";
import type { StreamingService } from "../../core/StreamingService.js";
import type { Downloader, InfoItemsPage } from "../../core/types.js";
import type { InnerTubeClientType } from "./YoutubeParsingHelper.js";
import { youtubeSearch, youtubeSearchNextPage } from "./extractors/YoutubeSearchExtractor.js";
import { youtubeGetStreamInfo } from "./extractors/YoutubeStreamExtractor.js";
import { youtubeGetSearchSuggestions } from "./extractors/YoutubeSuggestionExtractor.js";
import {
  youtubeGetChannelInfo,
  youtubeGetChannelTabInfo,
  youtubeGetChannelTabNextPage,
} from "./extractors/YoutubeChannelExtractor.js";
import {
  youtubeGetPlaylistInfo,
  youtubeGetPlaylistNextPage,
} from "./extractors/YoutubePlaylistExtractor.js";
import {
  youtubeGetCommentsInfo,
  youtubeGetCommentsNextPage,
} from "./extractors/YoutubeCommentsExtractor.js";
import {
  youtubeGetKioskInfo,
  youtubeGetKioskNextPage,
} from "./extractors/YoutubeKioskExtractor.js";

/**
  * YouTube streaming service implementation.
  * Interacts with YouTube's InnerTube API to extract content.
  */
export class YoutubeService implements StreamingService {
  readonly serviceId = ServiceId.YouTube;
  readonly serviceName = "YouTube";
  readonly baseUrls = [
    "https://youtube.com",
    "https://www.youtube.com",
    "https://m.youtube.com",
    "https://music.youtube.com",
    "https://youtu.be",
  ] as const;

  private readonly downloader: Downloader;

  constructor(downloader: Downloader) {
    this.downloader = downloader;
  }

  matchesUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return this.baseUrls.some(
        (base) => parsed.hostname === new URL(base).hostname
      );
    } catch {
      return false;
    }
  }

  getSearchContentFilters(): readonly string[] {
    return ["Videos", "Channels", "Playlists", "Music songs", "Music albums"];
  }

  getSearchSortFilters(): readonly string[] {
    return ["Relevance", "Upload date", "View count", "Rating"];
  }

  async search(query: string, filters?: SearchQueryFilter, localization?: string, country?: string): Promise<SearchResult> {
    const contentFilter = filters?.contentFilters?.[0] ?? null;
    return youtubeSearch(this.downloader, query, contentFilter, localization, country);
  }

  async searchNextPage(query: string, filters: SearchQueryFilter, page: Page, localization?: string, country?: string): Promise<SearchResult> {
    const contentFilter = filters?.contentFilters?.[0] ?? null;
    return youtubeSearchNextPage(this.downloader, query, page, contentFilter, localization, country);
  }

  async getSearchSuggestions(query: string): Promise<readonly string[]> {
    return youtubeGetSearchSuggestions(this.downloader, query);
  }

  async getStreamInfo(url: string, localization?: string, country?: string): Promise<StreamInfo> {
    return youtubeGetStreamInfo(this.downloader, url, localization, country);
  }

  /**
   * Fetches stream info using a specific InnerTube client type.
   * Used by the resilience cascade to try alternative clients on block.
   */
  async getStreamInfoWithClient(
    url: string,
    clientType: InnerTubeClientType,
    localization?: string,
    country?: string
  ): Promise<StreamInfo> {
    return youtubeGetStreamInfo(this.downloader, url, localization, country, clientType);
  }

  async getChannelInfo(url: string, localization?: string, country?: string): Promise<ChannelInfo> {
    return youtubeGetChannelInfo(this.downloader, url, localization, country);
  }

  async getChannelTabInfo(url: string, tabName: string, localization?: string, country?: string): Promise<ChannelTabInfo> {
    return youtubeGetChannelTabInfo(this.downloader, url, tabName, localization, country);
  }

  async getChannelTabNextPage(url: string, tabName: string, page: Page, localization?: string, country?: string): Promise<ChannelTabInfo> {
    return youtubeGetChannelTabNextPage(this.downloader, url, tabName, page, localization, country);
  }

  async getPlaylistInfo(url: string, localization?: string, country?: string): Promise<PlaylistInfo> {
    return youtubeGetPlaylistInfo(this.downloader, url, localization, country);
  }

  async getPlaylistNextPage(url: string, page: Page, localization?: string, country?: string): Promise<InfoItemsPage<StreamInfoItem>> {
    return youtubeGetPlaylistNextPage(this.downloader, url, page, localization, country);
  }

  async getCommentsInfo(url: string, localization?: string, country?: string): Promise<CommentInfo> {
    return youtubeGetCommentsInfo(this.downloader, url, localization, country);
  }

  async getCommentsNextPage(url: string, page: Page, localization?: string, country?: string): Promise<CommentInfo> {
    return youtubeGetCommentsNextPage(this.downloader, url, page, localization, country);
  }

  getAvailableKiosks(): readonly KioskType[] {
    return ["Trending"];
  }

  async getKioskInfo(kioskType: KioskType, localization?: string, country?: string): Promise<KioskInfo> {
    return youtubeGetKioskInfo(this.downloader, kioskType, localization, country);
  }

  async getKioskNextPage(kioskType: KioskType, page: Page, localization?: string, country?: string): Promise<InfoItemsPage<StreamInfoItem>> {
    return youtubeGetKioskNextPage(this.downloader, kioskType, page, localization, country);
  }
}
