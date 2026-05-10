import type { Downloader } from "../../../core/types.js";
import type {
  StreamInfoItem,
  SearchResult,
  SearchResultItem,
  ChannelInfoItem,
  PlaylistInfoItem,
  ImageInfo,
  Page,
} from "@newpipe/shared";
import { ServiceId, StreamType, PlaylistType } from "@newpipe/shared";
import { ImageResolutionLevel } from "@newpipe/shared";
import {
  buildDesktopContext,
  postToInnerTube,
  getTextFromObject,
  getThumbnailsFromInfoItem,
  getUrlFromNavigationEndpoint,
  isVerified,
  parseDurationString,
  YOUTUBEI_V1_URL,
  DISABLE_PRETTY_PRINT,
} from "../YoutubeParsingHelper.js";

// ─── Search parameter encoding ──────────────────────────────────────────────

const SEARCH_PARAMS: Readonly<Record<string, string>> = {
  Videos: "EgIQAQ%3D%3D",
  Channels: "EgIQAg%3D%3D",
  Playlists: "EgIQAw%3D%3D",
  "Music songs": "EgWKAQIIAQ%3D%3D",
  "Music albums": "EgWKAQIYAQ%3D%3D",
};

function getSearchParameter(filter: string | null): string | null {
  if (!filter) {
    return null;
  }
  return SEARCH_PARAMS[filter] ?? null;
}

// ─── Item extractors ─────────────────────────────────────────────────────────

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

function extractStreamInfoItem(
  renderer: Record<string, unknown>
): StreamInfoItem | null {
  const videoId = renderer["videoId"] as string | undefined;
  if (!videoId) {
    return null;
  }

  const title = getTextFromObject(renderer["title"] as Record<string, unknown>) ?? "";

  // Duration
  const lengthText = getTextFromObject(
    renderer["lengthText"] as Record<string, unknown>
  );
  const duration = lengthText ? parseDurationString(lengthText) : -1;

  // Uploader
  const ownerText = renderer["ownerText"] as Record<string, unknown> | undefined;
  const uploaderName = getTextFromObject(ownerText) ?? "";
  const runs = ownerText?.["runs"] as Array<Record<string, unknown>> | undefined;
  const uploaderUrl = runs?.[0]
    ? getUrlFromNavigationEndpoint(
        runs[0]["navigationEndpoint"] as Record<string, unknown>
      )
    : null;

  // Thumbnails
  const thumbnails = toImageInfoList(getThumbnailsFromInfoItem(renderer));

  // Uploader avatars
  const channelThumbnailObj = renderer["channelThumbnailSupportedRenderers"] as Record<string, unknown> | undefined;
  const channelThumbRenderer = channelThumbnailObj?.["channelThumbnailWithLinkRenderer"] as Record<string, unknown> | undefined;
  const uploaderAvatars = channelThumbRenderer
    ? toImageInfoList(getThumbnailsFromInfoItem(channelThumbRenderer))
    : [];

  // View count
  const viewCountText = getTextFromObject(
    renderer["viewCountText"] as Record<string, unknown>
  );
  const viewCount = viewCountText ? parseViewCount(viewCountText) : null;

  // Upload date
  const publishedTimeText = getTextFromObject(
    renderer["publishedTimeText"] as Record<string, unknown>
  );

  // Short description
  const snippetText = getTextFromObject(
    renderer["detailedMetadataSnippets"]
      ? ((renderer["detailedMetadataSnippets"] as Array<Record<string, unknown>>)?.[0]?.["snippetText"] as Record<string, unknown>)
      : (renderer["descriptionSnippet"] as Record<string, unknown>)
  );

  // Badges (verified)
  const ownerBadges = renderer["ownerBadges"] as unknown[] | undefined;

  // Stream type
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
    uploaderAvatars,
    uploaderVerified: isVerified(ownerBadges),
    duration: isLive ? -1 : duration,
    viewCount,
    textualUploadDate: publishedTimeText ?? null,
    uploadDate: null,
    shortDescription: snippetText ?? null,
  };
}

/**
 * Extracts a stream info item from the newer lockupViewModel format.
 */
function extractStreamInfoItemFromLockup(
  lockup: Record<string, unknown>
): StreamInfoItem | null {
  const contentId = lockup["contentId"] as string | undefined;
  if (!contentId) {
    return null;
  }

  const metadata = lockup["metadata"] as Record<string, unknown> | undefined;
  const lockupMetadata = metadata?.["lockupMetadataViewModel"] as Record<string, unknown> | undefined;
  const title = getTextFromObject(lockupMetadata?.["title"] as Record<string, unknown>) ?? "";

  const contentImage = lockup["contentImage"] as Record<string, unknown> | undefined;
  const collectionThumbnail = contentImage?.["collectionThumbnailViewModel"] as Record<string, unknown> | undefined;
  const primaryThumb = collectionThumbnail?.["primaryThumbnail"] as Record<string, unknown> | undefined;
  const thumbnailViewModel = primaryThumb?.["thumbnailViewModel"] as Record<string, unknown> | undefined;

  const thumbnails: ImageInfo[] = [];
  if (thumbnailViewModel) {
    const image = thumbnailViewModel["image"] as Record<string, unknown> | undefined;
    const sources = image?.["sources"] as Array<Record<string, unknown>> | undefined;
    if (sources) {
      for (const source of sources) {
        const url = source["url"] as string | undefined;
        if (url) {
          thumbnails.push({
            url,
            width: (source["width"] as number) ?? 0,
            height: (source["height"] as number) ?? 0,
            estimatedResolutionLevel: ImageResolutionLevel.Unknown,
          });
        }
      }
    }
  }

  // Extract duration from overlay
  let duration = -1;
  const overlays = thumbnailViewModel?.["overlays"] as Array<Record<string, unknown>> | undefined;
  if (overlays) {
    for (const overlay of overlays) {
      const thumbnailOverlay = overlay?.["thumbnailOverlayBadgeViewModel"] as Record<string, unknown> | undefined;
      const overlayBadges = thumbnailOverlay?.["thumbnailBadges"] as Array<Record<string, unknown>> | undefined;
      if (overlayBadges) {
        for (const badge of overlayBadges) {
          const badgeText = (badge?.["thumbnailBadgeViewModel"] as Record<string, unknown>)?.["text"] as string | undefined;
          if (badgeText) {
            duration = parseDurationString(badgeText);
          }
        }
      }
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    url: `https://www.youtube.com/watch?v=${contentId}`,
    name: title,
    streamType: StreamType.VideoStream,
    thumbnails,
    uploaderName: "",
    uploaderUrl: null,
    uploaderAvatars: [],
    uploaderVerified: false,
    duration,
    viewCount: null,
    textualUploadDate: null,
    uploadDate: null,
    shortDescription: null,
  };
}

function parseViewCount(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// ─── Channel item extractor ─────────────────────────────────────────────────

function extractChannelInfoItem(
  renderer: Record<string, unknown>
): ChannelInfoItem | null {
  const channelId = renderer["channelId"] as string | undefined;
  if (!channelId) {
    return null;
  }

  const title = getTextFromObject(renderer["title"] as Record<string, unknown>) ?? "";
  const thumbnails = toImageInfoList(getThumbnailsFromInfoItem(renderer));
  const description = getTextFromObject(
    renderer["descriptionSnippet"] as Record<string, unknown>
  );

  // Subscriber count
  const subscriberText = getTextFromObject(
    renderer["videoCountText"] as Record<string, unknown>
  );
  const subscriberCount = subscriberText ? parseViewCount(subscriberText) : null;

  // Stream/video count
  const videoCountText = getTextFromObject(
    renderer["videoCountText"] as Record<string, unknown>
  );
  const streamCount = videoCountText ? parseViewCount(videoCountText) : null;

  // Verified badge
  const ownerBadges = renderer["ownerBadges"] as unknown[] | undefined;

  return {
    type: "channel",
    serviceId: ServiceId.YouTube,
    url: `https://www.youtube.com/channel/${channelId}`,
    name: title,
    thumbnails,
    subscriberCount,
    streamCount,
    description: description ?? null,
    verified: isVerified(ownerBadges),
  };
}

// ─── Playlist item extractor ─────────────────────────────────────────────────

function extractPlaylistInfoItem(
  renderer: Record<string, unknown>
): PlaylistInfoItem | null {
  const playlistId = renderer["playlistId"] as string | undefined;
  if (!playlistId) {
    return null;
  }

  const title = getTextFromObject(renderer["title"] as Record<string, unknown>) ?? "";
  const thumbnails = toImageInfoList(getThumbnailsFromInfoItem(renderer));

  // Uploader
  const ownerText = renderer["longBylineText"] as Record<string, unknown> | undefined;
  const uploaderName = getTextFromObject(ownerText) ?? null;
  const runs = ownerText?.["runs"] as Array<Record<string, unknown>> | undefined;
  const uploaderUrl = runs?.[0]
    ? getUrlFromNavigationEndpoint(
        runs[0]["navigationEndpoint"] as Record<string, unknown>
      )
    : null;

  // Video count
  const videoCountText = getTextFromObject(
    renderer["videoCountText"] as Record<string, unknown>
  );
  const streamCount = videoCountText ? parseViewCount(videoCountText) : null;

  const ownerBadges = renderer["ownerBadges"] as unknown[] | undefined;

  return {
    type: "playlist",
    serviceId: ServiceId.YouTube,
    url: `https://www.youtube.com/playlist?list=${playlistId}`,
    name: title,
    thumbnails,
    uploaderName,
    uploaderUrl,
    uploaderVerified: isVerified(ownerBadges),
    streamCount,
    playlistType: PlaylistType.Normal,
  };
}

// ─── Main search function ────────────────────────────────────────────────────

/**
 * Performs a YouTube search via the InnerTube API.
 * Mirrors YoutubeSearchExtractor.java.
 */
export async function youtubeSearch(
  downloader: Downloader,
  query: string,
  contentFilter: string | null = null,
  localization = "en",
  country = "US"
): Promise<SearchResult> {
  const context = await buildDesktopContext(downloader, localization, country);

  const body: Record<string, unknown> = { context, query };
  const params = getSearchParameter(contentFilter);
  if (params) {
    body["params"] = params;
  }

  const responseData = await postToInnerTube(
    downloader,
    "search",
    body as never
  );

  return parseSearchResponse(responseData, query, contentFilter);
}

/**
 * Fetches the next page of search results.
 */
export async function youtubeSearchNextPage(
  downloader: Downloader,
  query: string,
  page: Page,
  contentFilter: string | null = null,
  localization = "en",
  country = "US"
): Promise<SearchResult> {
  const context = await buildDesktopContext(downloader, localization, country);

  const body: Record<string, unknown> = {
    context,
    continuation: page.id,
  };

  const responseData = await postToInnerTube(
    downloader,
    "search",
    body as never
  );

  return parseContinuationSearchResponse(responseData, query, contentFilter);
}

// ─── Response parsers ────────────────────────────────────────────────────────

function parseSearchResponse(
  data: Record<string, unknown>,
  query: string,
  contentFilter: string | null
): SearchResult {
  const contents = data["contents"] as Record<string, unknown> | undefined;
  const twoColumn = contents?.["twoColumnSearchResultsRenderer"] as Record<string, unknown> | undefined;
  const primaryContents = twoColumn?.["primaryContents"] as Record<string, unknown> | undefined;
  const sectionList = primaryContents?.["sectionListRenderer"] as Record<string, unknown> | undefined;
  const sections = sectionList?.["contents"] as Array<Record<string, unknown>> | undefined;

  if (!sections) {
    return emptySearchResult(query, contentFilter);
  }

  const items: SearchResultItem[] = [];
  let nextPage: Page | null = null;

  // Extract search suggestion
  let searchSuggestion: string | null = null;
  let isCorrectedSearch = false;

  for (const section of sections) {
    if (section["itemSectionRenderer"]) {
      const itemSection = section["itemSectionRenderer"] as Record<string, unknown>;
      const sectionContents = itemSection["contents"] as Array<Record<string, unknown>> | undefined;

      if (sectionContents) {
        // Check for "did you mean" / "showing results for"
        const firstItem = sectionContents[0];
        if (firstItem?.["didYouMeanRenderer"]) {
          const didYouMean = firstItem["didYouMeanRenderer"] as Record<string, unknown>;
          const correctedQuery = didYouMean["correctedQueryEndpoint"] as Record<string, unknown> | undefined;
          const searchEndpoint = correctedQuery?.["searchEndpoint"] as Record<string, unknown> | undefined;
          searchSuggestion = (searchEndpoint?.["query"] as string) ?? null;
        } else if (firstItem?.["showingResultsForRenderer"]) {
          const showing = firstItem["showingResultsForRenderer"] as Record<string, unknown>;
          searchSuggestion = getTextFromObject(showing["correctedQuery"] as Record<string, unknown>);
          isCorrectedSearch = true;
        }

        collectItemsFromContents(sectionContents, items, contentFilter);
      }
    } else if (section["continuationItemRenderer"]) {
      nextPage = extractNextPage(section["continuationItemRenderer"] as Record<string, unknown>);
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    searchString: query,
    items,
    nextPage,
    searchSuggestion,
    isCorrectedSearch,
    contentFilters: contentFilter ? [contentFilter] : [],
    sortFilters: [],
  };
}

function parseContinuationSearchResponse(
  data: Record<string, unknown>,
  query: string,
  contentFilter: string | null
): SearchResult {
  const commands = data["onResponseReceivedCommands"] as Array<Record<string, unknown>> | undefined;
  const appendAction = commands?.[0]?.["appendContinuationItemsAction"] as Record<string, unknown> | undefined;
  const continuationItems = appendAction?.["continuationItems"] as Array<Record<string, unknown>> | undefined;

  if (!continuationItems || continuationItems.length === 0) {
    return emptySearchResult(query, contentFilter);
  }

  const items: SearchResultItem[] = [];

  // First item contains the section with results
  const itemSection = continuationItems[0]?.["itemSectionRenderer"] as Record<string, unknown> | undefined;
  const sectionContents = itemSection?.["contents"] as Array<Record<string, unknown>> | undefined;

  if (sectionContents) {
    collectItemsFromContents(sectionContents, items, contentFilter);
  }

  // Last item may contain continuation token
  const lastItem = continuationItems[continuationItems.length - 1];
  const nextPage = lastItem?.["continuationItemRenderer"]
    ? extractNextPage(lastItem["continuationItemRenderer"] as Record<string, unknown>)
    : null;

  return {
    serviceId: ServiceId.YouTube,
    searchString: query,
    items,
    nextPage,
    searchSuggestion: null,
    isCorrectedSearch: false,
    contentFilters: contentFilter ? [contentFilter] : [],
    sortFilters: [],
  };
}

function collectItemsFromContents(
  contents: Array<Record<string, unknown>>,
  items: SearchResultItem[],
  _contentFilter: string | null
): void {
  for (const item of contents) {
    // Standard videoRenderer
    if (item["videoRenderer"]) {
      const extracted = extractStreamInfoItem(item["videoRenderer"] as Record<string, unknown>);
      if (extracted) {
        items.push(extracted);
      }
    }

    // channelRenderer
    if (item["channelRenderer"]) {
      const extracted = extractChannelInfoItem(item["channelRenderer"] as Record<string, unknown>);
      if (extracted) {
        items.push(extracted);
      }
    }

    // playlistRenderer
    if (item["playlistRenderer"]) {
      const extracted = extractPlaylistInfoItem(item["playlistRenderer"] as Record<string, unknown>);
      if (extracted) {
        items.push(extracted);
      }
    }

    // lockupViewModel (newer format)
    if (item["lockupViewModel"]) {
      const lockup = item["lockupViewModel"] as Record<string, unknown>;
      const contentType = lockup["contentType"] as string | undefined;
      if (contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
        const extracted = extractStreamInfoItemFromLockup(lockup);
        if (extracted) {
          items.push(extracted);
        }
      }
    }

    // Shelf renderers may contain nested items
    if (item["shelfRenderer"]) {
      const shelf = item["shelfRenderer"] as Record<string, unknown>;
      const shelfContent = shelf["content"] as Record<string, unknown> | undefined;
      const verticalList = shelfContent?.["verticalListRenderer"] as Record<string, unknown> | undefined;
      const shelfItems = verticalList?.["items"] as Array<Record<string, unknown>> | undefined;
      if (shelfItems) {
        collectItemsFromContents(shelfItems, items, _contentFilter);
      }
    }
  }
}

function extractNextPage(continuationRenderer: Record<string, unknown>): Page | null {
  const continuationEndpoint = continuationRenderer["continuationEndpoint"] as Record<string, unknown> | undefined;
  const continuationCommand = continuationEndpoint?.["continuationCommand"] as Record<string, unknown> | undefined;
  const token = continuationCommand?.["token"] as string | undefined;

  if (!token) {
    return null;
  }

  return {
    url: `${YOUTUBEI_V1_URL}search?${DISABLE_PRETTY_PRINT}`,
    id: token,
  };
}

function emptySearchResult(query: string, contentFilter: string | null): SearchResult {
  return {
    serviceId: ServiceId.YouTube,
    searchString: query,
    items: [],
    nextPage: null,
    searchSuggestion: null,
    isCorrectedSearch: false,
    contentFilters: contentFilter ? [contentFilter] : [],
    sortFilters: [],
  };
}
