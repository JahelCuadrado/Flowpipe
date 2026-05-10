import type { Downloader } from "../../../core/types.js";
import type { PlaylistInfo, StreamInfoItem, ImageInfo, Page } from "@newpipe/shared";
import { ServiceId, StreamType, ImageResolutionLevel, PlaylistType } from "@newpipe/shared";
import type { InfoItemsPage } from "../../../core/types.js";
import {
  buildDesktopContext,
  postToInnerTube,
  getTextFromObject,
  getThumbnailsFromInfoItem,
  getUrlFromNavigationEndpoint,
  parseDurationString,
} from "../YoutubeParsingHelper.js";
import { ParsingError } from "../../../core/errors.js";

// ─── Playlist ID extraction ─────────────────────────────────────────────────

const PLAYLIST_ID_REGEX = /[?&]list=([a-zA-Z0-9_-]+)/;

function extractPlaylistId(url: string): string {
  const match = PLAYLIST_ID_REGEX.exec(url);
  if (match?.[1]) {
    return match[1];
  }
  // Try bare ID
  const bare = url.split("/").pop();
  if (bare && /^[A-Za-z0-9_-]{10,}$/.test(bare)) {
    return bare;
  }
  throw new ParsingError(`Could not extract playlist ID from URL: ${url}`);
}

// ─── Playlist info extraction ───────────────────────────────────────────────

export async function youtubeGetPlaylistInfo(
  downloader: Downloader,
  url: string,
  localization = "en",
  country = "US"
): Promise<PlaylistInfo> {
  const context = await buildDesktopContext(downloader, localization, country);
  const playlistId = extractPlaylistId(url);

  const browseId = playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;

  const body: Record<string, unknown> = {
    context,
    browseId,
  };

  const response = await postToInnerTube(downloader, "browse", body as never);

  return parsePlaylistResponse(response, url, playlistId);
}

export async function youtubeGetPlaylistNextPage(
  downloader: Downloader,
  _url: string,
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

  return parsePlaylistContinuation(response);
}

// ─── Response parsers ───────────────────────────────────────────────────────

function parsePlaylistResponse(
  data: Record<string, unknown>,
  originalUrl: string,
  playlistId: string
): PlaylistInfo {
  const header = data["header"] as Record<string, unknown> | undefined;
  const sidebar = data["sidebar"] as Record<string, unknown> | undefined;

  // Header variants
  const playlistHeader = header?.["playlistHeaderRenderer"] as Record<string, unknown> | undefined;

  const metadata = data["metadata"] as Record<string, unknown> | undefined;
  const playlistMetadata = metadata?.["playlistMetadataRenderer"] as Record<string, unknown> | undefined;

  const name = (playlistMetadata?.["title"] as string)
    ?? (playlistHeader ? getTextFromObject(playlistHeader["title"] as Record<string, unknown>) : null)
    ?? "Unknown Playlist";

  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

  // Description
  const description = (playlistMetadata?.["description"] as string)
    ?? (playlistHeader
      ? getTextFromObject(playlistHeader["descriptionText"] as Record<string, unknown>)
      : null);

  // Thumbnails from header
  let thumbnails: ImageInfo[] = [];
  if (playlistHeader?.["playlistHeaderBanner"]) {
    thumbnails = toImageInfoList(
      getThumbnailsFromInfoItem(playlistHeader["playlistHeaderBanner"] as Record<string, unknown>)
    );
  }

  // Try hero image from sidebar
  if (thumbnails.length === 0 && sidebar) {
    const sidebarRenderer = sidebar["playlistSidebarRenderer"] as Record<string, unknown> | undefined;
    const sidebarItems = sidebarRenderer?.["items"] as Array<Record<string, unknown>> | undefined;
    const primaryInfo = sidebarItems?.[0]?.["playlistSidebarPrimaryInfoRenderer"] as Record<string, unknown> | undefined;
    if (primaryInfo?.["thumbnailRenderer"]) {
      const thumbRenderer = primaryInfo["thumbnailRenderer"] as Record<string, unknown>;
      const playlistVideo = thumbRenderer["playlistVideoThumbnailRenderer"] as Record<string, unknown>
        ?? thumbRenderer["playlistCustomThumbnailRenderer"] as Record<string, unknown>;
      if (playlistVideo) {
        thumbnails = toImageInfoList(getThumbnailsFromInfoItem(playlistVideo));
      }
    }
  }

  // Uploader from sidebar
  let uploaderName = "";
  let uploaderUrl: string | null = null;
  let uploaderAvatars: ImageInfo[] = [];
  if (sidebar) {
    const sidebarRenderer = sidebar["playlistSidebarRenderer"] as Record<string, unknown> | undefined;
    const sidebarItems = sidebarRenderer?.["items"] as Array<Record<string, unknown>> | undefined;
    const secondaryInfo = sidebarItems?.[1]?.["playlistSidebarSecondaryInfoRenderer"] as Record<string, unknown> | undefined;
    const videoOwner = secondaryInfo?.["videoOwner"] as Record<string, unknown> | undefined;
    const videoOwnerRenderer = videoOwner?.["videoOwnerRenderer"] as Record<string, unknown> | undefined;
    if (videoOwnerRenderer) {
      uploaderName = getTextFromObject(videoOwnerRenderer["title"] as Record<string, unknown>) ?? "";
      const navEndpoint = videoOwnerRenderer["navigationEndpoint"] as Record<string, unknown> | undefined;
      uploaderUrl = getUrlFromNavigationEndpoint(navEndpoint);
      uploaderAvatars = toImageInfoList(getThumbnailsFromInfoItem(videoOwnerRenderer));
    }
  }

  // Try uploader from header
  if (!uploaderName && playlistHeader) {
    const ownerText = playlistHeader["ownerText"] as Record<string, unknown> | undefined;
    uploaderName = getTextFromObject(ownerText) ?? "";
    const runs = ownerText?.["runs"] as Array<Record<string, unknown>> | undefined;
    if (runs?.[0]) {
      uploaderUrl = getUrlFromNavigationEndpoint(
        runs[0]["navigationEndpoint"] as Record<string, unknown>
      );
    }
  }

  // Stream count
  let streamCount: number | null = null;
  if (playlistHeader) {
    const statsArray = playlistHeader["stats"] as Array<Record<string, unknown>> | undefined;
    if (statsArray?.[0]) {
      const countText = getTextFromObject(statsArray[0]);
      if (countText) {
        const num = countText.replace(/[^0-9]/g, "");
        if (num) {
          streamCount = parseInt(num, 10);
        }
      }
    }
    if (streamCount === null) {
      const numText = playlistHeader["numVideosText"] as Record<string, unknown> | undefined;
      const text = getTextFromObject(numText);
      if (text) {
        const num = text.replace(/[^0-9]/g, "");
        if (num) {
          streamCount = parseInt(num, 10);
        }
      }
    }
  }

  // Playlist type
  const playlistType = playlistId.startsWith("RD")
    ? PlaylistType.Mix
    : playlistId.startsWith("OLAK")
      ? PlaylistType.MixMusic
      : PlaylistType.Normal;

  // Items
  const { items, nextPage } = extractPlaylistItems(data);

  return {
    serviceId: ServiceId.YouTube,
    url: playlistUrl,
    originalUrl,
    name,
    thumbnails,
    uploaderName,
    uploaderUrl,
    uploaderAvatars,
    banners: [],
    streamCount,
    description,
    playlistType,
    items,
    nextPage,
  };
}

function extractPlaylistItems(data: Record<string, unknown>): {
  items: StreamInfoItem[];
  nextPage: Page | null;
} {
  const contents = data["contents"] as Record<string, unknown> | undefined;
  const twoColumn = contents?.["twoColumnBrowseResultsRenderer"] as Record<string, unknown> | undefined;
  const tabs = twoColumn?.["tabs"] as Array<Record<string, unknown>> | undefined;

  if (!tabs?.[0]) {
    return { items: [], nextPage: null };
  }

  const tabRenderer = tabs[0]["tabRenderer"] as Record<string, unknown> | undefined;
  const tabContent = tabRenderer?.["content"] as Record<string, unknown> | undefined;
  const sectionList = tabContent?.["sectionListRenderer"] as Record<string, unknown> | undefined;
  const sections = sectionList?.["contents"] as Array<Record<string, unknown>> | undefined;

  if (!sections?.[0]) {
    return { items: [], nextPage: null };
  }

  const itemSection = sections[0]["itemSectionRenderer"] as Record<string, unknown> | undefined;
  const sectionContents = itemSection?.["contents"] as Array<Record<string, unknown>> | undefined;

  if (!sectionContents?.[0]) {
    return { items: [], nextPage: null };
  }

  const playlistVideoList = sectionContents[0]["playlistVideoListRenderer"] as Record<string, unknown> | undefined;
  const videoItems = playlistVideoList?.["contents"] as Array<Record<string, unknown>> | undefined;

  if (!videoItems) {
    return { items: [], nextPage: null };
  }

  const items: StreamInfoItem[] = [];
  let nextPage: Page | null = null;

  for (const item of videoItems) {
    if (item["playlistVideoRenderer"]) {
      const videoItem = extractPlaylistVideoItem(item["playlistVideoRenderer"] as Record<string, unknown>);
      if (videoItem) {
        items.push(videoItem);
      }
    } else if (item["continuationItemRenderer"]) {
      nextPage = extractContinuationToken(item["continuationItemRenderer"] as Record<string, unknown>);
    }
  }

  return { items, nextPage };
}

function parsePlaylistContinuation(data: Record<string, unknown>): InfoItemsPage<StreamInfoItem> {
  const commands = data["onResponseReceivedActions"] as Array<Record<string, unknown>> | undefined;
  const appendAction = commands?.[0]?.["appendContinuationItemsAction"] as Record<string, unknown> | undefined;
  const continuationItems = appendAction?.["continuationItems"] as Array<Record<string, unknown>> | undefined;

  if (!continuationItems) {
    return { items: [], nextPage: null };
  }

  const items: StreamInfoItem[] = [];
  let nextPage: Page | null = null;

  for (const item of continuationItems) {
    if (item["playlistVideoRenderer"]) {
      const videoItem = extractPlaylistVideoItem(item["playlistVideoRenderer"] as Record<string, unknown>);
      if (videoItem) {
        items.push(videoItem);
      }
    } else if (item["continuationItemRenderer"]) {
      nextPage = extractContinuationToken(item["continuationItemRenderer"] as Record<string, unknown>);
    }
  }

  return { items, nextPage };
}

// ─── Item parsers ───────────────────────────────────────────────────────────

function extractPlaylistVideoItem(renderer: Record<string, unknown>): StreamInfoItem | null {
  const videoId = renderer["videoId"] as string | undefined;
  if (!videoId) {
    return null;
  }

  const title = getTextFromObject(renderer["title"] as Record<string, unknown>) ?? "";
  const lengthText = getTextFromObject(renderer["lengthText"] as Record<string, unknown>);
  const duration = lengthText ? parseDurationString(lengthText) : -1;

  const thumbnails = toImageInfoList(getThumbnailsFromInfoItem(renderer));

  const shortByline = renderer["shortBylineText"] as Record<string, unknown> | undefined;
  const uploaderName = getTextFromObject(shortByline) ?? "";
  const runs = shortByline?.["runs"] as Array<Record<string, unknown>> | undefined;
  const uploaderUrl = runs?.[0]
    ? getUrlFromNavigationEndpoint(runs[0]["navigationEndpoint"] as Record<string, unknown>)
    : null;

  return {
    serviceId: ServiceId.YouTube,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    name: title,
    streamType: StreamType.VideoStream,
    thumbnails,
    uploaderName,
    uploaderUrl,
    uploaderAvatars: [],
    uploaderVerified: false,
    duration,
    viewCount: null,
    textualUploadDate: null,
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
