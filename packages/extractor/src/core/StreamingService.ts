import type { ServiceId } from "@newpipe/shared";
import type {
  StreamInfo,
  SearchResult,
  ChannelInfo,
  ChannelTabInfo,
  PlaylistInfo,
  CommentInfo,
  KioskInfo,
  KioskType,
  Page,
  SearchQueryFilter,
  StreamInfoItem,
} from "@newpipe/shared";
import type { InfoItemsPage } from "./types.js";

/**
  * Abstract definition of a streaming service.
  * Each supported platform (YouTube, SoundCloud, etc.) implements this interface.
  *
  * Mirrors org.schabi.newpipe.extractor.StreamingService.
  */
export interface StreamingService {
  /** Unique identifier for this service. */
  readonly serviceId: ServiceId;

  /** Human-readable name of the service. */
  readonly serviceName: string;

  /** Base URL(s) for matching incoming URLs to this service. */
  readonly baseUrls: readonly string[];

  /**
    * Determines if a given URL belongs to this service.
    */
  matchesUrl(url: string): boolean;

  // ─── Search ──────────────────────────────────────────────────────────

  /**
    * Returns available content filters for search (e.g., "Videos", "Channels").
    */
  getSearchContentFilters(): readonly string[];

  /**
    * Returns available sort filters for search (e.g., "Relevance", "Upload date").
    */
  getSearchSortFilters(): readonly string[];

  /**
    * Fetches search results for the given query.
    */
  search(query: string, filters?: SearchQueryFilter, localization?: string, country?: string): Promise<SearchResult>;

  /**
    * Fetches the next page of search results.
    */
  searchNextPage(query: string, filters: SearchQueryFilter, page: Page, localization?: string, country?: string): Promise<SearchResult>;

  /**
    * Returns search suggestions for autocompletion.
    */
  getSearchSuggestions(query: string): Promise<readonly string[]>;

  // ─── Stream ──────────────────────────────────────────────────────────

  /**
    * Fetches full details of a stream (video/audio).
    */
  getStreamInfo(url: string, localization?: string, country?: string): Promise<StreamInfo>;

  // ─── Channel ─────────────────────────────────────────────────────────

  /**
    * Fetches channel information.
    */
  getChannelInfo(url: string, localization?: string, country?: string): Promise<ChannelInfo>;

  /**
    * Fetches the content of a specific channel tab.
    */
  getChannelTabInfo(url: string, tabName: string, localization?: string, country?: string): Promise<ChannelTabInfo>;

  /**
    * Fetches the next page of a channel tab.
    */
  getChannelTabNextPage(url: string, tabName: string, page: Page, localization?: string, country?: string): Promise<ChannelTabInfo>;

  // ─── Playlist ────────────────────────────────────────────────────────

  /**
    * Fetches playlist details and items.
    */
  getPlaylistInfo(url: string, localization?: string, country?: string): Promise<PlaylistInfo>;

  /**
    * Fetches the next page of playlist items.
    */
  getPlaylistNextPage(url: string, page: Page, localization?: string, country?: string): Promise<InfoItemsPage<StreamInfoItem>>;

  // ─── Comments ────────────────────────────────────────────────────────

  /**
    * Fetches comments for a stream.
    */
  getCommentsInfo(url: string, localization?: string, country?: string): Promise<CommentInfo>;

  /**
    * Fetches the next page of comments.
    */
  getCommentsNextPage(url: string, page: Page, localization?: string, country?: string): Promise<CommentInfo>;

  // ─── Kiosk ───────────────────────────────────────────────────────────

  /**
    * Returns the available kiosk types for this service.
    */
  getAvailableKiosks(): readonly KioskType[];

  /**
    * Fetches kiosk (trending/popular) content.
    */
  getKioskInfo(kioskType: KioskType, localization?: string, country?: string): Promise<KioskInfo>;

  /**
    * Fetches the next page of kiosk content.
    */
  getKioskNextPage(kioskType: KioskType, page: Page, localization?: string, country?: string): Promise<InfoItemsPage<StreamInfoItem>>;
}
