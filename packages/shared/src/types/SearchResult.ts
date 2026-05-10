import type { ImageInfo } from "./ImageInfo.js";
import type { Page } from "./Page.js";
import type { StreamInfoItem } from "./StreamInfo.js";
import type { ServiceId } from "../enums/ServiceId.js";

/**
  * Result of a search query containing mixed content items.
  */
export interface SearchResult {
  readonly serviceId: ServiceId;
  readonly searchString: string;
  readonly items: readonly SearchResultItem[];
  readonly nextPage: Page | null;
  readonly searchSuggestion: string | null;
  readonly isCorrectedSearch: boolean;
  readonly contentFilters: readonly string[];
  readonly sortFilters: readonly string[];
}

export type SearchResultItem = StreamInfoItem | ChannelInfoItem | PlaylistInfoItem;

export interface ChannelInfoItem {
  readonly type: "channel";
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly name: string;
  readonly thumbnails: readonly ImageInfo[];
  readonly subscriberCount: number | null;
  readonly streamCount: number | null;
  readonly description: string | null;
  readonly verified: boolean;
}

export interface PlaylistInfoItem {
  readonly type: "playlist";
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly name: string;
  readonly thumbnails: readonly ImageInfo[];
  readonly uploaderName: string | null;
  readonly uploaderUrl: string | null;
  readonly uploaderVerified: boolean;
  readonly streamCount: number | null;
  readonly playlistType: PlaylistType;
}

export enum PlaylistType {
  Normal = "NORMAL",
  Mix = "MIX_STREAM",
  MixMusic = "MIX_MUSIC",
  MixGenre = "MIX_GENRE",
}

/**
  * Filters that can be applied to a search query.
  */
export interface SearchQueryFilter {
  readonly contentFilters: readonly string[];
  readonly sortFilter: string | null;
}
