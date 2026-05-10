import type { Downloader } from "../../../core/types.js";
import type {
  ChannelInfo,
  ChannelTab,
  ChannelTabInfo,
  StreamInfoItem,
  ImageInfo,
  Page,
} from "@newpipe/shared";
import { ServiceId, StreamType, ImageResolutionLevel } from "@newpipe/shared";
import {
  buildDesktopContext,
  postToInnerTube,
  getTextFromObject,
  getThumbnailsFromInfoItem,
  isVerified,
  parseDurationString,
  getUrlFromNavigationEndpoint,
} from "../YoutubeParsingHelper.js";

// ─── Channel ID extraction ──────────────────────────────────────────────────

function extractChannelIdentifier(url: string): { type: "id" | "handle" | "vanity"; value: string } {
  // Direct channel ID
  const channelIdMatch = /\/channel\/(UC[a-zA-Z0-9_-]{22})/.exec(url);
  if (channelIdMatch?.[1]) {
    return { type: "id", value: channelIdMatch[1] };
  }

  // Handle (@username)
  const handleMatch = /\/@([^/?]+)/.exec(url);
  if (handleMatch?.[1]) {
    return { type: "handle", value: `@${handleMatch[1]}` };
  }

  // Vanity URL (/c/name or /user/name)
  const vanityMatch = /\/(?:c|user)\/([^/?]+)/.exec(url);
  if (vanityMatch?.[1]) {
    return { type: "vanity", value: vanityMatch[1] };
  }

  // Try using the whole URL as-is
  return { type: "vanity", value: url };
}

// ─── Tab name mapping ────────────────────────────────────────────────────────

const TAB_PARAMS: Readonly<Record<string, string>> = {
  Videos: "EgZ2aWRlb3PyBgQKAjoA",
  Shorts: "EgZzaG9ydHPyBgUKA5oBAA%3D%3D",
  "Live streams": "EgdzdHJlYW1z8gYECgJ6AA%3D%3D",
  Playlists: "EglwbGF5bGlzdHPyBgQKAkIA",
};

// ─── Channel info extraction ─────────────────────────────────────────────────

/**
 * Fetches channel info via the InnerTube browse endpoint.
 */
export async function youtubeGetChannelInfo(
  downloader: Downloader,
  url: string,
  localization = "en",
  country = "US"
): Promise<ChannelInfo> {
  const context = await buildDesktopContext(downloader, localization, country);
  const identifier = extractChannelIdentifier(url);

  let browseId: string | undefined;

  if (identifier.type === "id") {
    browseId = identifier.value;
  } else {
    // Resolve handle/vanity to channel ID via browse
    const canonicalBaseUrl = identifier.type === "handle"
      ? `/${identifier.value}`
      : `/c/${identifier.value}`;

    const resolveResponse = await postToInnerTube(
      downloader,
      "navigation/resolve_url",
      {
        context,
        url: `https://www.youtube.com${canonicalBaseUrl}`,
      } as never
    );

    const endpoint = resolveResponse["endpoint"] as Record<string, unknown> | undefined;
    const browseEndpoint = endpoint?.["browseEndpoint"] as Record<string, unknown> | undefined;
    browseId = browseEndpoint?.["browseId"] as string | undefined;

    if (!browseId) {
      // Try direct browse with the identifier
      browseId = identifier.value;
    }
  }

  const body: Record<string, unknown> = {
    context,
    browseId,
  };

  const response = await postToInnerTube(downloader, "browse", body as never);

  return parseChannelResponse(response, url, browseId ?? "");
}

function parseChannelResponse(
  data: Record<string, unknown>,
  originalUrl: string,
  browseId: string
): ChannelInfo {
  const header = data["header"] as Record<string, unknown> | undefined;
  const metadata = data["metadata"] as Record<string, unknown> | undefined;

  // Try c4TabbedHeaderRenderer (standard channels)
  const c4Header = header?.["c4TabbedHeaderRenderer"] as Record<string, unknown> | undefined;
  // Try pageHeaderRenderer (newer format)
  const pageHeader = header?.["pageHeaderRenderer"] as Record<string, unknown> | undefined;

  const channelMetadata = metadata?.["channelMetadataRenderer"] as Record<string, unknown> | undefined;

  const name = (channelMetadata?.["title"] as string)
    ?? (c4Header ? getTextFromObject(c4Header["title"] as Record<string, unknown>) : null)
    ?? "";

  const channelUrl = (channelMetadata?.["channelUrl"] as string)
    ?? `https://www.youtube.com/channel/${browseId}`;

  // Description
  const description = (channelMetadata?.["description"] as string) ?? null;

  // Avatars
  let avatars: ImageInfo[] = [];
  if (c4Header) {
    avatars = toImageInfoList(getThumbnailsFromInfoItem(c4Header["avatar"] as Record<string, unknown> ?? {}));
  } else if (pageHeader) {
    const imageModel = (pageHeader["content"] as Record<string, unknown>)
      ?.["pageHeaderViewModel"] as Record<string, unknown> | undefined;
    const image = imageModel?.["image"] as Record<string, unknown> | undefined;
    const decoratedAvatar = image?.["decoratedAvatarViewModel"] as Record<string, unknown> | undefined;
    const avatarModel = decoratedAvatar?.["avatar"] as Record<string, unknown> | undefined;
    const avatarImage = avatarModel?.["avatarViewModel"] as Record<string, unknown> | undefined;
    const sources = (avatarImage?.["image"] as Record<string, unknown>)?.["sources"] as Array<Record<string, unknown>> | undefined;
    if (sources) {
      avatars = sources
        .filter((s) => typeof s["url"] === "string")
        .map((s) => ({
          url: s["url"] as string,
          width: (s["width"] as number) ?? 0,
          height: (s["height"] as number) ?? 0,
          estimatedResolutionLevel: ImageResolutionLevel.Unknown,
        }));
    }
  }

  // Banners
  let banners: ImageInfo[] = [];
  if (c4Header?.["banner"]) {
    banners = toImageInfoList(
      getThumbnailsFromInfoItem(c4Header["banner"] as Record<string, unknown>)
    );
  }

  // Subscriber count
  let subscriberCount: number | null = null;
  if (c4Header) {
    const subText = getTextFromObject(
      c4Header["subscriberCountText"] as Record<string, unknown>
    );
    if (subText) {
      subscriberCount = parseMixedNumber(subText);
    }
  }

  // Verified
  const badges = c4Header?.["badges"] as unknown[] | undefined;
  const verified = isVerified(badges);

  // Tags
  const keywords = (channelMetadata?.["keywords"] as string) ?? "";
  const tags = keywords ? keywords.split(" ").filter(Boolean) : [];

  // Feed URL
  const rssUrl = channelMetadata?.["rssUrl"] as string | undefined;
  const feedUrl = rssUrl ?? (browseId ? `https://www.youtube.com/feeds/videos.xml?channel_id=${browseId}` : null);

  // Tabs
  const tabs = extractAvailableTabs(data);

  return {
    serviceId: ServiceId.YouTube,
    url: channelUrl,
    originalUrl,
    name,
    avatars,
    banners,
    description,
    subscriberCount,
    feedUrl,
    verified,
    tabs,
    tags,
  };
}

function extractAvailableTabs(data: Record<string, unknown>): ChannelTab[] {
  const contents = data["contents"] as Record<string, unknown> | undefined;
  const twoColumn = contents?.["twoColumnBrowseResultsRenderer"] as Record<string, unknown> | undefined;
  const tabArray = twoColumn?.["tabs"] as Array<Record<string, unknown>> | undefined;

  if (!tabArray) {
    return [{ name: "Videos", contentFilters: ["videos"] }];
  }

  const tabs: ChannelTab[] = [];

  for (const tab of tabArray) {
    const renderer = tab["tabRenderer"] as Record<string, unknown> | undefined;
    if (!renderer) {
      continue;
    }

    const title = (renderer["title"] as string) ?? "";
    if (!title) {
      continue;
    }

    tabs.push({
      name: title,
      contentFilters: [title.toLowerCase()],
    });
  }

  return tabs.length > 0 ? tabs : [{ name: "Videos", contentFilters: ["videos"] }];
}

// ─── Channel tab info extraction ─────────────────────────────────────────────

/**
 * Fetches the content of a specific channel tab (Videos, Shorts, etc.).
 */
export async function youtubeGetChannelTabInfo(
  downloader: Downloader,
  url: string,
  tabName: string,
  localization = "en",
  country = "US"
): Promise<ChannelTabInfo> {
  const context = await buildDesktopContext(downloader, localization, country);
  const identifier = extractChannelIdentifier(url);

  let browseId: string;
  if (identifier.type === "id") {
    browseId = identifier.value;
  } else {
    // Resolve to channel ID
    const canonicalBaseUrl = identifier.type === "handle"
      ? `/${identifier.value}`
      : `/c/${identifier.value}`;

    const resolveResponse = await postToInnerTube(
      downloader,
      "navigation/resolve_url",
      {
        context,
        url: `https://www.youtube.com${canonicalBaseUrl}`,
      } as never
    );

    const endpoint = resolveResponse["endpoint"] as Record<string, unknown> | undefined;
    browseId = (endpoint?.["browseEndpoint"] as Record<string, unknown>)?.["browseId"] as string ?? identifier.value;
  }

  const params = TAB_PARAMS[tabName] ?? TAB_PARAMS["Videos"];

  const body: Record<string, unknown> = {
    context,
    browseId,
    params,
  };

  const response = await postToInnerTube(downloader, "browse", body as never);

  return parseChannelTabResponse(response, url, tabName);
}

/**
 * Fetches the next page of a channel tab.
 */
export async function youtubeGetChannelTabNextPage(
  downloader: Downloader,
  url: string,
  tabName: string,
  page: Page,
  localization = "en",
  country = "US"
): Promise<ChannelTabInfo> {
  const context = await buildDesktopContext(downloader, localization, country);

  const body: Record<string, unknown> = {
    context,
    continuation: page.id,
  };

  const response = await postToInnerTube(downloader, "browse", body as never);

  return parseContinuationTabResponse(response, url, tabName);
}

function parseChannelTabResponse(
  data: Record<string, unknown>,
  channelUrl: string,
  tabName: string
): ChannelTabInfo {
  const contents = data["contents"] as Record<string, unknown> | undefined;
  const twoColumn = contents?.["twoColumnBrowseResultsRenderer"] as Record<string, unknown> | undefined;
  const tabArray = twoColumn?.["tabs"] as Array<Record<string, unknown>> | undefined;

  if (!tabArray) {
    return {
      serviceId: ServiceId.YouTube,
      channelUrl,
      tabName,
      items: [],
      nextPage: null,
    };
  }

  // Find the selected tab
  let selectedTab: Record<string, unknown> | null = null;
  for (const tab of tabArray) {
    const renderer = tab["tabRenderer"] as Record<string, unknown> | undefined;
    if (renderer?.["selected"] === true) {
      selectedTab = renderer;
      break;
    }
  }

  if (!selectedTab) {
    // Use first tab with content
    for (const tab of tabArray) {
      const renderer = tab["tabRenderer"] as Record<string, unknown> | undefined;
      if (renderer?.["content"]) {
        selectedTab = renderer;
        break;
      }
    }
  }

  if (!selectedTab) {
    return {
      serviceId: ServiceId.YouTube,
      channelUrl,
      tabName,
      items: [],
      nextPage: null,
    };
  }

  const tabContent = selectedTab["content"] as Record<string, unknown> | undefined;
  const richGrid = tabContent?.["richGridRenderer"] as Record<string, unknown> | undefined;
  const sectionList = tabContent?.["sectionListRenderer"] as Record<string, unknown> | undefined;

  const items: StreamInfoItem[] = [];
  let nextPage: Page | null = null;

  if (richGrid) {
    const gridContents = richGrid["contents"] as Array<Record<string, unknown>> | undefined;
    if (gridContents) {
      for (const content of gridContents) {
        if (content["richItemRenderer"]) {
          const richItem = content["richItemRenderer"] as Record<string, unknown>;
          const innerContent = richItem["content"] as Record<string, unknown> | undefined;
          if (innerContent?.["videoRenderer"]) {
            const item = extractVideoItem(innerContent["videoRenderer"] as Record<string, unknown>);
            if (item) {
              items.push(item);
            }
          }
        } else if (content["continuationItemRenderer"]) {
          nextPage = extractContinuationToken(content["continuationItemRenderer"] as Record<string, unknown>);
        }
      }
    }
  } else if (sectionList) {
    const sections = sectionList["contents"] as Array<Record<string, unknown>> | undefined;
    if (sections) {
      for (const section of sections) {
        const itemSection = section["itemSectionRenderer"] as Record<string, unknown> | undefined;
        if (itemSection) {
          const sectionContents = itemSection["contents"] as Array<Record<string, unknown>> | undefined;
          if (sectionContents) {
            for (const item of sectionContents) {
              if (item["videoRenderer"]) {
                const extracted = extractVideoItem(item["videoRenderer"] as Record<string, unknown>);
                if (extracted) {
                  items.push(extracted);
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    channelUrl,
    tabName,
    items,
    nextPage,
  };
}

function parseContinuationTabResponse(
  data: Record<string, unknown>,
  channelUrl: string,
  tabName: string
): ChannelTabInfo {
  const commands = data["onResponseReceivedActions"] as Array<Record<string, unknown>> | undefined;
  const appendAction = commands?.[0]?.["appendContinuationItemsAction"] as Record<string, unknown> | undefined;
  const continuationItems = appendAction?.["continuationItems"] as Array<Record<string, unknown>> | undefined;

  if (!continuationItems) {
    return {
      serviceId: ServiceId.YouTube,
      channelUrl,
      tabName,
      items: [],
      nextPage: null,
    };
  }

  const items: StreamInfoItem[] = [];
  let nextPage: Page | null = null;

  for (const content of continuationItems) {
    if (content["richItemRenderer"]) {
      const richItem = content["richItemRenderer"] as Record<string, unknown>;
      const innerContent = richItem["content"] as Record<string, unknown> | undefined;
      if (innerContent?.["videoRenderer"]) {
        const item = extractVideoItem(innerContent["videoRenderer"] as Record<string, unknown>);
        if (item) {
          items.push(item);
        }
      }
    } else if (content["continuationItemRenderer"]) {
      nextPage = extractContinuationToken(content["continuationItemRenderer"] as Record<string, unknown>);
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    channelUrl,
    tabName,
    items,
    nextPage,
  };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

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
  const viewCount = viewCountText ? parseViewCountStr(viewCountText) : null;

  const publishedTimeText = getTextFromObject(renderer["publishedTimeText"] as Record<string, unknown>);

  const ownerText = renderer["ownerText"] as Record<string, unknown> | undefined;
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

function toImageInfoList(
  thumbs: Array<{ url: string; width: number; height: number }>
): ImageInfo[] {
  return thumbs.map((t) => ({
    url: t.url,
    width: t.width,
    height: t.height,
    estimatedResolutionLevel:
      t.height <= 0
        ? ImageResolutionLevel.Unknown
        : t.height < 200
          ? ImageResolutionLevel.Low
          : t.height < 500
            ? ImageResolutionLevel.Medium
            : ImageResolutionLevel.High,
  }));
}

function parseViewCountStr(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseMixedNumber(text: string): number | null {
  const cleaned = text.toLowerCase().trim();
  const multipliers: Readonly<Record<string, number>> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
  };

  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.includes(suffix)) {
      const numPart = cleaned.replace(/[^0-9.]/g, "");
      const value = parseFloat(numPart);
      if (!Number.isNaN(value)) {
        return Math.round(value * multiplier);
      }
    }
  }

  const plain = cleaned.replace(/[^0-9]/g, "");
  if (plain) {
    const value = parseInt(plain, 10);
    return Number.isNaN(value) ? null : value;
  }

  return null;
}
