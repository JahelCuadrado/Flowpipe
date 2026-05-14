import type { Downloader } from "../../core/types.js";
import { ParsingError, ReCaptchaError } from "../../core/errors.js";
import {
  WEB_CLIENT_ID,
  WEB_CLIENT_NAME,
  WEB_HARDCODED_CLIENT_VERSION,
  DESKTOP_CLIENT_PLATFORM,
  ANDROID_CLIENT_ID,
  ANDROID_CLIENT_NAME,
  ANDROID_CLIENT_VERSION,
  IOS_CLIENT_VERSION,
  IOS_DEVICE_MODEL,
  IOS_USER_AGENT_VERSION,
  MOBILE_CLIENT_PLATFORM,
} from "./constants.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Supported InnerTube client types for client rotation.
 */
export type InnerTubeClientType = "IOS" | "ANDROID";

export interface InnertubeContext {
  readonly client: {
    readonly clientName: string;
    readonly clientVersion: string;
    readonly hl: string;
    readonly gl: string;
    readonly platform?: string;
    readonly clientScreen?: string;
    readonly originalUrl?: string;
    readonly visitorData?: string;
    readonly utcOffsetMinutes: number;
    readonly deviceMake?: string;
    readonly deviceModel?: string;
    readonly osName?: string;
    readonly osVersion?: string;
    readonly androidSdkVersion?: number;
  };
  readonly request: {
    readonly useSsl: boolean;
    readonly internalExperimentFlags: readonly never[];
  };
  readonly user: {
    readonly lockedSafetyMode: boolean;
  };
  readonly thirdParty?: {
    readonly embedUrl: string;
  };
}

export interface InnertubeRequestBody {
  readonly context: InnertubeContext;
  readonly [key: string]: unknown;
}

// ─── URL constants ───────────────────────────────────────────────────────────

export const YOUTUBEI_V1_URL = "https://www.youtube.com/youtubei/v1/";
export const YOUTUBEI_V1_GAPIS_URL = "https://youtubei.googleapis.com/youtubei/v1/";
export const DISABLE_PRETTY_PRINT = "prettyPrint=false";

// ─── Consent cookie ─────────────────────────────────────────────────────────

const CONSENT_COOKIE_ACCEPTED = "SOCS=CAISAiAD";
const CONSENT_COOKIE_REJECTED = "SOCS=CAE=";

let consentAccepted = false;

export function setConsentAccepted(accepted: boolean): void {
  consentAccepted = accepted;
}

export function generateConsentCookie(): string {
  return consentAccepted ? CONSENT_COOKIE_ACCEPTED : CONSENT_COOKIE_REJECTED;
}

// ─── CPN (Content Playback Nonce) ────────────────────────────────────────────

const CPN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function generateContentPlaybackNonce(): string {
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += CPN_ALPHABET[Math.floor(Math.random() * CPN_ALPHABET.length)];
  }
  return result;
}

export function generateTParameter(): string {
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += CPN_ALPHABET[Math.floor(Math.random() * CPN_ALPHABET.length)];
  }
  return result;
}

// ─── Client version extraction ───────────────────────────────────────────────

const INNERTUBE_VERSION_REGEXES = [
  /INNERTUBE_CONTEXT_CLIENT_VERSION":"([0-9.]+?)"/,
  /innertube_context_client_version":"([0-9.]+?)"/,
  /client\.version=([0-9.]+)/,
];

let cachedClientVersion: string | null = null;

/**
 * Extracts the latest WEB client version from YouTube.
 * Tries sw.js first (lightweight), then the main page, then hardcoded fallback.
 */
export async function getClientVersion(downloader: Downloader): Promise<string> {
  if (cachedClientVersion) {
    return cachedClientVersion;
  }

  // Try extracting from sw.js first (lighter request)
  try {
    const response = await downloader.get("https://www.youtube.com/sw.js", {
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com",
    });

    for (const regex of INNERTUBE_VERSION_REGEXES) {
      const match = regex.exec(response.responseBody);
      if (match?.[1]) {
        cachedClientVersion = match[1];
        return cachedClientVersion;
      }
    }
  } catch {
    // Fall through to main page extraction
  }

  // Try extracting from YouTube main page
  try {
    const response = await downloader.get("https://www.youtube.com", {
      Origin: "https://www.youtube.com",
      Referer: "https://www.youtube.com",
    });

    for (const regex of INNERTUBE_VERSION_REGEXES) {
      const match = regex.exec(response.responseBody);
      if (match?.[1]) {
        cachedClientVersion = match[1];
        return cachedClientVersion;
      }
    }
  } catch {
    // Fall through to hardcoded fallback
  }

  // Fallback to hardcoded version
  cachedClientVersion = WEB_HARDCODED_CLIENT_VERSION;
  return cachedClientVersion;
}

/** Reset cached version (for testing). */
export function resetClientVersion(): void {
  cachedClientVersion = null;
}

// ─── Context builders ────────────────────────────────────────────────────────

/**
 * Builds the InnerTube context for WEB client requests.
 * This is the core of every InnerTube API call.
 */
export async function buildDesktopContext(
  downloader: Downloader,
  localization = "en",
  country = "US"
): Promise<InnertubeContext> {
  const clientVersion = await getClientVersion(downloader);

  return {
    client: {
      clientName: WEB_CLIENT_NAME,
      clientVersion,
      hl: localization,
      gl: country,
      platform: DESKTOP_CLIENT_PLATFORM,
      originalUrl: "https://www.youtube.com",
      utcOffsetMinutes: 0,
    },
    request: {
      useSsl: true,
      internalExperimentFlags: [],
    },
    user: {
      lockedSafetyMode: false,
    },
  };
}

/**
 * Builds the InnerTube context for ANDROID client requests.
 * Used as a fallback when iOS client is blocked by YouTube.
 */
export function buildAndroidContext(
  localization = "en",
  country = "US"
): InnertubeContext {
  return {
    client: {
      clientName: ANDROID_CLIENT_NAME,
      clientVersion: ANDROID_CLIENT_VERSION,
      hl: localization,
      gl: country,
      platform: MOBILE_CLIENT_PLATFORM,
      osName: "Android",
      osVersion: "15",
      androidSdkVersion: 35,
      deviceMake: "Google",
      deviceModel: "Pixel 9",
      utcOffsetMinutes: 0,
    },
    request: {
      useSsl: true,
      internalExperimentFlags: [],
    },
    user: {
      lockedSafetyMode: false,
    },
  };
}

/**
 * Returns the player-specific headers for an ANDROID client request.
 */
export function getAndroidPlayerHeaders(country = "US"): Record<string, string> {
  return {
    "User-Agent": getAndroidUserAgent(country),
    "X-YouTube-Client-Name": ANDROID_CLIENT_ID,
    "X-YouTube-Client-Version": ANDROID_CLIENT_VERSION,
  };
}

/**
 * Returns the player-specific headers for an iOS client request.
 */
export function getIosPlayerHeaders(country = "US"): Record<string, string> {
  return {
    "User-Agent": getIosUserAgent(country),
    "X-YouTube-Client-Name": "5",
    "X-YouTube-Client-Version": IOS_CLIENT_VERSION,
  };
}

// ─── Headers ─────────────────────────────────────────────────────────────────

export function getYouTubeHeaders(clientVersion: string): Record<string, string> {
  return {
    "X-YouTube-Client-Name": WEB_CLIENT_ID,
    "X-YouTube-Client-Version": clientVersion,
    Origin: "https://www.youtube.com",
    Referer: "https://www.youtube.com",
    Cookie: generateConsentCookie(),
    "Content-Type": "application/json",
  };
}

export function getAndroidUserAgent(country = "US"): string {
  return `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 15; ${country}) gzip`;
}

export function getIosUserAgent(country = "US"): string {
  return `com.google.ios.youtube/${IOS_CLIENT_VERSION}(${IOS_DEVICE_MODEL}; U; CPU iOS ${IOS_USER_AGENT_VERSION} like Mac OS X; ${country})`;
}

// ─── InnerTube API calls ─────────────────────────────────────────────────────

/**
 * Makes a POST request to the InnerTube API.
 * This is the primary way to interact with YouTube's backend.
 */
export async function postToInnerTube(
  downloader: Downloader,
  endpoint: string,
  body: InnertubeRequestBody,
  additionalHeaders?: Record<string, string>
): Promise<Record<string, unknown>> {
  const clientVersion = body.context.client.clientVersion;
  const headers = {
    ...getYouTubeHeaders(clientVersion),
    ...additionalHeaders,
  };

  const url = `${YOUTUBEI_V1_URL}${endpoint}?${DISABLE_PRETTY_PRINT}`;
  const response = await downloader.post(url, headers, JSON.stringify(body));

  // Detect rate-limiting / CAPTCHA before any other error handling
  if (response.responseCode === 429) {
    throw new ReCaptchaError(
      `Rate limited (429) for endpoint: ${endpoint}`,
      "https://www.google.com/recaptcha"
    );
  }

  const responseBodyLower = response.responseBody.toLowerCase();
  if (
    responseBodyLower.includes("recaptcha") ||
    responseBodyLower.includes("captcha") ||
    responseBodyLower.includes("google.com/sorry")
  ) {
    throw new ReCaptchaError(
      `CAPTCHA challenge detected for endpoint: ${endpoint}`,
      "https://www.google.com/recaptcha"
    );
  }

  if (response.responseCode === 404) {
    throw new ParsingError(`Content not found (404) for endpoint: ${endpoint}`);
  }

  if (response.responseCode === 403) {
    throw new ReCaptchaError(
      `Access forbidden (403) for endpoint: ${endpoint}`,
      "https://www.google.com/recaptcha"
    );
  }

  if (response.responseCode >= 400) {
    throw new ParsingError(
      `InnerTube request failed (${response.responseCode}) for endpoint: ${endpoint}`
    );
  }

  if (response.responseBody.length < 50) {
    throw new ParsingError("InnerTube response is too short");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response.responseBody) as Record<string, unknown>;
  } catch {
    throw new ParsingError("Failed to parse InnerTube JSON response");
  }

  // Detect rate-limiting in parsed response (playabilityStatus or error objects)
  const errorObj = parsed["error"] as Record<string, unknown> | undefined;
  if (errorObj) {
    const errorCode = errorObj["code"] as number | undefined;
    const errorStatus = errorObj["status"] as string | undefined;
    if (errorCode === 429 || errorStatus === "RESOURCE_EXHAUSTED") {
      throw new ReCaptchaError(
        `Rate limited via error response for endpoint: ${endpoint}`,
        "https://www.google.com/recaptcha"
      );
    }
  }

  return parsed;
}

// ─── Text / JSON helpers ─────────────────────────────────────────────────────

/**
 * Extracts text from a YouTube text object that has either
 * `simpleText` or a `runs` array.
 */
export function getTextFromObject(textObject: Record<string, unknown> | null | undefined): string | null {
  if (!textObject) {
    return null;
  }

  if (typeof textObject["simpleText"] === "string") {
    return textObject["simpleText"];
  }

  const runs = textObject["runs"];
  if (!Array.isArray(runs) || runs.length === 0) {
    return null;
  }

  let result = "";
  for (const run of runs) {
    if (typeof run === "object" && run !== null && "text" in run) {
      result += (run as Record<string, unknown>)["text"];
    }
  }

  return result || null;
}

/**
 * Extracts a URL from a navigation endpoint JSON object.
 * Handles browseEndpoint, watchEndpoint, urlEndpoint, etc.
 */
export function getUrlFromNavigationEndpoint(endpoint: Record<string, unknown> | null | undefined): string | null {
  if (!endpoint) {
    return null;
  }

  // urlEndpoint (external links)
  if (typeof endpoint["urlEndpoint"] === "object" && endpoint["urlEndpoint"] !== null) {
    const urlEndpoint = endpoint["urlEndpoint"] as Record<string, unknown>;
    let internUrl = urlEndpoint["url"] as string | undefined;
    if (internUrl) {
      if (internUrl.startsWith("https://www.youtube.com/redirect?")) {
        internUrl = internUrl.substring(23);
      }
      if (internUrl.startsWith("/redirect?")) {
        const params = internUrl.substring(10).split("&");
        for (const param of params) {
          const [key, value] = param.split("=");
          if (key === "q" && value) {
            return decodeURIComponent(value);
          }
        }
      } else if (internUrl.startsWith("http")) {
        return internUrl;
      }
    }
  }

  // browseEndpoint (channels, playlists)
  if (typeof endpoint["browseEndpoint"] === "object" && endpoint["browseEndpoint"] !== null) {
    const browse = endpoint["browseEndpoint"] as Record<string, unknown>;
    const browseId = browse["browseId"] as string | undefined;
    const canonicalBaseUrl = browse["canonicalBaseUrl"] as string | undefined;

    if (browseId) {
      if (browseId.startsWith("UC")) {
        return `https://www.youtube.com/channel/${browseId}`;
      }
      if (browseId.startsWith("VL")) {
        return `https://www.youtube.com/playlist?list=${browseId.substring(2)}`;
      }
    }

    if (canonicalBaseUrl) {
      return `https://www.youtube.com${canonicalBaseUrl}`;
    }
  }

  // watchEndpoint (videos)
  if (typeof endpoint["watchEndpoint"] === "object" && endpoint["watchEndpoint"] !== null) {
    const watch = endpoint["watchEndpoint"] as Record<string, unknown>;
    let url = `https://www.youtube.com/watch?v=${watch["videoId"] as string}`;
    if (watch["playlistId"]) {
      url += `&list=${watch["playlistId"] as string}`;
    }
    if (typeof watch["startTimeSeconds"] === "number") {
      url += `&t=${watch["startTimeSeconds"]}`;
    }
    return url;
  }

  // watchPlaylistEndpoint
  if (typeof endpoint["watchPlaylistEndpoint"] === "object" && endpoint["watchPlaylistEndpoint"] !== null) {
    const watchPlaylist = endpoint["watchPlaylistEndpoint"] as Record<string, unknown>;
    return `https://www.youtube.com/playlist?list=${watchPlaylist["playlistId"] as string}`;
  }

  return null;
}

/**
 * Extracts thumbnail images from a YouTube thumbnail object.
 */
export function getThumbnailsFromInfoItem(
  infoItem: Record<string, unknown>
): Array<{ url: string; width: number; height: number }> {
  const thumbnail = infoItem["thumbnail"] as Record<string, unknown> | undefined;
  if (!thumbnail) {
    return [];
  }

  const thumbnails = thumbnail["thumbnails"] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(thumbnails)) {
    return [];
  }

  return thumbnails
    .filter((t) => typeof t["url"] === "string")
    .map((t) => ({
      url: fixThumbnailUrl(t["url"] as string),
      width: (t["width"] as number) ?? 0,
      height: (t["height"] as number) ?? 0,
    }));
}

function fixThumbnailUrl(url: string): string {
  let result = url;
  if (result.startsWith("//")) {
    result = result.substring(2);
  }
  if (result.startsWith("http://")) {
    result = result.replace("http://", "https://");
  } else if (!result.startsWith("https://")) {
    result = "https://" + result;
  }
  return result;
}

/**
 * Checks if a channel is verified based on badge metadata.
 */
export function isVerified(badges: unknown[] | undefined): boolean {
  if (!Array.isArray(badges) || badges.length === 0) {
    return false;
  }

  for (const badge of badges) {
    const style = (badge as Record<string, unknown>)?.["metadataBadgeRenderer"] as Record<string, unknown> | undefined;
    const badgeStyle = style?.["style"] as string | undefined;
    if (
      badgeStyle === "BADGE_STYLE_TYPE_VERIFIED" ||
      badgeStyle === "BADGE_STYLE_TYPE_VERIFIED_ARTIST"
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Parses a duration string (e.g., "5:03", "1:02:30") into seconds.
 */
export function parseDurationString(input: string): number {
  if (!input || !/\d/.test(input)) {
    return 0;
  }

  const separator = input.includes(":") ? ":" : ".";
  const parts = input.split(separator);
  const units = [24, 60, 60, 1];
  const offset = units.length - parts.length;

  if (offset < 0) {
    return 0;
  }

  let duration = 0;
  for (let i = 0; i < parts.length; i++) {
    const value = parseInt(parts[i]!.replace(/\D/g, ""), 10) || 0;
    duration = units[i + offset]! * (duration + value);
  }

  return duration;
}

/**
 * Safely traverses a nested JSON object by dot-separated path.
 */
export function getJsonValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}
