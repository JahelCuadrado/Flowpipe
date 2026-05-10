import type { ServiceId } from "../enums/ServiceId.js";
import type { StreamInfo } from "../types/StreamInfo.js";
import type { SearchResult } from "../types/SearchResult.js";
import type { ChannelInfo, ChannelTabInfo } from "../types/ChannelInfo.js";
import type { PlaylistInfo } from "../types/PlaylistInfo.js";
import type { CommentInfo } from "../types/CommentInfo.js";
import type { KioskInfo, KioskType } from "../types/KioskInfo.js";
import type { Page } from "../types/Page.js";

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchRequest {
  readonly serviceId: ServiceId;
  readonly query: string;
  readonly contentFilters?: readonly string[];
  readonly sortFilter?: string;
  readonly page?: Page;
}

export interface SearchResponse {
  readonly result: SearchResult;
}

// ─── Stream ──────────────────────────────────────────────────────────────────

export interface StreamRequest {
  readonly serviceId: ServiceId;
  readonly url: string;
}

export interface StreamResponse {
  readonly info: StreamInfo;
}

// ─── Channel ─────────────────────────────────────────────────────────────────

export interface ChannelRequest {
  readonly serviceId: ServiceId;
  readonly url: string;
}

export interface ChannelResponse {
  readonly info: ChannelInfo;
}

export interface ChannelTabRequest {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly tabName: string;
  readonly page?: Page;
}

export interface ChannelTabResponse {
  readonly info: ChannelTabInfo;
}

// ─── Playlist ────────────────────────────────────────────────────────────────

export interface PlaylistRequest {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly page?: Page;
}

export interface PlaylistResponse {
  readonly info: PlaylistInfo;
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface CommentsRequest {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly page?: Page;
}

export interface CommentsResponse {
  readonly info: CommentInfo;
}

// ─── Kiosk ───────────────────────────────────────────────────────────────────

export interface KioskRequest {
  readonly serviceId: ServiceId;
  readonly kioskType: KioskType;
  readonly page?: Page;
}

export interface KioskResponse {
  readonly info: KioskInfo;
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export interface SuggestionsRequest {
  readonly serviceId: ServiceId;
  readonly query: string;
}

export interface SuggestionsResponse {
  readonly suggestions: readonly string[];
}
