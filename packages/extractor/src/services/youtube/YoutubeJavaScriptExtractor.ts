import type { Downloader } from "../../core/types.js";
import { ParsingError } from "../../core/errors.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const IFRAME_API_URL = "https://www.youtube.com/iframe_api";
const BASE_JS_PLAYER_URL_FORMAT =
  "https://www.youtube.com/s/player/%s/player_ias.vflset/en_GB/base.js";

const IFRAME_HASH_REGEX = /player\\\/([a-z0-9]{8})\\\//;
const EMBED_JS_URL_REGEX =
  /"jsUrl":"(\/s\/player\/[A-Za-z0-9]+\/player_ias\.vflset\/[A-Za-z_-]+\/base\.js)"/;

// ─── Player code fetching ────────────────────────────────────────────────────

/**
 * Fetches the full JavaScript base player code from YouTube.
 * Tries iframe_api first, falls back to embed page.
 */
export async function fetchPlayerCode(
  downloader: Downloader,
  videoId = ""
): Promise<string> {
  let playerUrl: string | null = null;

  // Strategy 1: iframe_api resource
  try {
    playerUrl = await extractPlayerUrlFromIframe(downloader);
  } catch {
    // Fall through to embed page
  }

  // Strategy 2: embed watch page
  if (!playerUrl && videoId) {
    try {
      playerUrl = await extractPlayerUrlFromEmbed(downloader, videoId);
    } catch {
      // Both strategies failed
    }
  }

  if (!playerUrl) {
    throw new ParsingError("Could not determine JavaScript base player URL");
  }

  const fullUrl = cleanPlayerUrl(playerUrl);

  const response = await downloader.get(fullUrl, {
    Origin: "https://www.youtube.com",
    Referer: "https://www.youtube.com",
  });

  if (response.responseCode !== 200 || !response.responseBody) {
    throw new ParsingError(
      `Failed to download JavaScript player code (HTTP ${response.responseCode})`
    );
  }

  return response.responseBody;
}

async function extractPlayerUrlFromIframe(downloader: Downloader): Promise<string> {
  const response = await downloader.get(IFRAME_API_URL, {
    Origin: "https://www.youtube.com",
    Referer: "https://www.youtube.com",
  });

  const match = IFRAME_HASH_REGEX.exec(response.responseBody);
  if (!match?.[1]) {
    throw new ParsingError("Could not extract player hash from iframe_api");
  }

  return BASE_JS_PLAYER_URL_FORMAT.replace("%s", match[1]);
}

async function extractPlayerUrlFromEmbed(
  downloader: Downloader,
  videoId: string
): Promise<string> {
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  const response = await downloader.get(embedUrl, {
    Origin: "https://www.youtube.com",
    Referer: "https://www.youtube.com",
  });

  const match = EMBED_JS_URL_REGEX.exec(response.responseBody);
  if (!match?.[1]) {
    throw new ParsingError("Could not extract player URL from embed page");
  }

  return match[1];
}

function cleanPlayerUrl(url: string): string {
  if (url.startsWith("//")) {
    return "https:" + url;
  }
  if (url.startsWith("/")) {
    return "https://www.youtube.com" + url;
  }
  return url;
}
