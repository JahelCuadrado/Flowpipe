import type { Downloader } from "../../../core/types.js";
import type { KioskInfo, KioskType, StreamInfoItem, ImageInfo, Page } from "@newpipe/shared";
import { ServiceId, StreamType, ImageResolutionLevel } from "@newpipe/shared";
import type { InfoItemsPage } from "../../../core/types.js";
import {
  buildDesktopContext,
  postToInnerTube,
  getTextFromObject,
  getThumbnailsFromInfoItem,
  getUrlFromNavigationEndpoint,
  parseDurationString,
} from "../YoutubeParsingHelper.js";

// ─── Kiosk browse IDs ───────────────────────────────────────────────────────

const KIOSK_BROWSE_IDS: Readonly<Record<string, string>> = {
  Trending: "FEtrending",
  "Top 50": "FEtrending",
  "New & hot": "FEtrending",
};

const KIOSK_PARAMS: Readonly<Record<string, string | undefined>> = {
  Trending: "6gQJRkVleHBsb3Jl",
  "New & hot": "6gQJRkVleHBsb3Jl",
};

// ─── Kiosk info extraction ──────────────────────────────────────────────────

export async function youtubeGetKioskInfo(
  downloader: Downloader,
  kioskType: KioskType,
  localization = "en",
  country = "US"
): Promise<KioskInfo> {
  const context = await buildDesktopContext(downloader, localization, country);
  const browseId = KIOSK_BROWSE_IDS[kioskType] ?? "FEtrending";

  const body: Record<string, unknown> = {
    context,
    browseId,
  };

  const params = KIOSK_PARAMS[kioskType];
  if (params) {
    body["params"] = params;
  }

  const response = await postToInnerTube(downloader, "browse", body as never);

  return parseKioskResponse(response, kioskType);
}

export async function youtubeGetKioskNextPage(
  downloader: Downloader,
  _kioskType: KioskType,
  page: Page,
  localization = "en",
  country = "US"
): Promise<InfoItemsPage<StreamInfoItem>> {
  const context = await buildDesktopContext(downloader, localization, country);

  const body: Record<string, unknown> = {
    context,
    continuation: page.id,
  };

  const response = await postToInnerTube(downloader, "browse", body as never);

  return parseKioskContinuation(response);
}

// ─── Response parsers ───────────────────────────────────────────────────────

function parseKioskResponse(data: Record<string, unknown>, kioskType: KioskType): KioskInfo {
  const contents = data["contents"] as Record<string, unknown> | undefined;
  const twoColumn = contents?.["twoColumnBrowseResultsRenderer"] as Record<string, unknown> | undefined;
  const tabs = twoColumn?.["tabs"] as Array<Record<string, unknown>> | undefined;

  const items: StreamInfoItem[] = [];
  let nextPage: Page | null = null;

  if (tabs) {
    for (const tab of tabs) {
      const tabRenderer = tab["tabRenderer"] as Record<string, unknown> | undefined;
      if (!tabRenderer) {
        continue;
      }

      const tabContent = tabRenderer["content"] as Record<string, unknown> | undefined;
      const sectionList = tabContent?.["sectionListRenderer"] as Record<string, unknown> | undefined;
      const richGrid = tabContent?.["richGridRenderer"] as Record<string, unknown> | undefined;

      if (sectionList) {
        const sections = sectionList["contents"] as Array<Record<string, unknown>> | undefined;
        if (sections) {
          for (const section of sections) {
            const itemSection = section["itemSectionRenderer"] as Record<string, unknown> | undefined;
            if (!itemSection) {
              continue;
            }

            const sectionContents = itemSection["contents"] as Array<Record<string, unknown>> | undefined;
            if (!sectionContents) {
              continue;
            }

            for (const content of sectionContents) {
              // Shelf renderer (groups like "Music", "Gaming")
              if (content["shelfRenderer"]) {
                const shelf = content["shelfRenderer"] as Record<string, unknown>;
                const shelfContent = shelf["content"] as Record<string, unknown> | undefined;
                const expandedShelf = shelfContent?.["expandedShelfContentsRenderer"] as Record<string, unknown> | undefined;
                const shelfItems = expandedShelf?.["items"] as Array<Record<string, unknown>> | undefined;

                if (shelfItems) {
                  for (const shelfItem of shelfItems) {
                    if (shelfItem["videoRenderer"]) {
                      const video = extractVideoItem(shelfItem["videoRenderer"] as Record<string, unknown>);
                      if (video) {
                        items.push(video);
                      }
                    }
                  }
                }
              }

              // Direct video renderer
              if (content["videoRenderer"]) {
                const video = extractVideoItem(content["videoRenderer"] as Record<string, unknown>);
                if (video) {
                  items.push(video);
                }
              }
            }
          }
        }
      } else if (richGrid) {
        const gridContents = richGrid["contents"] as Array<Record<string, unknown>> | undefined;
        if (gridContents) {
          for (const content of gridContents) {
            if (content["richItemRenderer"]) {
              const richItem = content["richItemRenderer"] as Record<string, unknown>;
              const innerContent = richItem["content"] as Record<string, unknown> | undefined;
              if (innerContent?.["videoRenderer"]) {
                const video = extractVideoItem(innerContent["videoRenderer"] as Record<string, unknown>);
                if (video) {
                  items.push(video);
                }
              }
            } else if (content["continuationItemRenderer"]) {
              nextPage = extractContinuationToken(content["continuationItemRenderer"] as Record<string, unknown>);
            }
          }
        }
      }
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    url: "https://www.youtube.com/feed/trending",
    name: kioskType,
    kioskType,
    items,
    nextPage,
  };
}

function parseKioskContinuation(data: Record<string, unknown>): InfoItemsPage<StreamInfoItem> {
  const commands = data["onResponseReceivedActions"] as Array<Record<string, unknown>> | undefined;
  const appendAction = commands?.[0]?.["appendContinuationItemsAction"] as Record<string, unknown> | undefined;
  const continuationItems = appendAction?.["continuationItems"] as Array<Record<string, unknown>> | undefined;

  if (!continuationItems) {
    return { items: [], nextPage: null };
  }

  const items: StreamInfoItem[] = [];
  let nextPage: Page | null = null;

  for (const content of continuationItems) {
    if (content["richItemRenderer"]) {
      const richItem = content["richItemRenderer"] as Record<string, unknown>;
      const innerContent = richItem["content"] as Record<string, unknown> | undefined;
      if (innerContent?.["videoRenderer"]) {
        const video = extractVideoItem(innerContent["videoRenderer"] as Record<string, unknown>);
        if (video) {
          items.push(video);
        }
      }
    } else if (content["continuationItemRenderer"]) {
      nextPage = extractContinuationToken(content["continuationItemRenderer"] as Record<string, unknown>);
    }
  }

  return { items, nextPage };
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function extractVideoItem(renderer: Record<string, unknown>): StreamInfoItem | null {
  const videoId = renderer["videoId"] as string | undefined;
  if (!videoId) {
    return null;
  }

  const title = getTextFromObject(renderer["title"] as Record<string, unknown>) ?? "";
  const lengthText = getTextFromObject(renderer["lengthText"] as Record<string, unknown>);
  const duration = lengthText ? parseDurationString(lengthText) : -1;

  const thumbnails = toImageInfoList(getThumbnailsFromInfoItem(renderer));

  const viewCountText = getTextFromObject(renderer["viewCountText"] as Record<string, unknown>);
  const viewCount = viewCountText ? parseViewCount(viewCountText) : null;

  const publishedTimeText = getTextFromObject(renderer["publishedTimeText"] as Record<string, unknown>);

  const ownerText = renderer["ownerText"] as Record<string, unknown>
    ?? renderer["shortBylineText"] as Record<string, unknown> | undefined;
  const uploaderName = getTextFromObject(ownerText) ?? "";
  const runs = ownerText?.["runs"] as Array<Record<string, unknown>> | undefined;
  const uploaderUrl = runs?.[0]
    ? getUrlFromNavigationEndpoint(runs[0]["navigationEndpoint"] as Record<string, unknown>)
    : null;

  const badges = renderer["badges"] as Array<Record<string, unknown>> | undefined;
  const isLive = badges?.some((b) => {
    const style = (b["metadataBadgeRenderer"] as Record<string, unknown>)?.["style"];
    return style === "BADGE_STYLE_TYPE_LIVE_NOW";
  }) ?? false;

  return {
    serviceId: ServiceId.YouTube,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    name: title,
    streamType: isLive ? StreamType.LiveStream : StreamType.VideoStream,
    thumbnails,
    uploaderName,
    uploaderUrl,
    uploaderAvatars: [],
    uploaderVerified: false,
    duration: isLive ? -1 : duration,
    viewCount,
    textualUploadDate: publishedTimeText ?? null,
    uploadDate: null,
    shortDescription: null,
  };
}

function extractContinuationToken(renderer: Record<string, unknown>): Page | null {
  const continuationEndpoint = renderer["continuationEndpoint"] as Record<string, unknown> | undefined;
  const command = continuationEndpoint?.["continuationCommand"] as Record<string, unknown> | undefined;
  const token = command?.["token"] as string | undefined;
  if (!token) {
    return null;
  }
  return { url: "", id: token };
}

function parseViewCount(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toImageInfoList(thumbs: Array<{ url: string; width: number; height: number }>): ImageInfo[] {
  return thumbs.map((t) => ({
    url: t.url,
    width: t.width,
    height: t.height,
    estimatedResolutionLevel:
      t.height <= 0 ? ImageResolutionLevel.Unknown
        : t.height < 200 ? ImageResolutionLevel.Low
          : t.height < 500 ? ImageResolutionLevel.Medium
            : ImageResolutionLevel.High,
  }));
}
