import type { ImageInfo } from "./ImageInfo.js";
import type { Page } from "./Page.js";
import type { StreamInfoItem } from "./StreamInfo.js";
import type { ServiceId } from "../enums/ServiceId.js";
import type { PlaylistType } from "./SearchResult.js";

// Re-export PlaylistInfoItem from SearchResult (canonical definition)
export type { PlaylistInfoItem } from "./SearchResult.js";

/**
  * Full playlist details.
  * Mirrors org.schabi.newpipe.extractor.playlist.PlaylistInfo.
  */
export interface PlaylistInfo {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly originalUrl: string;
  readonly name: string;
  readonly thumbnails: readonly ImageInfo[];
  readonly uploaderName: string;
  readonly uploaderUrl: string | null;
  readonly uploaderAvatars: readonly ImageInfo[];
  readonly banners: readonly ImageInfo[];
  readonly streamCount: number | null;
  readonly description: string | null;
  readonly playlistType: PlaylistType;
  readonly items: readonly StreamInfoItem[];
  readonly nextPage: Page | null;
}
