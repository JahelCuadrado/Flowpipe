import type { Page } from "./Page.js";
import type { StreamInfoItem } from "./StreamInfo.js";
import type { ServiceId } from "../enums/ServiceId.js";

/**
  * Kiosk (trending, popular, featured) content listing.
  * Mirrors org.schabi.newpipe.extractor.kiosk.KioskInfo.
  */
export interface KioskInfo {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly name: string;
  readonly kioskType: KioskType;
  readonly items: readonly StreamInfoItem[];
  readonly nextPage: Page | null;
}

export type KioskType =
  | "Trending"
  | "Top 50"
  | "New & hot"
  | "Featured"
  | "Radio"
  | "Recent"
  | "Live";
