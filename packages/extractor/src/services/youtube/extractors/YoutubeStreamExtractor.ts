import type { Downloader } from "../../../core/types.js";
import type {
  StreamInfo,
  StreamInfoItem,
  VideoStream,
  AudioStream,
  SubtitleStream,
  ImageInfo,
} from "@newpipe/shared";
import {
  ServiceId,
  StreamType,
  MediaFormat,
  DeliveryMethod,
  ImageResolutionLevel,
} from "@newpipe/shared";
import {
  ContentNotAvailableError,
  AgeRestrictedContentError,
  ParsingError,
} from "../../../core/errors.js";
import {
  buildDesktopContext,
  postToInnerTube,
  getTextFromObject,
  getThumbnailsFromInfoItem,
  getUrlFromNavigationEndpoint,
  isVerified,
  parseDurationString,
  generateContentPlaybackNonce,
  getIosUserAgent,
} from "../YoutubeParsingHelper.js";
import {
  IOS_CLIENT_NAME,
  IOS_CLIENT_VERSION,
  IOS_DEVICE_MODEL,
  IOS_OS_VERSION,
  MOBILE_CLIENT_PLATFORM,
} from "../constants.js";
import {
  deobfuscateSignature,
  deobfuscateStreamUrl,
} from "../YoutubePlayerManager.js";

// ─── Itag → MediaFormat mapping ─────────────────────────────────────────────

const ITAG_TO_FORMAT: Readonly<Record<number, { format: MediaFormat; isVideoOnly: boolean; type: "video" | "audio" }>> = {
  // MPEG-4 video + audio
  18: { format: MediaFormat.Mpeg4, isVideoOnly: false, type: "video" },
  22: { format: MediaFormat.Mpeg4, isVideoOnly: false, type: "video" },
  // WebM video + audio
  43: { format: MediaFormat.WebM, isVideoOnly: false, type: "video" },
  // Video-only (MPEG-4)
  133: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  134: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  135: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  136: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  137: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  160: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  298: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  299: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  264: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  266: { format: MediaFormat.Mpeg4, isVideoOnly: true, type: "video" },
  // Video-only (WebM VP9)
  242: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  243: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  244: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  247: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  248: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  271: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  272: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  278: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  302: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  303: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  308: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  313: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  315: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  // AV1 video-only
  394: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  395: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  396: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  397: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  398: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  399: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  400: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  401: { format: MediaFormat.WebM, isVideoOnly: true, type: "video" },
  // Audio-only (M4A AAC)
  139: { format: MediaFormat.M4a, isVideoOnly: false, type: "audio" },
  140: { format: MediaFormat.M4a, isVideoOnly: false, type: "audio" },
  141: { format: MediaFormat.M4a, isVideoOnly: false, type: "audio" },
  256: { format: MediaFormat.M4a, isVideoOnly: false, type: "audio" },
  258: { format: MediaFormat.M4a, isVideoOnly: false, type: "audio" },
  327: { format: MediaFormat.M4a, isVideoOnly: false, type: "audio" },
  // Audio-only (WebM Opus)
  249: { format: MediaFormat.WebmaOpus, isVideoOnly: false, type: "audio" },
  250: { format: MediaFormat.WebmaOpus, isVideoOnly: false, type: "audio" },
  251: { format: MediaFormat.WebmaOpus, isVideoOnly: false, type: "audio" },
  // Audio-only (WebM Vorbis)
  171: { format: MediaFormat.Webma, isVideoOnly: false, type: "audio" },
  172: { format: MediaFormat.Webma, isVideoOnly: false, type: "audio" },
};

// ─── Video ID extraction ─────────────────────────────────────────────────────

const VIDEO_ID_PATTERNS = [
  /(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /^([a-zA-Z0-9_-]{11})$/,
];

function extractVideoId(url: string): string {
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = pattern.exec(url);
    if (match?.[1]) {
      return match[1];
    }
  }
  throw new ParsingError(`Could not extract video ID from URL: ${url}`);
}

// ─── Playability check ──────────────────────────────────────────────────────

function checkPlayabilityStatus(playabilityStatus: Record<string, unknown>): void {
  const status = playabilityStatus["status"] as string | undefined;
  if (!status || status.toLowerCase() === "ok") {
    return;
  }

  const reason = (playabilityStatus["reason"] as string) ?? "Unknown reason";

  if (status.toLowerCase() === "login_required") {
    if (reason.includes("inappropriate for some users")) {
      throw new AgeRestrictedContentError(
        "This age-restricted video cannot be watched anonymously"
      );
    }
    if (reason.includes("private")) {
      throw new ContentNotAvailableError("This video is private");
    }
  }

  if (status.toLowerCase() === "unplayable" || status.toLowerCase() === "error") {
    if (reason.includes("country")) {
      throw new ContentNotAvailableError("This video is not available in your country");
    }
    if (reason.includes("payment") || reason.includes("members")) {
      throw new ContentNotAvailableError("This video requires payment");
    }
  }

  throw new ContentNotAvailableError(`Video unavailable: ${reason}`);
}

// ─── Stream extraction ───────────────────────────────────────────────────────

/**
 * Resolves the stream URL from a format object.
 * Handles both direct URLs and signatureCipher-based URLs.
 */
async function resolveStreamUrl(
  downloader: Downloader,
  videoId: string,
  format: Record<string, unknown>
): Promise<string | null> {
  let url = format["url"] as string | undefined;

  if (!url) {
    // Try signatureCipher / cipher
    const cipherString =
      (format["signatureCipher"] as string) ?? (format["cipher"] as string);

    if (!cipherString) {
      return null;
    }

    const cipher = parseQueryString(cipherString);
    const obfuscatedSig = cipher.get("s");
    const sigParam = cipher.get("sp") ?? "signature";
    const baseUrl = cipher.get("url");

    if (!baseUrl || !obfuscatedSig) {
      return null;
    }

    try {
      const deobfuscatedSig = await deobfuscateSignature(
        downloader,
        videoId,
        obfuscatedSig
      );
      url = `${baseUrl}&${sigParam}=${encodeURIComponent(deobfuscatedSig)}`;
    } catch {
      // Skip streams whose signature can't be deobfuscated
      return null;
    }
  }

  // Deobfuscate throttling parameter (n)
  try {
    url = await deobfuscateStreamUrl(downloader, videoId, url);
  } catch {
    // If n-parameter deobfuscation fails, the stream will be throttled but still usable
  }

  return url;
}

function parseQueryString(qs: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const pair of qs.split("&")) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex !== -1) {
      const key = decodeURIComponent(pair.substring(0, eqIndex));
      const value = decodeURIComponent(pair.substring(eqIndex + 1));
      result.set(key, value);
    }
  }
  return result;
}

async function extractVideoStreams(
  downloader: Downloader,
  videoId: string,
  streamingData: Record<string, unknown>,
  isLive: boolean
): Promise<{ videoStreams: VideoStream[]; videoOnlyStreams: VideoStream[] }> {
  const videoStreams: VideoStream[] = [];
  const videoOnlyStreams: VideoStream[] = [];

  const formats = streamingData["formats"] as Array<Record<string, unknown>> | undefined;
  const adaptiveFormats = streamingData["adaptiveFormats"] as Array<Record<string, unknown>> | undefined;

  const allFormats = [...(formats ?? []), ...(adaptiveFormats ?? [])];

  for (const format of allFormats) {
    const itag = format["itag"] as number | undefined;
    if (itag === undefined) {
      continue;
    }

    const itagInfo = ITAG_TO_FORMAT[itag];
    if (!itagInfo || itagInfo.type === "audio") {
      continue;
    }

    const url = await resolveStreamUrl(downloader, videoId, format);
    if (!url) {
      continue;
    }

    const mimeType = (format["mimeType"] as string) ?? "";
    const codec = mimeType.includes("codecs") ? mimeType.split("\"")[1] ?? null : null;
    const width = (format["width"] as number) ?? 0;
    const height = (format["height"] as number) ?? 0;
    const fps = (format["fps"] as number) ?? 0;
    const bitrate = (format["bitrate"] as number) ?? 0;
    const qualityLabel = (format["qualityLabel"] as string) ?? `${height}p`;

    const resolution = fps > 30 ? `${height}p${fps}` : `${height}p`;

    const videoStream: VideoStream = {
      url,
      format: itagInfo.format,
      deliveryMethod: isLive ? DeliveryMethod.Dash : DeliveryMethod.ProgressiveHttp,
      resolution,
      qualityLabel,
      fps,
      bitrate,
      width,
      height,
      codec,
      isVideoOnly: itagInfo.isVideoOnly,
    };

    if (itagInfo.isVideoOnly) {
      videoOnlyStreams.push(videoStream);
    } else {
      videoStreams.push(videoStream);
    }
  }

  return { videoStreams, videoOnlyStreams };
}

async function extractAudioStreams(
  downloader: Downloader,
  videoId: string,
  streamingData: Record<string, unknown>,
  isLive: boolean
): Promise<AudioStream[]> {
  const audioStreams: AudioStream[] = [];

  const adaptiveFormats = streamingData["adaptiveFormats"] as Array<Record<string, unknown>> | undefined;
  if (!adaptiveFormats) {
    return audioStreams;
  }

  for (const format of adaptiveFormats) {
    const itag = format["itag"] as number | undefined;
    if (itag === undefined) {
      continue;
    }

    const itagInfo = ITAG_TO_FORMAT[itag];
    if (!itagInfo || itagInfo.type !== "audio") {
      continue;
    }

    const url = await resolveStreamUrl(downloader, videoId, format);
    if (!url) {
      continue;
    }

    const mimeType = (format["mimeType"] as string) ?? "";
    const codec = mimeType.includes("codecs") ? mimeType.split("\"")[1] ?? null : null;
    const bitrate = (format["averageBitrate"] as number) ?? (format["bitrate"] as number) ?? 0;
    const quality = (format["audioQuality"] as string) ?? null;

    const audioTrack = format["audioTrack"] as Record<string, unknown> | undefined;
    const audioTrackId = (audioTrack?.["id"] as string) ?? null;
    const audioTrackName = (audioTrack?.["displayName"] as string) ?? null;
    const audioIsDefault = (audioTrack?.["audioIsDefault"] as boolean) ?? false;

    // Extract locale from audioTrackId (format: "en.1")
    const audioLocale = audioTrackId?.split(".")[0] ?? null;

    audioStreams.push({
      url,
      format: itagInfo.format,
      deliveryMethod: isLive ? DeliveryMethod.Dash : DeliveryMethod.ProgressiveHttp,
      averageBitrate: bitrate,
      codec,
      audioTrackId,
      audioTrackName,
      audioLocale,
      audioIsDefault,
      quality,
    });
  }

  return audioStreams;
}

// ─── Related items extraction ────────────────────────────────────────────────

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

function extractRelatedItems(nextResponse: Record<string, unknown>): StreamInfoItem[] {
  // Try desktop layout: twoColumnWatchNextResults → secondaryResults
  const twoColumn = (
    (nextResponse["contents"] as Record<string, unknown>)
      ?.["twoColumnWatchNextResults"] as Record<string, unknown>
  );

  const results = twoColumn?.["secondaryResults"] as Record<string, unknown> | undefined;
  const secondaryResults = results?.["secondaryResults"] as Record<string, unknown> | undefined;
  let resultArray = secondaryResults?.["results"] as Array<Record<string, unknown>> | undefined;

  // Fallback: try singleColumnWatchNextResults for mobile layout
  if (!resultArray) {
    const singleColumn = (
      (nextResponse["contents"] as Record<string, unknown>)
        ?.["singleColumnWatchNextResults"] as Record<string, unknown>
    );
    const autoplay = singleColumn?.["autoplay"] as Record<string, unknown> | undefined;
    const autoplayRenderer = autoplay?.["autoplay"] as Record<string, unknown> | undefined;
    const sets = autoplayRenderer?.["sets"] as Array<Record<string, unknown>> | undefined;
    if (sets?.[0]) {
      const autoplayVideo = sets[0]["autoplayVideo"] as Record<string, unknown> | undefined;
      if (autoplayVideo) {
        // autoplay only gives one video, not a list — skip
      }
    }

    // Try results from the primary tab in single column
    const tabs = singleColumn?.["results"] as Record<string, unknown> | undefined;
    const tabResults = tabs?.["results"] as Record<string, unknown> | undefined;
    const tabContents = tabResults?.["contents"] as Array<Record<string, unknown>> | undefined;
    if (tabContents) {
      for (const section of tabContents) {
        const itemSection = section["itemSectionRenderer"] as Record<string, unknown> | undefined;
        const sectionContents = itemSection?.["contents"] as Array<Record<string, unknown>> | undefined;
        if (sectionContents) {
          resultArray = sectionContents;
          break;
        }
      }
    }
  }

  // Fallback: try engagementPanels for related videos
  if (!resultArray) {
    const panels = nextResponse["engagementPanels"] as Array<Record<string, unknown>> | undefined;
    if (panels) {
      for (const panel of panels) {
        const renderer = panel["engagementPanelSectionListRenderer"] as Record<string, unknown> | undefined;
        const panelId = renderer?.["panelIdentifier"] as string | undefined;
        if (panelId === "engagement-panel-structured-description" || panelId?.includes("related")) {
          continue;
        }
        const content = renderer?.["content"] as Record<string, unknown> | undefined;
        const sectionList = content?.["sectionListRenderer"] as Record<string, unknown> | undefined;
        const sections = sectionList?.["contents"] as Array<Record<string, unknown>> | undefined;
        if (sections) {
          for (const section of sections) {
            const itemSection = section["itemSectionRenderer"] as Record<string, unknown> | undefined;
            const sectionContents = itemSection?.["contents"] as Array<Record<string, unknown>> | undefined;
            if (sectionContents) {
              resultArray = sectionContents;
              break;
            }
          }
        }
        if (resultArray) break;
      }
    }
  }

  if (!resultArray) {
    return [];
  }

  const items: StreamInfoItem[] = [];

  for (const result of resultArray) {
    // YouTube uses different renderer types depending on layout
    const renderer = (result["compactVideoRenderer"]
      ?? result["videoRenderer"]
      ?? result["gridVideoRenderer"]
      ?? result["videoWithContextRenderer"]) as Record<string, unknown> | undefined;
    if (!renderer) {
      continue;
    }

    const videoId = renderer["videoId"] as string | undefined;
    if (!videoId) {
      continue;
    }

    const title = getTextFromObject(renderer["title"] as Record<string, unknown>) ?? "";
    const lengthText = getTextFromObject(renderer["lengthText"] as Record<string, unknown>);
    const duration = lengthText ? parseDurationString(lengthText) : -1;

    const ownerText = renderer["longBylineText"] as Record<string, unknown> | undefined;
    const uploaderName = getTextFromObject(ownerText) ?? "";
    const runs = ownerText?.["runs"] as Array<Record<string, unknown>> | undefined;
    const uploaderUrl = runs?.[0]
      ? getUrlFromNavigationEndpoint(runs[0]["navigationEndpoint"] as Record<string, unknown>)
      : null;

    const thumbnails = toImageInfoList(getThumbnailsFromInfoItem(renderer));

    const viewCountText = getTextFromObject(renderer["viewCountText"] as Record<string, unknown>);
    const viewCount = viewCountText ? parseViewCountStr(viewCountText) : null;

    const publishedTimeText = getTextFromObject(renderer["publishedTimeText"] as Record<string, unknown>);
    const ownerBadges = renderer["ownerBadges"] as unknown[] | undefined;

    items.push({
      serviceId: ServiceId.YouTube,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      name: title,
      streamType: StreamType.VideoStream,
      thumbnails,
      uploaderName,
      uploaderUrl,
      uploaderAvatars: [],
      uploaderVerified: isVerified(ownerBadges),
      duration,
      viewCount,
      textualUploadDate: publishedTimeText ?? null,
      uploadDate: null,
      shortDescription: null,
    });
  }

  return items;
}

function parseViewCountStr(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  if (!cleaned) {
    return null;
  }
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// ─── Main stream extraction ─────────────────────────────────────────────────

/**
 * Extracts full stream info from a YouTube video URL via InnerTube API.
 * Uses iOS client for player data (avoids PoToken requirement) and
 * WEB client for watch-next metadata (related videos, descriptions).
 */
export async function youtubeGetStreamInfo(
  downloader: Downloader,
  url: string,
  localization = "en",
  country = "US"
): Promise<StreamInfo> {
  const videoId = extractVideoId(url);
  const cpn = generateContentPlaybackNonce();

  // ── iOS client context for player request (bypasses PoToken) ──
  const iosContext = {
    client: {
      clientName: IOS_CLIENT_NAME,
      clientVersion: IOS_CLIENT_VERSION,
      deviceModel: IOS_DEVICE_MODEL,
      osVersion: IOS_OS_VERSION,
      platform: MOBILE_CLIENT_PLATFORM,
      hl: localization,
      gl: country,
    },
    request: {
      useSsl: true,
      internalExperimentFlags: [],
    },
    user: {
      lockedSafetyMode: false,
    },
  };

  const playerBody: Record<string, unknown> = {
    context: iosContext,
    videoId,
    cpn,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const iosHeaders = {
    "User-Agent": getIosUserAgent(country),
    "X-YouTube-Client-Name": "5",
    "X-YouTube-Client-Version": IOS_CLIENT_VERSION,
  };

  const playerResponse = await postToInnerTube(
    downloader,
    "player",
    playerBody as never,
    iosHeaders
  );

  // Check playability
  const playabilityStatus = playerResponse["playabilityStatus"] as Record<string, unknown>;
  if (playabilityStatus) {
    checkPlayabilityStatus(playabilityStatus);
  }

  // ── WEB client for next endpoint (metadata, related videos) ──
  const webContext = await buildDesktopContext(downloader, localization, country);
  const nextBody: Record<string, unknown> = {
    context: webContext,
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const nextResponse = await postToInnerTube(
    downloader,
    "next",
    nextBody as never
  );

  return buildStreamInfo(downloader, videoId, url, playerResponse, nextResponse);
}

async function buildStreamInfo(
  downloader: Downloader,
  videoId: string,
  originalUrl: string,
  playerResponse: Record<string, unknown>,
  nextResponse: Record<string, unknown>
): Promise<StreamInfo> {
  const videoDetails = playerResponse["videoDetails"] as Record<string, unknown> | undefined;
  if (!videoDetails) {
    throw new ParsingError("Could not find videoDetails in player response");
  }

  // Basic metadata
  const title = (videoDetails["title"] as string) ?? "";
  const lengthSeconds = parseInt((videoDetails["lengthSeconds"] as string) ?? "0", 10);
  const viewCount = parseInt((videoDetails["viewCount"] as string) ?? "0", 10);
  const channelId = (videoDetails["channelId"] as string) ?? "";
  const author = (videoDetails["author"] as string) ?? "";
  const shortDescription = (videoDetails["shortDescription"] as string) ?? "";
  const isLive = (videoDetails["isLiveContent"] as boolean) ?? false;
  const isPostLiveDvr = (videoDetails["isPostLiveDvr"] as boolean) ?? false;
  const keywords = (videoDetails["keywords"] as string[]) ?? [];

  // Stream type
  const playabilityStatus = playerResponse["playabilityStatus"] as Record<string, unknown> | undefined;
  const hasLiveStreamability = playabilityStatus?.["liveStreamability"] !== undefined;
  let streamType: StreamType;
  if (hasLiveStreamability) {
    streamType = StreamType.LiveStream;
  } else if (isPostLiveDvr) {
    streamType = StreamType.PostLiveStream;
  } else {
    streamType = StreamType.VideoStream;
  }

  // Thumbnails
  const thumbnailObj = videoDetails["thumbnail"] as Record<string, unknown> | undefined;
  const thumbnailsArray = thumbnailObj?.["thumbnails"] as Array<Record<string, unknown>> | undefined;
  const thumbnails: ImageInfo[] = (thumbnailsArray ?? [])
    .filter((t) => typeof t["url"] === "string")
    .map((t) => ({
      url: t["url"] as string,
      width: (t["width"] as number) ?? 0,
      height: (t["height"] as number) ?? 0,
      estimatedResolutionLevel: ImageResolutionLevel.Unknown,
    }));

  // Uploader info from next response
  const uploaderUrl = channelId ? `https://www.youtube.com/channel/${channelId}` : null;

  // Streaming data
  const streamingData = playerResponse["streamingData"] as Record<string, unknown> | undefined;
  let videoStreams: VideoStream[] = [];
  let videoOnlyStreams: VideoStream[] = [];
  let audioStreams: AudioStream[] = [];

  if (streamingData) {
    const extracted = await extractVideoStreams(downloader, videoId, streamingData, isLive);
    videoStreams = extracted.videoStreams;
    videoOnlyStreams = extracted.videoOnlyStreams;
    audioStreams = await extractAudioStreams(downloader, videoId, streamingData, isLive);
  }

  // DASH and HLS manifest URLs
  const dashMpdUrl = (streamingData?.["dashManifestUrl"] as string) ?? null;
  const hlsUrl = (streamingData?.["hlsManifestUrl"] as string) ?? null;

  // Microformat
  const microformat = playerResponse["microformat"] as Record<string, unknown> | undefined;
  const microformatRenderer = microformat?.["playerMicroformatRenderer"] as Record<string, unknown> | undefined;
  const uploadDate = (microformatRenderer?.["uploadDate"] as string)
    ?? (microformatRenderer?.["publishDate"] as string)
    ?? null;
  const category = (microformatRenderer?.["category"] as string) ?? "";

  // Like count from next response
  const likeCount = extractLikeCount(nextResponse);

  // Related items
  const relatedItems = extractRelatedItems(nextResponse);

  // Description from next response (more detailed)
  const fullDescription = extractDescription(nextResponse) ?? shortDescription;

  // Upload date text from next response
  const textualUploadDate = extractUploadDateText(nextResponse) ?? uploadDate;

  // Verified status
  const uploaderVerified = extractUploaderVerified(nextResponse);

  // Uploader avatars
  const uploaderAvatars = extractUploaderAvatars(nextResponse);

  // Subscriber count
  const uploaderSubscriberCount = extractSubscriberCount(nextResponse);

  // Subtitles / Captions
  const subtitles = extractSubtitles(playerResponse);

  return {
    serviceId: ServiceId.YouTube,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    originalUrl,
    name: title,
    streamType,
    thumbnails,
    description: fullDescription,
    uploaderName: author,
    uploaderUrl,
    uploaderAvatars,
    uploaderVerified,
    uploaderSubscriberCount,
    subChannelName: "",
    subChannelUrl: null,
    subChannelAvatars: [],
    duration: lengthSeconds,
    viewCount: Number.isNaN(viewCount) ? null : viewCount,
    likeCount,
    dislikeCount: null,
    textualUploadDate,
    uploadDate,
    category,
    tags: keywords,
    ageLimit: 0,
    dashMpdUrl,
    hlsUrl,
    videoStreams,
    videoOnlyStreams,
    audioStreams,
    relatedItems,
    nextPage: null,
    subtitles,
  };
}

// ─── Next response helpers ──────────────────────────────────────────────────

function getVideoInfoRenderer(
  nextResponse: Record<string, unknown>,
  rendererName: string
): Record<string, unknown> | null {
  const contents = (
    (nextResponse["contents"] as Record<string, unknown>)
      ?.["twoColumnWatchNextResults"] as Record<string, unknown>
  )?.["results"] as Record<string, unknown> | undefined;

  const results = contents?.["results"] as Record<string, unknown> | undefined;
  const resultArray = results?.["contents"] as Array<Record<string, unknown>> | undefined;

  if (!resultArray) {
    return null;
  }

  for (const content of resultArray) {
    if (content[rendererName]) {
      return content[rendererName] as Record<string, unknown>;
    }
  }

  return null;
}

function extractLikeCount(nextResponse: Record<string, unknown>): number | null {
  const primaryInfo = getVideoInfoRenderer(nextResponse, "videoPrimaryInfoRenderer");
  if (!primaryInfo) {
    return null;
  }

  // Try the newer buttonViewModel path
  const topLevelButtons = (
    (primaryInfo["videoActions"] as Record<string, unknown>)
      ?.["menuRenderer"] as Record<string, unknown>
  )?.["topLevelButtons"] as Array<Record<string, unknown>> | undefined;

  if (!topLevelButtons) {
    return null;
  }

  for (const button of topLevelButtons) {
    // Newer segmentedLikeDislikeButtonViewModel path
    const buttonViewModel = (
      (button["segmentedLikeDislikeButtonViewModel"] as Record<string, unknown>)
        ?.["likeButtonViewModel"] as Record<string, unknown>
    )?.["likeButtonViewModel"] as Record<string, unknown> | undefined;

    const toggleButton = (
      (buttonViewModel?.["toggleButtonViewModel"] as Record<string, unknown>)
        ?.["toggleButtonViewModel"] as Record<string, unknown>
    )?.["defaultButtonViewModel"] as Record<string, unknown> | undefined;

    const btnVm = toggleButton?.["buttonViewModel"] as Record<string, unknown> | undefined;
    const accessibilityText = btnVm?.["accessibilityText"] as string | undefined;

    if (accessibilityText) {
      const count = parseViewCountStr(accessibilityText);
      if (count !== null) {
        return count;
      }
    }
  }

  return null;
}

function extractDescription(nextResponse: Record<string, unknown>): string | null {
  const secondaryInfo = getVideoInfoRenderer(nextResponse, "videoSecondaryInfoRenderer");
  if (!secondaryInfo) {
    return null;
  }

  // Try description object
  const descText = getTextFromObject(secondaryInfo["description"] as Record<string, unknown>);
  if (descText) {
    return descText;
  }

  // Try attributedDescription
  const attributed = secondaryInfo["attributedDescription"] as Record<string, unknown> | undefined;
  if (attributed) {
    return (attributed["content"] as string) ?? null;
  }

  return null;
}

function extractUploadDateText(nextResponse: Record<string, unknown>): string | null {
  const primaryInfo = getVideoInfoRenderer(nextResponse, "videoPrimaryInfoRenderer");
  if (!primaryInfo) {
    return null;
  }

  const dateText = getTextFromObject(primaryInfo["dateText"] as Record<string, unknown>);
  return dateText ?? null;
}

function extractUploaderVerified(nextResponse: Record<string, unknown>): boolean {
  const secondaryInfo = getVideoInfoRenderer(nextResponse, "videoSecondaryInfoRenderer");
  if (!secondaryInfo) {
    return false;
  }

  const owner = (secondaryInfo["owner"] as Record<string, unknown>)
    ?.["videoOwnerRenderer"] as Record<string, unknown> | undefined;

  if (!owner) {
    return false;
  }

  const badges = owner["badges"] as unknown[] | undefined;
  return isVerified(badges);
}

function extractUploaderAvatars(nextResponse: Record<string, unknown>): ImageInfo[] {
  const secondaryInfo = getVideoInfoRenderer(nextResponse, "videoSecondaryInfoRenderer");
  if (!secondaryInfo) {
    return [];
  }

  const owner = (secondaryInfo["owner"] as Record<string, unknown>)
    ?.["videoOwnerRenderer"] as Record<string, unknown> | undefined;

  if (!owner) {
    return [];
  }

  return toImageInfoList(getThumbnailsFromInfoItem(owner));
}

function extractSubscriberCount(nextResponse: Record<string, unknown>): number | null {
  const secondaryInfo = getVideoInfoRenderer(nextResponse, "videoSecondaryInfoRenderer");
  if (!secondaryInfo) {
    return null;
  }

  const owner = (secondaryInfo["owner"] as Record<string, unknown>)
    ?.["videoOwnerRenderer"] as Record<string, unknown> | undefined;

  if (!owner) {
    return null;
  }

  const subscriberText = getTextFromObject(
    owner["subscriberCountText"] as Record<string, unknown>
  );

  if (!subscriberText) {
    return null;
  }

  return parseMixedNumberWord(subscriberText);
}

/**
 * Extracts subtitle/caption tracks from the player response.
 * YouTube provides these under captions.playerCaptionsTracklistRenderer.captionTracks.
 */
function extractSubtitles(playerResponse: Record<string, unknown>): SubtitleStream[] {
  const captions = playerResponse["captions"] as Record<string, unknown> | undefined;
  if (!captions) return [];

  const renderer = captions["playerCaptionsTracklistRenderer"] as Record<string, unknown> | undefined;
  if (!renderer) return [];

  const tracks = renderer["captionTracks"] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(tracks)) return [];

  return tracks
    .filter((t) => typeof t["baseUrl"] === "string")
    .map((t) => {
      const baseUrl = t["baseUrl"] as string;
      // Request WebVTT format instead of YouTube's default XML
      const vttUrl = baseUrl.includes("fmt=")
        ? baseUrl
        : `${baseUrl}&fmt=vtt`;
      const languageCode = (t["languageCode"] as string) ?? "und";
      const trackName = (t["name"] as Record<string, unknown> | undefined);
      const displayLanguage = trackName
        ? (getTextFromObject(trackName) ?? languageCode)
        : languageCode;
      const kind = (t["kind"] as string) ?? "";
      const autoGenerated = kind === "asr";

      return {
        url: vttUrl,
        languageCode,
        displayLanguage,
        autoGenerated,
      };
    });
}

/**
 * Parses mixed number words like "1.2M", "500K", "3.4B" into actual numbers.
 */
function parseMixedNumberWord(text: string): number | null {
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

  // Try plain number
  const plain = cleaned.replace(/[^0-9]/g, "");
  if (plain) {
    const value = parseInt(plain, 10);
    return Number.isNaN(value) ? null : value;
  }

  return null;
}
