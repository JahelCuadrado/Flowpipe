import type { ImageInfo } from "./ImageInfo.js";
import type { Page } from "./Page.js";
import type { StreamInfoItem } from "./StreamInfo.js";
import type { ServiceId } from "../enums/ServiceId.js";

/**
  * Full channel details.
  * Mirrors org.schabi.newpipe.extractor.channel.ChannelInfo.
  */
export interface ChannelInfo {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly originalUrl: string;
  readonly name: string;
  readonly avatars: readonly ImageInfo[];
  readonly banners: readonly ImageInfo[];
  readonly description: string | null;
  readonly subscriberCount: number | null;
  readonly feedUrl: string | null;
  readonly verified: boolean;
  readonly tabs: readonly ChannelTab[];
  readonly tags: readonly string[];
}

export interface ChannelTab {
  readonly name: string;
  readonly contentFilters: readonly string[];
}

/**
  * Contents of a channel tab (videos, playlists, shorts, etc.).
  */
export interface ChannelTabInfo {
  readonly serviceId: ServiceId;
  readonly channelUrl: string;
  readonly tabName: string;
  readonly items: readonly StreamInfoItem[];
  readonly nextPage: Page | null;
}
