import type { Downloader } from "../../../core/types.js";

const SUGGESTION_URL = "https://suggestqueries-clients6.youtube.com/complete/search";

/**
 * Fetches YouTube search suggestions for a given query.
 * Uses the public suggest API (no InnerTube auth needed).
 */
export async function youtubeGetSearchSuggestions(
  downloader: Downloader,
  query: string,
  localization = "en"
): Promise<readonly string[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    client: "youtube",
    ds: "yt",
    q: query,
    hl: localization,
  });

  const url = `${SUGGESTION_URL}?${params.toString()}`;

  const response = await downloader.get(url, {
    "User-Agent": "Mozilla/5.0",
  });

  if (response.responseCode !== 200 || !response.responseBody) {
    return [];
  }

  return parseSuggestions(response.responseBody);
}

/**
 * Parses the JSONP-like response from the suggestion API.
 * Response format: window.google.ac.h(["query",[["suggestion1"],["suggestion2"],...]])
 */
function parseSuggestions(body: string): string[] {
  // Extract the JSON array from JSONP callback
  const startIndex = body.indexOf("[");
  const endIndex = body.lastIndexOf("]");

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return [];
  }

  try {
    const jsonStr = body.substring(startIndex, endIndex + 1);
    const parsed = JSON.parse(jsonStr) as unknown[];

    if (!Array.isArray(parsed) || parsed.length < 2) {
      return [];
    }

    const suggestions = parsed[1];
    if (!Array.isArray(suggestions)) {
      return [];
    }

    return suggestions
      .filter(Array.isArray)
      .map((item: unknown[]) => item[0])
      .filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}
